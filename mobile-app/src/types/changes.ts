/**
 * 파일 변경사항 관련 타입 정의
 * PC Agent의 changes.interface.ts와 동기화
 */

/**
 * 파일 변경 타입
 */
export type ChangeType = 'create' | 'edit' | 'delete';

/**
 * 변경 상태
 */
export type ChangeStatus = 'pending' | 'approved' | 'rejected';

/**
 * 변경 출처
 */
export type ChangeSource = 'claude' | 'manual';

/**
 * Diff Hunk (변경 블록)
 */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[]; // '+', '-', ' ' 접두사 포함
}

/**
 * 파일 변경 기록
 */
export interface FileChange {
  id: string;
  type: ChangeType;
  filePath: string;
  absolutePath: string;
  originalContent: string | null;
  newContent: string | null;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  timestamp: string; // ISO 문자열
  status: ChangeStatus;
  source: ChangeSource;
}

/**
 * 변경 목록 응답
 */
export interface ChangesListResult {
  changes: FileChange[];
  totalCount: number;
  pendingCount: number;
}

/**
 * 파일 변경 알림 (file_changed 이벤트)
 */
export interface FileChangedEvent {
  id: string;
  type: ChangeType;
  filePath: string;
  additions: number;
  deletions: number;
}

/**
 * 변경 액션 결과
 */
export interface ChangeActionResult {
  success: boolean;
  changeId: string;
  action: 'approved' | 'rejected';
  filePath?: string;
  error?: string;
}
