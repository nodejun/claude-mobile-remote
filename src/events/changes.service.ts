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
} from '#interfaces/changes.interface';
import type { ToolUseResult } from '#interfaces/claude.interface';

/**
 * 파일 변경사항 추적 서비스
 * Claude가 파일을 수정하거나 사용자가 수동 편집할 때 변경사항을 추적
 */
@Injectable()
export class ChangesService {
  // 클라이언트별 변경사항 저장 (Map<clientId, FileChange[]>)
  private changesMap = new Map<string, FileChange[]>();

  /**
   * Claude tool_use 결과로부터 변경사항 추적
   * @param clientId - 클라이언트 ID
   * @param projectPath - 프로젝트 루트 경로
   * @param toolResult - Claude tool_use_result
   */
  trackFromToolUse(
    clientId: string,
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

    const change: FileChange = {
      id: uuidv4(),
      type: toolResult.type,
      filePath: relativePath,
      absolutePath: absolutePath,
      originalContent: toolResult.originalFile,
      newContent: toolResult.content,
      hunks: this.convertToHunks(toolResult.structuredPatch),
      additions: this.countAdditions(toolResult.structuredPatch),
      deletions: this.countDeletions(toolResult.structuredPatch),
      timestamp: new Date(),
      status: 'pending',
      source: 'claude',
    };

    this.addChange(clientId, change);
    console.log(
      `📝 변경 추적: [${change.type}] ${change.filePath} (+${change.additions} -${change.deletions})`,
    );

    return change;
  }

  /**
   * 수동 편집으로 인한 변경사항 추적
   * @param clientId - 클라이언트 ID
   * @param projectPath - 프로젝트 루트 경로
   * @param filePath - 파일 경로 (상대 또는 절대)
   * @param originalContent - 원본 내용
   * @param newContent - 새 내용
   */
  trackManualEdit(
    clientId: string,
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

    this.addChange(clientId, change);
    console.log(
      `✏️ 수동 편집 추적: [${change.type}] ${change.filePath} (+${change.additions} -${change.deletions})`,
    );

    return change;
  }

  /**
   * 변경사항 목록 조회
   * @param clientId - 클라이언트 ID
   */
  getChanges(clientId: string): ChangesListResult {
    const changes = this.changesMap.get(clientId) || [];
    const pendingCount = changes.filter((c) => c.status === 'pending').length;

    return {
      changes: changes.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      ),
      totalCount: changes.length,
      pendingCount,
    };
  }

  /**
   * 특정 변경사항 조회
   * @param clientId - 클라이언트 ID
   * @param changeId - 변경 ID
   */
  getChange(clientId: string, changeId: string): FileChange | null {
    const changes = this.changesMap.get(clientId) || [];
    return changes.find((c) => c.id === changeId) || null;
  }

  /**
   * 변경 승인
   * @param clientId - 클라이언트 ID
   * @param changeId - 변경 ID
   */
  approveChange(clientId: string, changeId: string): ChangeActionResult {
    const change = this.getChange(clientId, changeId);
    if (!change) {
      return {
        success: false,
        changeId,
        action: 'approved',
        error: 'Change not found',
      };
    }

    change.status = 'approved';
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
   * @param clientId - 클라이언트 ID
   * @param changeId - 변경 ID
   */
  rejectChange(clientId: string, changeId: string): ChangeActionResult {
    const change = this.getChange(clientId, changeId);
    if (!change) {
      return {
        success: false,
        changeId,
        action: 'rejected',
        error: 'Change not found',
      };
    }

    try {
      // 원본으로 복원
      if (change.type === 'create') {
        // 생성된 파일 삭제
        if (fs.existsSync(change.absolutePath)) {
          fs.unlinkSync(change.absolutePath);
        }
      } else if (change.type === 'edit' && change.originalContent !== null) {
        // 원본 내용으로 복원
        fs.writeFileSync(change.absolutePath, change.originalContent, 'utf-8');
      } else if (change.type === 'delete' && change.originalContent !== null) {
        // 삭제된 파일 복원
        fs.writeFileSync(change.absolutePath, change.originalContent, 'utf-8');
      }

      change.status = 'rejected';
      console.log(`❌ 변경 거부 (복원됨): ${change.filePath}`);

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
   * 클라이언트의 모든 변경사항 삭제
   * @param clientId - 클라이언트 ID
   */
  clearChanges(clientId: string): void {
    this.changesMap.delete(clientId);
    console.log(`🗑️ 변경사항 초기화: ${clientId}`);
  }

  // ===== Private Methods =====

  /**
   * 변경사항 추가
   */
  private addChange(clientId: string, change: FileChange): void {
    const changes = this.changesMap.get(clientId) || [];
    changes.push(change);
    this.changesMap.set(clientId, changes);
  }

  /**
   * structuredPatch를 DiffHunk로 변환
   */
  private convertToHunks(
    structuredPatch: ToolUseResult['structuredPatch'],
  ): DiffHunk[] {
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
    return structuredPatch.reduce((count, patch) => {
      return (
        count + patch.lines.filter((line) => line.startsWith('+')).length
      );
    }, 0);
  }

  /**
   * 삭제된 줄 수 계산
   */
  private countDeletions(
    structuredPatch: ToolUseResult['structuredPatch'],
  ): number {
    return structuredPatch.reduce((count, patch) => {
      return (
        count + patch.lines.filter((line) => line.startsWith('-')).length
      );
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
   * TODO: 더 정교한 diff 알고리즘 적용 가능
   */
  private generateDiff(original: string, modified: string): DiffHunk[] {
    const originalLines = original ? original.split('\n') : [];
    const modifiedLines = modified ? modified.split('\n') : [];

    // 간단한 라인 비교 (전체를 하나의 hunk로)
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
