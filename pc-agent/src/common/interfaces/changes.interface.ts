/**
 * 파일 변경사항 추적 관련 인터페이스
 */

/**
 * 파일 변경 타입
 */
export type ChangeType = 'create' | 'edit' | 'delete';

/**
 * Diff Hunk (변경 블록)
 * unified diff 형식의 한 블록
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
 * 하나의 파일에 대한 변경 정보
 */
export interface FileChange {
  id: string; // 고유 ID (UUID)
  type: ChangeType;
  filePath: string; // 상대 경로
  absolutePath: string; // 절대 경로
  originalContent: string | null; // 변경 전 내용 (create 시 null)
  newContent: string | null; // 변경 후 내용 (delete 시 null)
  hunks: DiffHunk[]; // diff 정보
  additions: number; // 추가된 줄 수
  deletions: number; // 삭제된 줄 수
  timestamp: Date; // 변경 시간
  status: 'pending' | 'approved' | 'rejected'; // 승인 상태
  source: 'claude' | 'manual'; // 변경 출처 (Claude or 수동 편집)
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
 * 변경 승인/거부 요청
 */
export interface ChangeActionPayload {
  changeId: string;
}

/**
 * 변경 승인/거부 결과
 */
export interface ChangeActionResult {
  success: boolean;
  changeId: string;
  action: 'approved' | 'rejected';
  filePath?: string;
  error?: string;
}

/**
 * 변경 삭제 요청 (개별 또는 일괄)
 */
export interface DeleteChangePayload {
  changeId?: string; // 개별 삭제 시
  deleteAll?: boolean; // 처리 완료된 항목 일괄 삭제 시
}

/**
 * 변경 삭제 결과
 */
export interface DeleteChangeResult {
  success: boolean;
  deletedCount: number;
  error?: string;
}
