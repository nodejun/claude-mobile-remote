import { Injectable } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';

import { CLAUDE_CLI_CONFIG } from '#constants/claude.constants';
import type {
  ClaudeResponse,
  ClaudeAssistantResponse,
} from '#interfaces/claude.interface';

/**
 * Claude CLI 서비스
 * spawn + stream-json 방식으로 Claude CLI 실행 담당
 */
@Injectable()
export class ClaudeService {
  /**
   * Claude CLI 인자 배열 생성
   * @param sessionId - 세션 UUID
   * @param message - 사용자 메시지
   * @param isFirstPrompt - 첫 번째 프롬프트 여부
   * @returns Claude CLI 인자 배열
   */
  buildClaudeArgs(
    sessionId: string,
    message: string,
    isFirstPrompt: boolean,
  ): string[] {
    // as const 배열을 string[]로 변환
    const args: string[] = [...CLAUDE_CLI_CONFIG.BASE_OPTIONS];

    if (isFirstPrompt) {
      // 첫 번째 프롬프트: --session-id로 새 세션 시작
      args.push('--session-id', sessionId);
    } else {
      // 이후 프롬프트: --resume으로 기존 세션 이어가기
      args.push('--resume', sessionId);
    }

    // 메시지 추가
    args.push(message);

    return args;
  }

  /**
   * Claude CLI 프로세스 생성 및 실행
   * @param args - Claude CLI 인자 배열
   * @param cwd - 작업 디렉토리
   * @returns ChildProcess 인스턴스
   */
  spawnClaudeProcess(args: string[], cwd: string): ChildProcess {
    const claudeProcess = spawn(CLAUDE_CLI_CONFIG.COMMAND, args, {
      cwd,
      env: process.env,
      shell: true, // Windows 호환성
    });

    console.log(`🚀 Claude 프로세스 시작, PID: ${claudeProcess.pid}`);
    console.log(`📝 명령어: ${CLAUDE_CLI_CONFIG.COMMAND} ${args.join(' ')}`);

    return claudeProcess;
  }

  /**
   * JSON 라인 파싱
   * stream-json은 각 라인이 독립적인 JSON 객체
   * @param line - JSON 문자열 라인
   * @returns 파싱된 객체 또는 null
   */
  parseJsonLine(line: string): ClaudeResponse | null {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) {
      return null;
    }

    try {
      return JSON.parse(trimmed) as ClaudeResponse;
    } catch {
      console.warn('⚠️ JSON 파싱 실패:', trimmed.substring(0, 100));
      return null;
    }
  }

  /**
   * assistant 응답에서 텍스트 추출
   * @param response - Claude assistant 응답
   * @returns 추출된 텍스트
   */
  extractTextFromAssistant(response: ClaudeAssistantResponse): string {
    const textContent = response.message?.content?.find(
      (c) => c.type === 'text',
    );
    return textContent?.text || '';
  }

  /**
   * 프로세스 중단 (SIGINT 전송)
   * @param process - ChildProcess 인스턴스
   */
  interruptProcess(process: ChildProcess): void {
    try {
      process.kill('SIGINT'); // Ctrl+C와 동일
      console.log('🛑 SIGINT 전송 (응답 중단)');
    } catch (error) {
      console.error('프로세스 중단 실패:', error);
    }
  }

  /**
   * 프로세스 종료 (SIGTERM 전송)
   * @param process - ChildProcess 인스턴스
   */
  killProcess(process: ChildProcess): void {
    try {
      process.kill('SIGTERM');
      console.log('💀 Claude 프로세스 종료됨');
    } catch (error) {
      console.error('프로세스 종료 실패:', error);
    }
  }
}
