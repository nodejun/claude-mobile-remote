import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

import type {
  FileChange,
  ChangeType,
  DiffHunk,
  ChangesListResult,
  ChangeActionResult,
  DeleteChangeResult,
} from '#interfaces/changes.interface';
import type { ToolUseResult } from '#interfaces/claude.interface';

/** 파일 저장용 직렬화 형태 (Date → string) */
interface SerializedFileChange extends Omit<FileChange, 'timestamp'> {
  timestamp: string;
}

/** 변경사항 저장 파일명 */
const CHANGES_FILENAME = '.claude-changes.json';

/**
 * 파일 변경사항 추적 서비스
 * - projectPath를 키로 사용 (클라이언트가 바뀌어도 같은 프로젝트의 변경사항 유지)
 * - .claude-changes.json 파일에 영속 저장 (앱 재시작 후에도 유지)
 */
@Injectable()
export class ChangesService {
  // 프로젝트별 변경사항 캐시 (Map<projectPath, FileChange[]>)
  private changesMap = new Map<string, FileChange[]>();

  /**
   * Claude tool_use 결과로부터 변경사항 추적
   * @param projectPath - 프로젝트 루트 경로 (키로 사용)
   * @param toolResult - Claude tool_use_result
   */
  trackFromToolUse(
    projectPath: string,
    toolResult: ToolUseResult,
  ): FileChange | null {
    // 파일 변경이 아닌 경우 무시
    if (!toolResult.filePath) {
      return null;
    }

    const absolutePath = toolResult.filePath;
    const relativePath = path.relative(projectPath, absolutePath);

    // 프로젝트 외부 파일은 무시
    if (relativePath.startsWith('..')) {
      console.log(`⚠️ 프로젝트 외부 파일 변경 무시: ${relativePath}`);
      return null;
    }

    // 변경 타입: Claude CLI가 제공하는 type 우선 사용, 없으면 추론
    let changeType: ChangeType;
    if (toolResult.type) {
      changeType = toolResult.type;
    } else {
      changeType = toolResult.originalFile ? 'edit' : 'create';
    }

    // 새 내용: create/edit 타입은 파일에서 읽음 (전체 보기용)
    let newContent: string | null = null;
    if (changeType === 'create' || changeType === 'edit') {
      if (fs.existsSync(absolutePath)) {
        try {
          newContent = fs.readFileSync(absolutePath, 'utf-8');
        } catch {
          newContent = toolResult.content || toolResult.newString || null;
        }
      } else {
        newContent = toolResult.content || toolResult.newString || null;
      }
    }

    const change: FileChange = {
      id: uuidv4(),
      type: changeType,
      filePath: relativePath,
      absolutePath: absolutePath,
      originalContent: toolResult.originalFile ?? null,
      newContent: newContent,
      hunks: this.convertToHunks(toolResult.structuredPatch || []),
      additions: this.countAdditions(toolResult.structuredPatch || []),
      deletions: this.countDeletions(toolResult.structuredPatch || []),
      timestamp: new Date(),
      status: 'pending',
      source: 'claude',
    };

    this.addChange(projectPath, change);
    console.log(
      `📝 변경 추적: [${change.type}] ${change.filePath} (+${change.additions} -${change.deletions})`,
    );

    return change;
  }

  /**
   * 수동 편집으로 인한 변경사항 추적
   * @param projectPath - 프로젝트 루트 경로
   * @param filePath - 파일 경로 (상대 또는 절대)
   * @param originalContent - 원본 내용
   * @param newContent - 새 내용
   */
  trackManualEdit(
    projectPath: string,
    filePath: string,
    originalContent: string,
    newContent: string,
  ): FileChange {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(projectPath, filePath);
    const relativePath = path.relative(projectPath, absolutePath);

    const type: ChangeType = originalContent ? 'edit' : 'create';
    const hunks = this.generateDiff(originalContent, newContent);

    const change: FileChange = {
      id: uuidv4(),
      type,
      filePath: relativePath,
      absolutePath,
      originalContent,
      newContent,
      hunks,
      additions: this.countAdditionsFromHunks(hunks),
      deletions: this.countDeletionsFromHunks(hunks),
      timestamp: new Date(),
      status: 'pending',
      source: 'manual',
    };

    this.addChange(projectPath, change);
    console.log(
      `✏️ 수동 편집 추적: [${change.type}] ${change.filePath} (+${change.additions} -${change.deletions})`,
    );

    return change;
  }

  /**
   * 변경사항 목록 조회
   * @param projectPath - 프로젝트 루트 경로
   */
  getChanges(projectPath: string): ChangesListResult {
    const changes = this.loadChanges(projectPath);
    const pendingCount = changes.filter((c) => c.status === 'pending').length;

    return {
      changes: changes.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
      totalCount: changes.length,
      pendingCount,
    };
  }

