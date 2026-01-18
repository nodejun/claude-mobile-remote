import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { FILE_CONFIG, FILE_ERROR_MESSAGES } from '#constants/file.constants';
import { detectLanguage } from '#utils/language.util';
import {
  FileEntry,
  FileTreeResult,
  FileContentResult,
  SaveFileResult,
} from '#interfaces/file.interface';

/**
 * 파일 시스템 서비스
 * 파일 트리 조회, 파일 내용 읽기/쓰기, 보안 검증 담당
 */
@Injectable()
export class FileService {
  /**
   * 경로 보안 검증 (basePath 내부인지 확인)
   * @param basePath - 허용된 기본 경로
   * @param targetPath - 검증할 대상 경로
   * @returns 유효하면 true
   */
  validatePath(basePath: string, targetPath: string): boolean {
    const normalizedBase = path.normalize(basePath);
    const normalizedTarget = path.normalize(targetPath);
    return normalizedTarget.startsWith(normalizedBase);
  }

  /**
   * 파일/폴더 엔트리 필터링
   * 숨김 파일, node_modules, package-lock.json 등 제외
   */
  private filterEntries(entries: fs.Dirent[]): fs.Dirent[] {
    return entries
      .filter((entry) => !entry.name.startsWith(FILE_CONFIG.HIDDEN_PREFIX))
      .filter((entry) => !FILE_CONFIG.EXCLUDED_DIRS.includes(entry.name))
      .filter((entry) => !FILE_CONFIG.EXCLUDED_FILES.includes(entry.name));
  }

  /**
   * 파일/폴더 정렬 (폴더 먼저, 알파벳 순)
   */
  private sortEntries(entries: FileEntry[]): FileEntry[] {
    return entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 디렉토리 내용 조회
   * @param basePath - 프로젝트 루트 경로
   * @param targetPath - 조회할 대상 경로 (미지정 시 basePath)
   * @returns 파일 트리 결과
   */
  getFileTree(basePath: string, targetPath?: string): FileTreeResult {
    const resolvedPath = targetPath
      ? path.resolve(basePath, targetPath)
      : basePath;

    // 보안 검증
    if (!this.validatePath(basePath, resolvedPath)) {
      throw new Error(FILE_ERROR_MESSAGES.ACCESS_DENIED);
    }

    // 디렉토리 내용 읽기
    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const filteredEntries = this.filterEntries(entries);

    // 파일/폴더 정보 변환
    const children: FileEntry[] = filteredEntries.map((entry) => ({
      name: entry.name,
      path: path.join(resolvedPath, entry.name),
      relativePath: path.relative(
        basePath,
        path.join(resolvedPath, entry.name),
      ),
      isDirectory: entry.isDirectory(),
    }));

    return {
      path: resolvedPath,
      relativePath: path.relative(basePath, resolvedPath) || '.',
      children: this.sortEntries(children),
    };
  }

  /**
   * 파일 내용 읽기
   * @param basePath - 프로젝트 루트 경로
   * @param filePath - 읽을 파일 경로 (상대 또는 절대)
   * @returns 파일 내용 결과
   */
  getFileContent(basePath: string, filePath: string): FileContentResult {
    // 상대 경로인 경우 프로젝트 경로 기준으로 변환
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(basePath, filePath);

    // 보안 검증
    if (!this.validatePath(basePath, resolvedPath)) {
      throw new Error(FILE_ERROR_MESSAGES.ACCESS_DENIED);
    }

    // 파일 존재 및 타입 확인
    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) {
      throw new Error(FILE_ERROR_MESSAGES.CANNOT_READ_DIRECTORY);
    }

    // 파일 크기 제한
    if (stats.size > FILE_CONFIG.MAX_FILE_SIZE) {
      throw new Error(FILE_ERROR_MESSAGES.FILE_TOO_LARGE);
    }

    // 파일 내용 읽기
    const content = fs.readFileSync(resolvedPath, FILE_CONFIG.DEFAULT_ENCODING);
    const language = detectLanguage(resolvedPath);

    return {
      filePath: resolvedPath,
      relativePath: path.relative(basePath, resolvedPath),
      content,
      language,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  }

  /**
   * 파일 저장
   * @param basePath - 프로젝트 루트 경로
   * @param filePath - 저장할 파일 경로 (상대 또는 절대)
   * @param content - 저장할 내용
   * @returns 저장 결과
   */
  saveFile(
    basePath: string,
    filePath: string,
    content: string,
  ): SaveFileResult {
    // 상대 경로인 경우 프로젝트 경로 기준으로 변환
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(basePath, filePath);

    // 보안 검증
    if (!this.validatePath(basePath, resolvedPath)) {
      throw new Error(FILE_ERROR_MESSAGES.ACCESS_DENIED);
    }

    // 파일 저장
    fs.writeFileSync(resolvedPath, content, FILE_CONFIG.DEFAULT_ENCODING);
    const stats = fs.statSync(resolvedPath);

    return {
      success: true,
      filePath: resolvedPath,
      size: stats.size,
    };
  }
}
