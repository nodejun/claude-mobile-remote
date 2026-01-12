/**
 * 마크다운 스타일 정의
 * react-native-markdown-display용 스타일
 */
import { StyleSheet, Platform } from "react-native";

export const markdownStyles = StyleSheet.create({
  // 기본 텍스트
  body: {
    color: "#333333",
    fontSize: 16,
    lineHeight: 24,
  },

  // 제목들
  heading1: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e4e8",
    paddingBottom: 8,
  },
  heading2: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginVertical: 10,
  },
  heading3: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginVertical: 8,
  },
  heading4: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginVertical: 6,
  },
  heading5: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginVertical: 4,
  },
  heading6: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666666",
    marginVertical: 4,
  },

  // 텍스트 스타일
  strong: {
    fontWeight: "bold",
  },
  em: {
    fontStyle: "italic",
  },
  s: {
    textDecorationLine: "line-through",
  },

  // 링크
  link: {
    color: "#007AFF",
    textDecorationLine: "underline",
  },

  // 인라인 코드
  code_inline: {
    backgroundColor: "#f6f8fa",
    color: "#e01e5a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 14,
  },

  // 코드 블록 (기본 - CodeBlock 컴포넌트로 대체됨)
  code_block: {
    backgroundColor: "#282c34",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: "#282c34",
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
    flexDirection: "row",
    marginVertical: 4,
  },
  bullet_list_icon: {
    marginRight: 8,
    color: "#007AFF",
  },
  ordered_list_icon: {
    marginRight: 8,
    color: "#007AFF",
  },

  // 인용문
  blockquote: {
    backgroundColor: "#f6f8fa",
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },

  // 구분선
  hr: {
    backgroundColor: "#e1e4e8",
    height: 1,
    marginVertical: 12,
  },

  // 표
  table: {
    borderWidth: 1,
    borderColor: "#e1e4e8",
    marginVertical: 8,
  },
  thead: {
    backgroundColor: "#f6f8fa",
  },
  th: {
    padding: 8,
    fontWeight: "bold",
    borderWidth: 1,
    borderColor: "#e1e4e8",
  },
  tbody: {},
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: "#e1e4e8",
  },
  td: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#e1e4e8",
  },

  // 단락
  paragraph: {
    marginVertical: 4,
  },

  // 이미지
  image: {
    width: "100%",
    resizeMode: "contain",
    marginVertical: 8,
  },
});
