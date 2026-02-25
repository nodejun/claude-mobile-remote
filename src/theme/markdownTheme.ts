/**
 * 테마에 따른 마크다운 스타일 동적 생성
 * react-native-markdown-display의 style prop용
 *
 * 코드 블록(fence, code_block)은 항상 다크 유지 (#282c34)
 * - 코드 뷰어는 어두운 배경이 가독성이 좋음
 */
import { Platform } from 'react-native';
import type { ThemeColors } from './colors';

/**
 * 테마 색상과 글꼴 크기를 받아 마크다운 스타일 객체를 반환
 * @param colors 현재 테마 색상 팔레트
 * @param fontSize 사용자 설정 글꼴 크기 (선택)
 */
export function createMarkdownStyles(colors: ThemeColors, fontSize?: number) {
  const bodyFontSize = fontSize || 16;

  return {
    // 기본 텍스트
    body: {
      color: colors.textPrimary,
      fontSize: bodyFontSize,
      lineHeight: Math.round(bodyFontSize * 1.5),
    },

    // 제목들
    heading1: {
      fontSize: 24,
      fontWeight: 'bold' as const,
      color: colors.textHeading,
      marginVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      paddingBottom: 8,
    },
    heading2: {
      fontSize: 20,
      fontWeight: 'bold' as const,
      color: colors.textHeading,
      marginVertical: 10,
    },
    heading3: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: colors.textHeading,
      marginVertical: 8,
    },
    heading4: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.textHeading,
      marginVertical: 6,
    },
    heading5: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.textHeading,
      marginVertical: 4,
    },
    heading6: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.textSecondary,
      marginVertical: 4,
    },

    // 텍스트 스타일
    strong: {
      fontWeight: 'bold' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    s: {
      textDecorationLine: 'line-through' as const,
    },

    // 링크
    link: {
      color: colors.primary,
      textDecorationLine: 'underline' as const,
    },

    // 인라인 코드
    code_inline: {
      backgroundColor: colors.inlineCodeBackground,
      color: colors.inlineCodeText,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
    },

    // 코드 블록 (항상 다크 유지 - CodeBlock 컴포넌트가 담당)
    code_block: {
      backgroundColor: '#282c34',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    fence: {
      backgroundColor: '#282c34',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },

    // 리스트
    bullet_list: {
      marginVertical: 8,
    },
    ordered_list: {
      marginVertical: 8,
    },
    list_item: {
      flexDirection: 'row' as const,
      marginVertical: 4,
    },
    bullet_list_icon: {
      marginRight: 8,
      color: colors.primary,
    },
    ordered_list_icon: {
      marginRight: 8,
      color: colors.primary,
    },

    // 인용문
    blockquote: {
      backgroundColor: colors.blockquoteBackground,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      paddingLeft: 12,
      paddingVertical: 8,
      marginVertical: 8,
    },

    // 구분선
    hr: {
      backgroundColor: colors.divider,
      height: 1,
      marginVertical: 12,
    },

    // 표
    table: {
      borderWidth: 1,
      borderColor: colors.tableBorder,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: colors.tableHeaderBackground,
    },
    th: {
      padding: 8,
      fontWeight: 'bold' as const,
      borderWidth: 1,
      borderColor: colors.tableBorder,
    },
    tbody: {},
    tr: {
      borderBottomWidth: 1,
      borderBottomColor: colors.tableBorder,
    },
    td: {
      padding: 8,
      borderWidth: 1,
      borderColor: colors.tableBorder,
    },

    // 단락
    paragraph: {
      marginVertical: 4,
    },

    // 이미지
    image: {
      width: '100%' as any,
      resizeMode: 'contain' as const,
      marginVertical: 8,
    },
  };
}
