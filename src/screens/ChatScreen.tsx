/**
 * 채팅 화면
 * Claude와 대화하는 메인 화면
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { socketService } from "../services";
import type { ChatMessage } from "../types/chat";

export default function ChatScreen() {
  // 메시지 목록 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 입력창 텍스트 상태
  const [inputText, setInputText] = useState("");

  // AI 응답 중 상태
  const [isLoading, setIsLoading] = useState(false);

  // FlatList 참조 (스크롤 제어용)
  const flatListRef = useRef<FlatList>(null);

  // 현재 AI 응답 메시지 ID (스트리밍 업데이트용)
  const currentAssistantIdRef = useRef<string | null>(null);

  /**
   * 소켓 이벤트 리스너 등록
   */
  useEffect(() => {
    console.log("🎧 ChatScreen: 이벤트 리스너 등록 시작");

    // 응답 청크 수신 (스트리밍)
    const unsubscribeChunk = socketService.on(
      "response_chunk",
      (data: { text: string }) => {
        console.log("📥 response_chunk 수신:", data.text?.substring(0, 30));
        const assistantId = currentAssistantIdRef.current;
        if (!assistantId) {
          console.log("⚠️ assistantId가 없음!");
          return;
        }

        // 기존 AI 메시지에 텍스트 추가
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: msg.content + data.text,
                  status: "streaming",
                }
              : msg
          )
        );

        // 스크롤
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 50);
      }
    );

    // 응답 완료
    const unsubscribeComplete = socketService.on("response_complete", () => {
      console.log("📥 response_complete 수신");
      const assistantId = currentAssistantIdRef.current;
      if (assistantId) {
        // 상태를 complete로 변경
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, status: "complete" } : msg
          )
        );
      }

      setIsLoading(false);
      currentAssistantIdRef.current = null;
    });

    // 에러 수신
    const unsubscribeError = socketService.on(
      "error",
      (data: { message: string }) => {
        console.error("📥 error 수신:", data.message);

        const assistantId = currentAssistantIdRef.current;
        if (assistantId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: `오류: ${data.message}`, status: "error" }
                : msg
            )
          );
        }

        setIsLoading(false);
        currentAssistantIdRef.current = null;
      }
    );

    console.log("🎧 ChatScreen: 이벤트 리스너 등록 완료");

    // 컴포넌트 언마운트 시 리스너 해제
    return () => {
      console.log("🧹 ChatScreen: 이벤트 리스너 해제");
      unsubscribeChunk();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, []);

  /**
   * 메시지 전송 처리
   */
  const handleSend = () => {
    // 빈 메시지 또는 로딩 중이면 무시
    if (!inputText.trim() || isLoading) return;

    // 연결 상태 확인
    if (!socketService.isConnected()) {
      alert("서버에 연결되어 있지 않습니다. 연결 탭에서 먼저 연결해주세요.");
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    // AI 응답 메시지 미리 생성 (빈 상태로)
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      status: "sending",
    };

    // 현재 AI 메시지 ID 저장
    currentAssistantIdRef.current = assistantMessage.id;

    // 메시지 추가
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInputText("");
    setIsLoading(true);

    // 서버에 프롬프트 전송
    console.log("📤 프롬프트 전송:", userMessage.content);
    console.log("📤 현재 assistantId:", assistantMessage.id);
    socketService.emit("prompt", { message: userMessage.content });

    // 스크롤
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  /**
   * 메시지 아이템 렌더링
   */
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    const isStreaming =
      item.status === "streaming" || item.status === "sending";

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        {/* 역할 라벨 */}
        <Text
          style={[
            styles.roleLabel,
            isUser ? styles.userLabel : styles.assistantLabel,
          ]}
        >
          {isUser ? "나" : "Claude"}
        </Text>

        {/* 메시지 내용 */}
        {item.status === "sending" && !item.content ? (
          <ActivityIndicator
            size="small"
            color="#007AFF"
            style={{ marginVertical: 8 }}
          />
        ) : (
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userText : styles.assistantText,
            ]}
          >
            {item.content}
            {isStreaming && <Text style={styles.cursor}>▌</Text>}
          </Text>
        )}

        {/* 시간 표시 (스트리밍 중이 아닐 때만) */}
        {!isStreaming && (
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* 메시지 목록 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>💬 Claude와 대화를 시작하세요!</Text>
          </View>
        }
      />

      {/* 입력 영역 */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor="#999"
          multiline
          maxLength={4000}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>전송</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // 메시지 목록
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // 빈 상태
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
  },

  // 메시지 버블 (공통)
  messageBubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },

  // 사용자 메시지 버블
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },

  // AI 메시지 버블
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // 역할 라벨
  roleLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  userLabel: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  assistantLabel: {
    color: "#007AFF",
  },

  // 메시지 텍스트
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: "#FFFFFF",
  },
  assistantText: {
    color: "#333333",
  },

  // 스트리밍 커서
  cursor: {
    color: "#007AFF",
  },

  // 시간 표시
  timestamp: {
    fontSize: 11,
    color: "rgba(0, 0, 0, 0.4)",
    marginTop: 6,
    alignSelf: "flex-end",
  },

  // 입력 영역
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },

  // 텍스트 입력
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    fontSize: 16,
    color: "#333",
  },

  // 전송 버튼
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
