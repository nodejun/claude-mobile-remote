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
