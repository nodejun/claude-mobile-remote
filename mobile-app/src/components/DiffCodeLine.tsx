/**
 * Diff 코드 라인 컴포넌트
 * 구문 강조가 적용된 단일 코드 라인을 렌더링
 * addition/deletion/context 타입에 따라 배경색 적용
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import CodeHighlighter from 'react-native-code-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

type LineType = 'context' | 'addition' | 'deletion';

// atomOneDark 테마를 복사하고 배경색만 투명하게 변경
const transparentTheme = {
  ...atomOneDark,
  hljs: {
    ...atomOneDark.hljs,
    background: 'transparent',
  },
};

interface DiffCodeLineProps {
  content: string;           // 코드 내용
  lineNumber: string;        // 표시할 라인 번호
  type: LineType;            // 라인 타입
  language?: string;         // 언어 (구문 강조용)
}

export default function DiffCodeLine({
  content,
  lineNumber,
  type,
  language = 'plaintext',
}: DiffCodeLineProps) {
  // 라인 타입에 따른 스타일 결정
  const lineStyle = useMemo(() => {
    switch (type) {
      case 'addition':
        return styles.lineAddition;
      case 'deletion':
        return styles.lineDeletion;
      default:
        return styles.lineContext;
    }
  }, [type]);

  const lineNumberStyle = useMemo(() => {
    switch (type) {
      case 'addition':
        return styles.lineNumberAddition;
      case 'deletion':
        return styles.lineNumberDeletion;
      default:
        return styles.lineNumberContext;
    }
  }, [type]);

  // 빈 줄 처리 (구문 강조 시 빈 문자열 에러 방지)
  const displayContent = content || ' ';

  return (
    <View style={[styles.container, lineStyle]}>
      {/* 라인 번호 */}
      <Text style={[styles.lineNumber, lineNumberStyle]}>
        {lineNumber}
      </Text>

      {/* 코드 내용 (구문 강조 적용) */}
      <View style={styles.codeContainer}>
        <CodeHighlighter
          hljsStyle={transparentTheme}
          language={language}
          textStyle={styles.codeText}
          scrollViewProps={{
            horizontal: false,
            scrollEnabled: false,
            contentContainerStyle: {
              flexGrow: 0,
              backgroundColor: 'transparent',
              padding: 0,
              margin: 0,
            },
            style: {
              flexGrow: 0,
              backgroundColor: 'transparent',
            },
          }}
          customStyle={{
            backgroundColor: 'transparent',
            padding: 0,
            margin: 0,
          }}
        >
          {displayContent}
        </CodeHighlighter>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 1,
    paddingHorizontal: 4,
    minHeight: 20,
  },
  // 라인 타입별 배경색
  lineContext: {
    backgroundColor: 'transparent',
  },
  lineAddition: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)', // 초록 배경
  },
  lineDeletion: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)', // 빨강 배경
  },
  // 라인 번호
  lineNumber: {
    width: 45,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    textAlign: 'right',
    marginRight: 8,
    paddingTop: 2,
  },
  lineNumberContext: {
    color: '#6A6A6A',
  },
  lineNumberAddition: {
    color: '#34C759', // 초록색
  },
  lineNumberDeletion: {
    color: '#FF3B30', // 빨간색
  },
  // 코드 컨테이너
  codeContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  highlighterContainer: {
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 18,
  },
});
