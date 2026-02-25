/**
 * 파일 시스템 관련 인터페이스 정의
 */

/**
 * 파일/폴더 엔트리 정보
 */
export interface FileEntry {
  /** 파일/폴더 이름 */
  name: string;
  /** 절대 경로 */
  path: string;
  /** 프로젝트 루트 기준 상대 경로 */
  relativePath: string;
  /** 디렉토리 여부 */
  isDirectory: boolean;
}

/**
 * 파일 트리 조회 결과
 */
export interface FileTreeResult {
  /** 조회한 절대 경로 */
  path: string;
  /** 프로젝트 루트 기준 상대 경로 */
  relativePath: string;
  /** 하위 파일/폴더 목록 */
  children: FileEntry[];
}

/**
 * 파일 내용 조회 결과
 */
export interface FileContentResult {
  /** 파일 절대 경로 */
  filePath: string;
  /** 프로젝트 루트 기준 상대 경로 */
  relativePath: string;
  /** 파일 내용 */
  content: string;
  /** 감지된 언어 */
  language: string;
  /** 파일 크기 (bytes) */
  size: number;
  /** 마지막 수정 시간 (ISO 문자열) */
  lastModified: string;
}

/**
 * 파일 저장 요청
 */
export interface SaveFileRequest {
  /** 파일 경로 (상대 또는 절대) */
  filePath: string;
  /** 저장할 내용 */
  content: string;
}

/**
 * 파일 저장 결과
 */
export interface SaveFileResult {
  /** 성공 여부 */
  success: boolean;
  /** 저장된 파일 경로 */
  filePath: string;
  /** 저장된 파일 크기 */
  size: number;
}

/**
 * 파일 작업 에러 코드
 */
export enum FileOperationError {
  PATH_VALIDATION_FAILED = 'PATH_VALIDATION_FAILED', // 경로 검증 실패
  FILE_EXISTS = 'FILE_EXISTS', // 파일 이미 존재
  FILE_NOT_FOUND = 'FILE_NOT_FOUND', // 파일 없음
  PERMISSION_DENIED = 'PERMISSION_DENIED', // 권한 없음
  DIRECTORY_NOT_EMPTY = 'DIRECTORY_NOT_EMPTY', // 폴더가 비어있지 않음
  INVALID_FILE_NAME = 'INVALID_FILE_NAME', // 잘못된 파일명
  UNKNOWN_ERROR = 'UNKNOWN_ERROR', // 알 수 없는 에러
}

/**
 * 파일 작업 요청
 */
export interface FileOperationRequest {
  /** 파일 경로 (상대 경로) */
  filePath: string;
  /** 새 이름 (rename용) */
  newName?: string;
  /** 디렉토리 여부 (create용) */
  isDirectory?: boolean;
  /** 파일 내용 (create용, 선택사항) */
  content?: string;
}

/**
 * 파일 작업 결과
 */
export interface FileOperationResult {
  /** 성공 여부 */
  success: boolean;
  /** 작업 대상 파일 경로 */
  filePath: string;
  /** 에러 정보 (실패 시) */
  error?: {
    code: FileOperationError;
    message: string;
  };
}

/**
 * 검색 요청
 */
export interface SearchRequest {
  /** 검색어 */
  query: string;
  /** 검색 타입: filename(파일명), content(파일 내용) */
  type: 'filename' | 'content';
  /** 검색 시작 경로 (상대 경로, 미지정 시 루트) */
  path?: string;
}

/**
 * 검색 매치 항목
 */
export interface SearchMatch {
  /** 파일 이름 */
  name: string;
  /** 프로젝트 루트 기준 상대 경로 */
  relativePath: string;
  /** 디렉토리 여부 */
  isDirectory: boolean;
  /** 매칭된 라인 목록 (content 검색 시) */
  matches?: {
    /** 줄 번호 */
    line: number;
    /** 해당 줄 내용 (미리보기) */
    text: string;
  }[];
}

/**
 * 검색 결과
 */
export interface SearchResult {
  /** 검색어 */
  query: string;
  /** 검색 타입 */
  type: 'filename' | 'content';
  /** 매칭 결과 목록 */
  results: SearchMatch[];
  /** 전체 매칭 수 */
  totalCount: number;
}
