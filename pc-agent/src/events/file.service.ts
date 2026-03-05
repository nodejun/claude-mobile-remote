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
  FileOperationResult,
  FileOperationError,
  SearchRequest,
  SearchMatch,
  SearchResult,
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
   * 파일명 유효성 검사
   * @param name - 검증할 파일/폴더 이름
   * @returns 유효하면 true
   */
  private validateFileName(name: string): boolean {
    if (!name || name.trim() === '') return false;
    // Windows/Linux 공통 금지 문자 (제어 문자 포함 - 의도적)
    // eslint-disable-next-line no-control-regex
    const INVALID_CHARS = /[<>:"|?*\x00-\x1f]/;
    if (INVALID_CHARS.test(name)) return false;
    if (name === '.' || name === '..') return false;
    return true;
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

  /**
   * 파일/폴더 생성
   * @param basePath - 프로젝트 루트 경로
   * @param relativePath - 생성할 파일/폴더의 상대 경로
   * @param isDirectory - 폴더 생성 여부
   * @param content - 파일 내용 (파일인 경우, 선택사항)
   * @returns 작업 결과
   */
  createFile(
    basePath: string,
    relativePath: string,
    isDirectory: boolean,
    content?: string,
  ): FileOperationResult {
    try {
      const fullPath = path.resolve(basePath, relativePath);

      // 경로 검증
      if (!this.validatePath(basePath, fullPath)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.PATH_VALIDATION_FAILED,
            message: '잘못된 경로입니다',
          },
        };
      }

      // 파일명 검증
      const fileName = path.basename(fullPath);
      if (!this.validateFileName(fileName)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.INVALID_FILE_NAME,
            message: '사용할 수 없는 파일명입니다',
          },
        };
      }

      // 이미 존재하는지 확인
      if (fs.existsSync(fullPath)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.FILE_EXISTS,
            message: '같은 이름의 파일이 이미 존재합니다',
          },
        };
      }

      // 생성
      if (isDirectory) {
        fs.mkdirSync(fullPath, { recursive: true });
      } else {
        // 상위 디렉토리가 없으면 생성
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content || '', FILE_CONFIG.DEFAULT_ENCODING);
      }

      return {
        success: true,
        filePath: relativePath,
      };
    } catch (error) {
      return {
        success: false,
        filePath: relativePath,
        error: {
          code: FileOperationError.UNKNOWN_ERROR,
          message:
            error instanceof Error
              ? error.message
              : '알 수 없는 오류가 발생했습니다',
        },
      };
    }
  }

  /**
   * 파일/폴더 삭제
   * @param basePath - 프로젝트 루트 경로
   * @param relativePath - 삭제할 파일/폴더의 상대 경로
   * @returns 작업 결과
   */
  deleteFile(basePath: string, relativePath: string): FileOperationResult {
    try {
      const fullPath = path.resolve(basePath, relativePath);

      // 경로 검증
      if (!this.validatePath(basePath, fullPath)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.PATH_VALIDATION_FAILED,
            message: '잘못된 경로입니다',
          },
        };
      }

      // 존재 확인
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.FILE_NOT_FOUND,
            message: '파일을 찾을 수 없습니다',
          },
        };
      }

      const stats = fs.statSync(fullPath);

      // 삭제
      if (stats.isDirectory()) {
        // 폴더인 경우: 재귀적 삭제
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        // 파일인 경우
        fs.unlinkSync(fullPath);
      }

      return {
        success: true,
        filePath: relativePath,
      };
    } catch (error) {
      // 권한 에러 확인
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.PERMISSION_DENIED,
            message: '파일 접근 권한이 없습니다',
          },
        };
      }

      return {
        success: false,
        filePath: relativePath,
        error: {
          code: FileOperationError.UNKNOWN_ERROR,
          message:
            error instanceof Error
              ? error.message
              : '알 수 없는 오류가 발생했습니다',
        },
      };
    }
  }

  /**
   * 파일/폴더 이름 변경
   * @param basePath - 프로젝트 루트 경로
   * @param relativePath - 대상 파일/폴더의 상대 경로
   * @param newName - 새 이름 (경로 아닌 이름만)
   * @returns 작업 결과
   */
  renameFile(
    basePath: string,
    relativePath: string,
    newName: string,
  ): FileOperationResult {
    try {
      const oldPath = path.resolve(basePath, relativePath);

      // 경로 검증
      if (!this.validatePath(basePath, oldPath)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.PATH_VALIDATION_FAILED,
            message: '잘못된 경로입니다',
          },
        };
      }

      // 새 파일명 검증
      if (!this.validateFileName(newName)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.INVALID_FILE_NAME,
            message: '사용할 수 없는 파일명입니다',
          },
        };
      }

      // 존재 확인
      if (!fs.existsSync(oldPath)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.FILE_NOT_FOUND,
            message: '파일을 찾을 수 없습니다',
          },
        };
      }

      // 새 경로 생성
      const newPath = path.join(path.dirname(oldPath), newName);

      // 새 경로도 basePath 내부인지 검증
      if (!this.validatePath(basePath, newPath)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.PATH_VALIDATION_FAILED,
            message: '잘못된 경로입니다',
          },
        };
      }

      // 같은 이름 확인
      if (fs.existsSync(newPath)) {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.FILE_EXISTS,
            message: '같은 이름의 파일이 이미 존재합니다',
          },
        };
      }

      // 이름 변경
      fs.renameSync(oldPath, newPath);

      return {
        success: true,
        filePath: path.relative(basePath, newPath),
      };
    } catch (error) {
      // 권한 에러 확인
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
          success: false,
          filePath: relativePath,
          error: {
            code: FileOperationError.PERMISSION_DENIED,
            message: '파일 접근 권한이 없습니다',
          },
        };
      }

      return {
        success: false,
        filePath: relativePath,
        error: {
          code: FileOperationError.UNKNOWN_ERROR,
          message:
            error instanceof Error
              ? error.message
              : '알 수 없는 오류가 발생했습니다',
        },
      };
    }
  }

  /**
   * 파일 검색 (파일명 또는 내용)
   * @param basePath - 프로젝트 루트 경로
   * @param request - 검색 요청 (query, type, path)
   * @returns 검색 결과
   */
  searchFiles(basePath: string, request: SearchRequest): SearchResult {
    const { query, type, path: searchPath } = request;
    const startPath = searchPath
      ? path.resolve(basePath, searchPath)
      : basePath;

    // 보안 검증
    if (!this.validatePath(basePath, startPath)) {
      return { query, type, results: [], totalCount: 0 };
    }

    const matches: SearchMatch[] = [];
    const MAX_RESULTS = 50; // 결과 수 제한 (모바일 성능 고려)
    const lowerQuery = query.toLowerCase();

    if (type === 'filename') {
      this.searchByFileName(
        basePath,
        startPath,
        lowerQuery,
        matches,
        MAX_RESULTS,
      );
    } else {
      this.searchByContent(
        basePath,
        startPath,
        lowerQuery,
        matches,
        MAX_RESULTS,
      );
    }

    return {
      query,
      type,
      results: matches,
      totalCount: matches.length,
    };
  }

  /**
   * 파일명 검색 (재귀)
   * 폴더를 순회하며 이름에 검색어가 포함된 파일/폴더를 찾음
   */
  private searchByFileName(
    basePath: string,
    currentPath: string,
    lowerQuery: string,
    matches: SearchMatch[],
    maxResults: number,
  ): void {
    if (matches.length >= maxResults) return;

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      const filtered = this.filterEntries(entries);

      for (const entry of filtered) {
        if (matches.length >= maxResults) return;

        const fullPath = path.join(currentPath, entry.name);

        // 파일명에 검색어 포함 여부 (대소문자 무시)
        if (entry.name.toLowerCase().includes(lowerQuery)) {
          matches.push({
            name: entry.name,
            relativePath: path.relative(basePath, fullPath),
            isDirectory: entry.isDirectory(),
          });
        }

        // 폴더면 재귀 탐색
        if (entry.isDirectory()) {
          this.searchByFileName(
            basePath,
            fullPath,
            lowerQuery,
            matches,
            maxResults,
          );
        }
      }
    } catch {
      // 접근 불가 디렉토리 무시
    }
  }

  /**
   * 파일 내용 검색 (재귀)
   * 폴더를 순회하며 파일 내용에 검색어가 포함된 파일을 찾음
   */
  private searchByContent(
    basePath: string,
    currentPath: string,
    lowerQuery: string,
    matches: SearchMatch[],
    maxResults: number,
  ): void {
    if (matches.length >= maxResults) return;

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      const filtered = this.filterEntries(entries);

      for (const entry of filtered) {
        if (matches.length >= maxResults) return;

        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // 폴더면 재귀 탐색
          this.searchByContent(
            basePath,
            fullPath,
            lowerQuery,
            matches,
            maxResults,
          );
        } else {
          // 파일이면 내용 검색
          this.searchFileContent(basePath, fullPath, lowerQuery, matches);
        }
      }
    } catch {
      // 접근 불가 디렉토리 무시
    }
  }

  /**
   * 단일 파일 내용 검색
   * 바이너리 파일은 건너뛰고, 텍스트 파일만 검색
   */
  private searchFileContent(
    basePath: string,
    filePath: string,
    lowerQuery: string,
    matches: SearchMatch[],
  ): void {
    try {
      const stats = fs.statSync(filePath);

      // 크기 제한 (1MB 초과 파일 무시)
      if (stats.size > FILE_CONFIG.MAX_FILE_SIZE) return;

      const content = fs.readFileSync(filePath, FILE_CONFIG.DEFAULT_ENCODING);

      // 바이너리 파일 감지 (null 바이트 포함 여부)
      if (content.includes('\0')) return;

      const lines = content.split('\n');
      const lineMatches: { line: number; text: string }[] = [];
      const MAX_LINE_PREVIEW = 120; // 줄 미리보기 최대 길이
      const MAX_MATCHES_PER_FILE = 5; // 파일당 최대 매치 수

      for (let i = 0; i < lines.length; i++) {
        if (lineMatches.length >= MAX_MATCHES_PER_FILE) break;

        if (lines[i].toLowerCase().includes(lowerQuery)) {
          lineMatches.push({
            line: i + 1,
            text: lines[i].trim().substring(0, MAX_LINE_PREVIEW),
          });
        }
      }

      if (lineMatches.length > 0) {
        matches.push({
          name: path.basename(filePath),
          relativePath: path.relative(basePath, filePath),
          isDirectory: false,
          matches: lineMatches,
        });
      }
    } catch {
      // 읽기 실패 파일 무시
    }
  }
}
