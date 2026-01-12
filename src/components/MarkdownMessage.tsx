/**
 * 마크다운 메시지 컴포넌트
 * AI 응답 메시지를 마크다운으로 렌더링
 */
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import Markdown from "react-native-markdown-display";
import CodeBlock from "./CodeBlock";
import { markdownStyles } from "../styles/markdownStyles";

interface MarkdownMessageProps {
  content: string; // 마크다운 텍스트
  isStreaming?: boolean; // 스트리밍 중 여부
}

function MarkdownMessage({ content, isStreaming }: MarkdownMessageProps) {
  // 스트리밍 중 불완전한 코드 블록 처리
  const safeContent = useMemo(() => {
    try {
      // 열린 코드 블록 감지 (``` 가 홀수 개인 경우)
      const fenceCount = (content.match(/```/g) || []).length;

      if (fenceCount % 2 === 1) {
        // 불완전한 코드 블록 - 임시로 닫기
        return content + "\n```";
      }

      return content;
    } catch (e) {
      console.error("safeContent 처리 오류:", e);
      return content;
    }
  }, [content]);

  // 커스텀 렌더링 규칙
  const rules = useMemo(
    () => ({
      // 코드 블록 (```)
      fence: (
        node: any,
        _children: any,
        _parent: any,
        _styles: any,
        inheritedStyles?: any
      ) => {
        try {
          // node.sourceInfo: 언어 정보 (예: 'javascript')
          const language = node.sourceInfo || "plaintext";
          const code = node.content || "";

          return <CodeBlock key={node.key} code={code} language={language} />;
        } catch (e) {
          console.error("fence 렌더링 오류:", e);
          return (
            <Text key={node.key} style={{ fontFamily: "monospace" }}>
              {node.content}
            </Text>
          );
        }
      },

      // 인라인 코드 (`)
      code_inline: (
        node: any,
        _children: any,
        _parent: any,
        _styles: any,
        inheritedStyles?: any
      ) => (
        <Text key={node.key} style={markdownStyles.code_inline}>
          {node.content}
        </Text>
      ),
    }),
    []
  );

  // 링크 클릭 핸들러
  const handleLinkPress = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error("링크 열기 실패:", err);
    });
    return false; // 기본 동작 방지
  };

  // 빈 content 처리
  if (!content) {
    return null;
  }

  // 마크다운 렌더링
  return (
    <View style={styles.container}>
      <Markdown
        style={markdownStyles}
        rules={rules}
        onLinkPress={handleLinkPress}
        mergeStyle={true}
      >
        {safeContent}
      </Markdown>

      {/* 스트리밍 커서 */}
      {isStreaming && <Text style={styles.cursor}>▌</Text>}
    </View>
  );
}

// memo 다시 적용 - content나 isStreaming이 변경되지 않으면 리렌더링 방지
export default React.memo(MarkdownMessage);

const styles = StyleSheet.create({
  container: {
    // flexShrink 제거 - 다른 메시지 추가 시 크기 변경 방지
  },
  cursor: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  fallbackText: {
    color: "#333333",
    fontSize: 16,
    lineHeight: 24,
  },
});
