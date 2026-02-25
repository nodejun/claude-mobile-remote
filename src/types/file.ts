/**
 * 파일 시스템 관련 타입 정의
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
  /** UI용: 폴더 펼침 상태 */
  isExpanded?: boolean;
  /** UI용: 하위 파일 목록 (폴더인 경우) */
  children?: FileEntry[];
  /** UI용: 로딩 중 여부 */
  isLoading?: boolean;
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
