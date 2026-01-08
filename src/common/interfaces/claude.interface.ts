/**
 * Claude CLI 관련 인터페이스 정의
 */

/**
 * Claude CLI system 응답
 * 세션 초기화 시 반환되는 정보
 */
export interface ClaudeSystemResponse {
  type: 'system';
  session_id: string;
  tools: string[];
  model: string;
  [key: string]: unknown;
}

/**
 * Claude CLI assistant 응답
 * 실시간 스트리밍 응답 청크
 */
export interface ClaudeAssistantResponse {
  type: 'assistant';
  message: {
    content: Array<{ type: string; text?: string }>;
    [key: string]: unknown;
  };
  session_id: string;
  [key: string]: unknown;
}

/**
 * Claude CLI result 응답
 * 최종 결과 (성공/에러)
 */
export interface ClaudeResultResponse {
  type: 'result';
  subtype: 'success' | 'error';
  result: string;
  session_id: string;
  is_error: boolean;
  [key: string]: unknown;
}

/**
 * Claude CLI 응답 유니온 타입
 */
export type ClaudeResponse =
  | ClaudeSystemResponse
  | ClaudeAssistantResponse
  | ClaudeResultResponse;
