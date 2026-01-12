/**
 * 코드 블록 컴포넌트
 * 구문 강조가 적용된 코드를 렌더링
 */
import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import CodeHighlighter from "react-native-code-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import * as Clipboard from "expo-clipboard";

interface CodeBlockProps {
  code: string; // 코드 내용
  language?: string; // 언어 (javascript, python 등)
}

export default function CodeBlock({
  code,
  language = "plaintext",
}: CodeBlockProps) {
  // 코드 복사 핸들러
  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert("복사됨", "코드가 클립보드에 복사되었습니다.");
    } catch (error) {
      console.error("클립보드 복사 실패:", error);
    }
  }, [code]);

  // 언어 라벨 포맷팅 (메모이제이션)
  const formattedLanguage = useMemo(() => {
    const langMap: Record<string, string> = {
      js: "JavaScript",
      javascript: "JavaScript",
      ts: "TypeScript",
      typescript: "TypeScript",
      tsx: "TypeScript React",
      jsx: "JavaScript React",
      py: "Python",
      python: "Python",
      sh: "Shell",
      bash: "Bash",
      json: "JSON",
      html: "HTML",
      css: "CSS",
      sql: "SQL",
      plaintext: "Text",
    };
    return langMap[language.toLowerCase()] || language;
  }, [language]);

  return (
    <View style={styles.container}>
      {/* 헤더: 언어 라벨 + 복사 버튼 */}
      <View style={styles.header}>
        <Text style={styles.languageLabel}>{formattedLanguage}</Text>
        <TouchableOpacity onPress={handleCopy} style={styles.copyButton}>
          <Text style={styles.copyButtonText}>복사</Text>
        </TouchableOpacity>
      </View>

      {/* 코드 영역 - CodeHighlighter 사용 */}
      <CodeHighlighter
        hljsStyle={atomOneDark}
        language={language}
        textStyle={styles.codeText}
        scrollViewProps={{
          horizontal: true,
          showsHorizontalScrollIndicator: false,
          contentContainerStyle: {
            padding: 12,
            minWidth: '100%',  // 코드가 짧아도 전체 너비 채우기
            flexGrow: 0,  // 레이아웃 확장 방지
          },
          style: {
            flexGrow: 0,  // ScrollView 자체도 확장 방지
            flexShrink: 1,
          },
        }}
      >
        {code.trim()}
      </CodeHighlighter>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#282c34",
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 0,  // 여백 누적 방지
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#21252b",
    borderBottomWidth: 1,
    borderBottomColor: "#3e4451",
  },
  languageLabel: {
    color: "#abb2bf",
    fontSize: 12,
    fontWeight: "500",
  },
  copyButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#3e4451",
  },
  copyButtonText: {
    color: "#61afef",
    fontSize: 12,
    fontWeight: "500",
  },
  codeContainer: {
    padding: 12,
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    lineHeight: 20,
    color: "#abb2bf",  // 밝은 회색 텍스트 (어두운 배경용)
  },
});
