/**
 * 언어 감지 유틸리티
 * 파일 확장자를 기반으로 프로그래밍 언어 감지
 */

import * as path from 'path';
import {
  LANGUAGE_MAP,
  DEFAULT_LANGUAGE,
} from '../constants/language.constants';

/**
 * 파일 경로에서 확장자를 기반으로 언어 감지
 * @param filePath - 파일 경로
 * @returns 감지된 언어 이름 (매핑 없으면 'plaintext')
 */
export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || DEFAULT_LANGUAGE;
}
