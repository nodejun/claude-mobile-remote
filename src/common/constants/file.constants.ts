/**
 * 파일 시스템 관련 상수
 */
export const FILE_CONFIG = {
  /** 최대 파일 크기 (1MB) */
  MAX_FILE_SIZE: 1024 * 1024,
  /** 제외할 디렉토리 목록 */
  EXCLUDED_DIRS: ['node_modules', 'dist', '.git'] as readonly string[],
  /** 숨김 파일 접두사 */
  HIDDEN_PREFIX: '.',
  /** 기본 인코딩 */
  DEFAULT_ENCODING: 'utf-8' as BufferEncoding,
} as const;

/**
 * 파일 작업 에러 메시지
 */
export const FILE_ERROR_MESSAGES = {
  NO_SESSION: 'No session found',
  FILE_PATH_REQUIRED: 'filePath is required',
  FILE_PATH_AND_CONTENT_REQUIRED: 'filePath and content are required',
  ACCESS_DENIED: 'Access denied: path outside project',
  CANNOT_READ_DIRECTORY: 'Cannot read directory as file',
  FILE_TOO_LARGE: 'File too large (max 1MB)',
  FAILED_READ_DIRECTORY: 'Failed to read directory',
  FAILED_READ_FILE: 'Failed to read file',
  FAILED_SAVE_FILE: 'Failed to save file',
} as const;