  /**
   * 특정 변경사항 조회
   * @param projectPath - 프로젝트 루트 경로
   * @param changeId - 변경 ID
   */
  getChange(projectPath: string, changeId: string): FileChange | null {
    const changes = this.loadChanges(projectPath);
    return changes.find((c) => c.id === changeId) || null;
  }

  /**
   * 변경 승인
   * @param projectPath - 프로젝트 루트 경로
   * @param changeId - 변경 ID
   */
  approveChange(projectPath: string, changeId: string): ChangeActionResult {
    const change = this.getChange(projectPath, changeId);
    if (!change) {
      return {
        success: false,
        changeId,
        action: 'approved',
        error: 'Change not found',
      };
    }

    change.status = 'approved';
    this.saveChangesToFile(projectPath);
    console.log(`✅ 변경 승인: ${change.filePath}`);

    return {
      success: true,
      changeId,
      action: 'approved',
      filePath: change.filePath,
    };
  }

  /**
   * 변경 거부 (원본으로 복원)
   * @param projectPath - 프로젝트 루트 경로
   * @param changeId - 변경 ID
   */
  rejectChange(projectPath: string, changeId: string): ChangeActionResult {
    const change = this.getChange(projectPath, changeId);
    if (!change) {
      return {
        success: false,
        changeId,
        action: 'rejected',
        error: 'Change not found',
      };
    }

    try {
      console.log(`🔄 복원 시도: [${change.type}] ${change.filePath}`);

      // 원본으로 복원
      if (change.type === 'create') {
        if (fs.existsSync(change.absolutePath)) {
          fs.unlinkSync(change.absolutePath);
        }
      } else if (change.type === 'edit') {
        if (change.originalContent !== null) {
          fs.writeFileSync(
            change.absolutePath,
            change.originalContent,
            'utf-8',
          );
        }
      } else if (change.type === 'delete') {
        if (change.originalContent !== null) {
          fs.writeFileSync(
            change.absolutePath,
            change.originalContent,
            'utf-8',
          );
        }
      }

      change.status = 'rejected';
      this.saveChangesToFile(projectPath);
      console.log(`❌ 변경 거부 완료: ${change.filePath}`);

      return {
        success: true,
        changeId,
        action: 'rejected',
        filePath: change.filePath,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ 복원 실패: ${change.filePath}`, error);

      return {
        success: false,
        changeId,
        action: 'rejected',
        error: errorMessage,
      };
    }
  }

  /**
   * 개별 변경사항 삭제 (승인/거부 완료된 항목만)
   * @param projectPath - 프로젝트 루트 경로
   * @param changeId - 변경 ID
   */
  deleteChange(projectPath: string, changeId: string): DeleteChangeResult {
    const changes = this.loadChanges(projectPath);
    const index = changes.findIndex((c) => c.id === changeId);

    if (index === -1) {
      return { success: false, deletedCount: 0, error: 'Change not found' };
    }

    const change = changes[index];
    if (change.status === 'pending') {
      return {
        success: false,
        deletedCount: 0,
        error:
          '대기 중인 변경사항은 삭제할 수 없습니다. 먼저 승인 또는 거부해주세요.',
      };
    }

    changes.splice(index, 1);
    this.changesMap.set(projectPath, changes);
    this.saveChangesToFile(projectPath);
    console.log(`🗑️ 변경 삭제: ${change.filePath}`);

    return { success: true, deletedCount: 1 };
  }

  /**
   * 처리 완료된 모든 변경사항 삭제 (승인/거부 완료 항목 일괄 삭제)
   * @param projectPath - 프로젝트 루트 경로
   */
  deleteResolvedChanges(projectPath: string): DeleteChangeResult {
    const changes = this.loadChanges(projectPath);
    const pendingChanges = changes.filter((c) => c.status === 'pending');
    const deletedCount = changes.length - pendingChanges.length;

    this.changesMap.set(projectPath, pendingChanges);
    this.saveChangesToFile(projectPath);
    console.log(`🗑️ 처리 완료 변경사항 일괄 삭제: ${deletedCount}개 삭제됨`);

    return { success: true, deletedCount };
  }

  /**
   * 프로젝트의 모든 변경사항 삭제
   * @param projectPath - 프로젝트 루트 경로
   */
  clearChanges(projectPath: string): void {
    this.changesMap.delete(projectPath);
    this.deleteChangesFile(projectPath);
    console.log(`🗑️ 변경사항 전체 초기화: ${projectPath}`);
  }

  // ===== Private Methods =====

  /**
   * 변경사항 추가 (메모리 + 파일)
   */
  private addChange(projectPath: string, change: FileChange): void {
    const changes = this.loadChanges(projectPath);
    changes.push(change);
    this.changesMap.set(projectPath, changes);
    this.saveChangesToFile(projectPath);
  }

  /**
   * 변경사항 로드 (메모리 캐시 우선, 없으면 파일에서)
   */
  private loadChanges(projectPath: string): FileChange[] {
    // 메모리에 있으면 그대로 반환
    if (this.changesMap.has(projectPath)) {
      return this.changesMap.get(projectPath)!;
    }

    // 파일에서 로드
    const changes = this.loadChangesFromFile(projectPath);
    this.changesMap.set(projectPath, changes);
    return changes;
  }

  /**
   * .claude-changes.json 파일에서 변경사항 로드
   */
  private loadChangesFromFile(projectPath: string): FileChange[] {
    const filePath = path.join(projectPath, CHANGES_FILENAME);

    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const serialized: SerializedFileChange[] = JSON.parse(raw);

      // timestamp string → Date 변환
      return serialized.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
    } catch (error) {
      console.error(`⚠️ 변경사항 파일 로드 실패: ${filePath}`, error);
      return [];
    }
  }

  /**
   * .claude-changes.json 파일에 변경사항 저장
   */
  private saveChangesToFile(projectPath: string): void {
    const filePath = path.join(projectPath, CHANGES_FILENAME);
    const changes = this.changesMap.get(projectPath) || [];

    try {
      // FileChange → 직렬화 (Date → ISO string)
      const serialized: SerializedFileChange[] = changes.map((c) => ({
        ...c,
        timestamp:
          c.timestamp instanceof Date
            ? c.timestamp.toISOString()
            : String(c.timestamp),
      }));

      fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
    } catch (error) {
      console.error(`⚠️ 변경사항 파일 저장 실패: ${filePath}`, error);
    }
  }

  /**
   * .claude-changes.json 파일 삭제
   */
  private deleteChangesFile(projectPath: string): void {
    const filePath = path.join(projectPath, CHANGES_FILENAME);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`⚠️ 변경사항 파일 삭제 실패: ${filePath}`, error);
    }
  }

  /**
   * structuredPatch를 DiffHunk로 변환
   */
  private convertToHunks(
    structuredPatch: ToolUseResult['structuredPatch'],
  ): DiffHunk[] {
    if (!structuredPatch) return [];
    return structuredPatch.map((patch) => ({
      oldStart: patch.oldStart,
      oldLines: patch.oldLines,
      newStart: patch.newStart,
      newLines: patch.newLines,
      lines: patch.lines,
    }));
  }

  /**
   * 추가된 줄 수 계산
   */
  private countAdditions(
    structuredPatch: ToolUseResult['structuredPatch'],
  ): number {
    if (!structuredPatch) return 0;
    return structuredPatch.reduce((count, patch) => {
      return count + patch.lines.filter((line) => line.startsWith('+')).length;
    }, 0);
  }

  /**
   * 삭제된 줄 수 계산
   */
  private countDeletions(
    structuredPatch: ToolUseResult['structuredPatch'],
  ): number {
    if (!structuredPatch) return 0;
    return structuredPatch.reduce((count, patch) => {
      return count + patch.lines.filter((line) => line.startsWith('-')).length;
    }, 0);
  }

  /**
   * DiffHunk에서 추가된 줄 수 계산
   */
  private countAdditionsFromHunks(hunks: DiffHunk[]): number {
    return hunks.reduce((count, hunk) => {
      return count + hunk.lines.filter((line) => line.startsWith('+')).length;
    }, 0);
  }

  /**
   * DiffHunk에서 삭제된 줄 수 계산
   */
  private countDeletionsFromHunks(hunks: DiffHunk[]): number {
    return hunks.reduce((count, hunk) => {
      return count + hunk.lines.filter((line) => line.startsWith('-')).length;
    }, 0);
  }

  /**
   * 간단한 diff 생성 (수동 편집용)
   */
  private generateDiff(original: string, modified: string): DiffHunk[] {
    const originalLines = original ? original.split('\n') : [];
    const modifiedLines = modified ? modified.split('\n') : [];

    const lines: string[] = [];
    originalLines.forEach((line) => lines.push(`-${line}`));
    modifiedLines.forEach((line) => lines.push(`+${line}`));

    return [
      {
        oldStart: 1,
        oldLines: originalLines.length,
        newStart: 1,
        newLines: modifiedLines.length,
        lines,
      },
    ];
  }
}
