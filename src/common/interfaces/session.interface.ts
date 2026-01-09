/**
 * 세션 관련 인터페이스 정의
 */

import type { IPty } from 'node-pty';

/**
 * 클라이언트 세션 정보
 */
export interface Session {
  /** Claude용 세션 UUID */
  sessionId: string;
  /** 현재 실행 중인 Claude PTY 프로세스 */
  claudeProcess: IPty | null;
  /** 프로젝트 경로 */
  projectPath: string;
  /** 첫 번째 프롬프트 여부 (세션 시작 vs 이어가기 구분) */
  isFirstPrompt: boolean;
}

/**
 * 세션 생성 옵션
 */
export interface CreateSessionOptions {
  /** 프로젝트 경로 (미지정 시 현재 작업 디렉토리) */
  projectPath?: string;
}

/**
 * 세션 정보 (민감 정보 제외)
 */
export interface SessionInfo {
  /** 세션 UUID */
  sessionId: string;
  /** 프로젝트 경로 */
  projectPath: string;
  /** 첫 번째 프롬프트 여부 */
  isFirstPrompt: boolean;
  /** 활성 프로세스 존재 여부 */
  hasActiveProcess: boolean;
}
