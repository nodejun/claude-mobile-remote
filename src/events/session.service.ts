import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ChildProcess } from 'child_process';

import {
  Session,
  CreateSessionOptions,
  SessionInfo,
} from '#interfaces/session.interface';
import { ClaudeService } from './claude.service';

/**
 * 세션 관리 서비스
 * 클라이언트별 세션 생명주기 관리 담당
 */
@Injectable()
export class SessionService {
  /** 클라이언트 ID → Session 매핑 */
  private sessions: Map<string, Session> = new Map();

  constructor(
    @Inject(forwardRef(() => ClaudeService))
    private readonly claudeService: ClaudeService,
  ) {}

  /**
   * 새 세션 생성
   * @param clientId - 클라이언트 Socket ID
   * @param options - 세션 생성 옵션
   * @returns 생성된 세션
   */
  createSession(clientId: string, options?: CreateSessionOptions): Session {
    const session: Session = {
      sessionId: uuidv4(),
      claudeProcess: null,
      projectPath: options?.projectPath || process.cwd(),
      isFirstPrompt: true,
    };

    this.sessions.set(clientId, session);
    console.log(`📋 새 세션 생성: ${session.sessionId}`);

    return session;
  }

  /**
   * 세션 조회
   * @param clientId - 클라이언트 Socket ID
   * @returns 세션 (없으면 undefined)
   */
  getSession(clientId: string): Session | undefined {
    return this.sessions.get(clientId);
  }

  /**
   * 세션 존재 여부 확인
   */
  hasSession(clientId: string): boolean {
    return this.sessions.has(clientId);
  }

  /**
   * 세션 삭제 (프로세스 정리 포함)
   * @param clientId - 클라이언트 Socket ID
   * @returns 삭제 성공 여부
   */
  deleteSession(clientId: string): boolean {
    const session = this.sessions.get(clientId);
    if (!session) {
      return false;
    }

    // Claude 프로세스 정리
    this.killProcess(session.claudeProcess);

    this.sessions.delete(clientId);
    console.log(`🗑️ 세션 삭제: ${session.sessionId}`);

    return true;
  }

  /**
   * 세션 재설정 (새 UUID 발급, 프로세스 정리)
   * end_session 이벤트에서 사용
   * @param clientId - 클라이언트 Socket ID
   * @returns 새로 생성된 세션 (기존 세션 없으면 null)
   */
  resetSession(clientId: string): Session | null {
    const oldSession = this.sessions.get(clientId);
    if (!oldSession) {
      return null;
    }

    // 기존 프로세스 정리
    this.killProcess(oldSession.claudeProcess);

    // 새 세션 생성 (projectPath 유지)
    const newSession: Session = {
      sessionId: uuidv4(),
      claudeProcess: null,
      projectPath: oldSession.projectPath,
      isFirstPrompt: true,
    };

    this.sessions.set(clientId, newSession);
    console.log(`🔄 세션 재생성: ${newSession.sessionId}`);

    return newSession;
  }

  /**
   * 세션 Claude 프로세스 업데이트
   * @param clientId - 클라이언트 Socket ID
   * @param claudeProcess - Claude 프로세스 (null이면 정리)
   */
  updateClaudeProcess(
    clientId: string,
    claudeProcess: ChildProcess | null,
  ): void {
    const session = this.sessions.get(clientId);
    if (session) {
      session.claudeProcess = claudeProcess;
    }
  }

  /**
   * 첫 프롬프트 상태 사용됨으로 표시
   * @param clientId - 클라이언트 Socket ID
   */
  markFirstPromptUsed(clientId: string): void {
    const session = this.sessions.get(clientId);
    if (session) {
      session.isFirstPrompt = false;
    }
  }

  /**
   * 세션 정보 조회 (민감 정보 제외)
   * @param clientId - 클라이언트 Socket ID
   * @returns 세션 정보 (없으면 null)
   */
  getSessionInfo(clientId: string): SessionInfo | null {
    const session = this.sessions.get(clientId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      projectPath: session.projectPath,
      isFirstPrompt: session.isFirstPrompt,
      hasActiveProcess: session.claudeProcess !== null,
    };
  }

  /**
   * 활성 세션 수 반환
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 기존 Claude 프로세스 종료
   * 새 프롬프트 시작 전에 호출
   */
  killExistingProcess(clientId: string): void {
    const session = this.sessions.get(clientId);
    if (session?.claudeProcess) {
      this.killProcess(session.claudeProcess);
      session.claudeProcess = null;
    }
  }

  /**
   * 프로세스 안전 종료 (ClaudeService 위임)
   * @param process - ChildProcess 인스턴스
   */
  private killProcess(process: ChildProcess | null): void {
    if (!process) return;
    this.claudeService.killProcess(process);
  }
}
