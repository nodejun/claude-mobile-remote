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
 * Claude CLI stream_event 응답
 * 토큰 단위 실시간 스트리밍 (--include-partial-messages 옵션 사용 시)
 */
export interface ClaudeStreamEventResponse {
  type: 'stream_event';
  event: {
    type: string; // 'content_block_delta', 'content_block_start', 'content_block_stop' 등
    index?: number;
    delta?: {
      type: string; // 'text_delta', 'thinking_delta' 등
      text?: string;
    };
    content_block?: {
      type: string;
      text?: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * 파일 변경 결과 타입
 * Claude가 파일을 생성/수정/삭제할 때 반환되는 정보
 */
export interface ToolUseResult {
  type: 'create' | 'edit' | 'delete';
  filePath: string;
  content: string | null;
  structuredPatch: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }>;
  originalFile: string | null;
}

/**
 * Claude CLI user 응답 (tool_result)
 * 도구 실행 결과를 포함하는 응답
 */
export interface ClaudeUserResponse {
  type: 'user';
  message: {
    role: 'user';
    content: Array<{
      tool_use_id: string;
      type: 'tool_result';
      content: string;
    }>;
  };
  tool_use_result?: ToolUseResult;
  session_id: string;
  [key: string]: unknown;
}

/**
 * Claude CLI 응답 유니온 타입
 */
export type ClaudeResponse =
  | ClaudeSystemResponse
  | ClaudeAssistantResponse
  | ClaudeResultResponse
  | ClaudeStreamEventResponse
  | ClaudeUserResponse;
