/**
 * Claude CLI 설정 상수
 * spawn + stream-json 방식으로 Claude CLI 실행
 */
export const CLAUDE_CLI_CONFIG = {
  /** Claude CLI 명령어 */
  COMMAND: 'claude',
  /** 기본 옵션들 */
  BASE_OPTIONS: [
    '-p', // print 모드 (비대화형)
    '--dangerously-skip-permissions', // 권한 체크 우회
    '--output-format',
    'stream-json', // JSON 스트리밍 출력
    '--verbose', // stream-json에 필요
  ],
} as const;

/**
 * Claude CLI 응답 타입
 */
export const CLAUDE_RESPONSE_TYPES = {
  SYSTEM: 'system',
  ASSISTANT: 'assistant',
  RESULT: 'result',
} as const;

/**
 * WebSocket CORS 설정
 */
export const CORS_CONFIG = {
  /** 허용할 origin (* = 모든 origin) */
  ORIGIN: '*',
} as const;
