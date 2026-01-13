/**
 * 채팅 화면
 * Claude와 대화하는 메인 화면
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { socketService } from "../services";
import { MarkdownMessage } from "../components";
import type { ChatMessage } from "../types/chat";

export default function ChatScreen() {
  // 메시지 목록 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 입력창 텍스트 상태
  const [inputText, setInputText] = useState("");

  // AI 응답 중 상태
  const [isLoading, setIsLoading] = useState(false);

  // ScrollView 참조 (스크롤 제어용)
  const scrollViewRef = useRef<ScrollView>(null);

  // 현재 AI 응답 메시지 ID (스트리밍 업데이트용)
  const currentAssistantIdRef = useRef<string | null>(null);

  // 스크롤 throttle용 ref
  const lastScrollTimeRef = useRef<number>(0);

  /**
   * 마지막 streaming/sending 상태의 assistant 메시지를 찾는 헬퍼 함수
   * ref 동기화 문제를 방지하기 위해 상태 기반으로 메시지를 찾음
   */
  const findLastPendingAssistant = useCallback(
    (msgs: ChatMessage[]): ChatMessage | undefined => {
      // 역순으로 검색하여 가장 마지막 pending assistant 찾기
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i];
        if (
          msg.role === "assistant" &&
          (msg.status === "streaming" || msg.status === "sending")
        ) {
          return msg;
        }
      }
      return undefined;
    },
    []
  );

  /**
   * 소켓 이벤트 리스너 등록
   */
  useEffect(() => {
    // 응답 청크 수신 (스트리밍)
    const unsubscribeChunk = socketService.on(
      "response_chunk",
      (data: { text: string }) => {
        // ref 대신 상태 기반으로 마지막 pending assistant 찾기
        setMessages((prev) => {
          const pendingAssistant = findLastPendingAssistant(prev);
          if (!pendingAssistant) {
            return prev;
          }

          return prev.map((msg) =>
            msg.id === pendingAssistant.id
              ? {
                  ...msg,
                  content: msg.content + data.text,
                  status: "streaming" as const,
                }
              : msg
          );
        });

        // 스크롤 (throttle 적용 - 300ms마다 한 번)
        const now = Date.now();
        if (now - lastScrollTimeRef.current > 300) {
          lastScrollTimeRef.current = now;
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: false });
          }, 50);
        }
      }
    );

    // 응답 완료
    const unsubscribeComplete = socketService.on("response_complete", () => {
      // streaming 또는 sending 상태인 마지막 assistant 메시지 찾아서 완료 처리
      setMessages((prev) => {
        const pendingAssistant = findLastPendingAssistant(prev);

        if (pendingAssistant) {
          return prev.map((msg) =>
            msg.id === pendingAssistant.id
              ? { ...msg, status: "complete" as const }
              : msg
          );
        }

        return prev;
      });

      setIsLoading(false);
      currentAssistantIdRef.current = null;

      // 응답 완료 후 최종 스크롤
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    });

    // 에러 수신
    const unsubscribeError = socketService.on(
      "error",
      (data: { message: string }) => {
        setMessages((prev) => {
          const pendingAssistant = findLastPendingAssistant(prev);

          if (pendingAssistant) {
            return prev.map((msg) =>
              msg.id === pendingAssistant.id
                ? {
                    ...msg,
                    content: `오류: ${data.message}`,
                    status: "error" as const,
                  }
                : msg
            );
          }

          return prev;
        });

        setIsLoading(false);
        currentAssistantIdRef.current = null;
      }
    );

    // 응답 중단 완료
    const unsubscribeCancelled = socketService.on(
      "cancelled",
      (data: { success: boolean; reason?: string }) => {
        console.log("🛑 응답 중단 완료:", data);

        setMessages((prev) => {
          const pendingAssistant = findLastPendingAssistant(prev);

          if (pendingAssistant) {
            return prev.map((msg) =>
              msg.id === pendingAssistant.id
                ? {
                    ...msg,
                    content: msg.content + "\n\n*(응답 중단됨)*",
                    status: "complete" as const,
                  }
                : msg
            );
          }

          return prev;
        });

        setIsLoading(false);
        currentAssistantIdRef.current = null;
      }
    );

    // 컴포넌트 언마운트 시 리스너 해제
    return () => {
      unsubscribeChunk();
      unsubscribeComplete();
      unsubscribeError();
      unsubscribeCancelled();
    };
  }, []);

  /**
   * 응답 중단 처리
   */
  const handleCancel = useCallback(() => {
    if (!isLoading) return;

    console.log("🛑 응답 중단 요청");
    socketService.emit("cancel");
  }, [isLoading]);

  /**
   * 메시지 전송 처리
   */
  const handleSend = useCallback(() => {
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
    socketService.emit("prompt", { message: userMessage.content });

    // 스크롤
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [inputText, isLoading]);

  /**
   * 메시지 아이템 렌더링
   */
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
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
        ) : isUser ? (
          // 사용자 메시지: 평문 텍스트
          <Text style={[styles.messageText, styles.userText]}>
            {item.content}
          </Text>
        ) : (
          // AI 메시지: 마크다운 렌더링
          <MarkdownMessage content={item.content} isStreaming={isStreaming} />
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
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* 메시지 목록 */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={true}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>💬 Claude와 대화를 시작하세요!</Text>
          </View>
        ) : (
          messages.map((item) => (
            <View key={item.id}>
              {renderMessage({ item })}
            </View>
          ))
        )}
      </ScrollView>

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
        {isLoading ? (
          // 로딩 중: 중단 버튼
          <TouchableOpacity
            style={[styles.sendButton, styles.cancelButton]}
            onPress={handleCancel}
          >
            <Text style={styles.sendButtonText}>중단</Text>
          </TouchableOpacity>
        ) : (
          // 평상시: 전송 버튼
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendButtonText}>전송</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // 스크롤 뷰
  scrollView: {
    flex: 1,
  },

  // 메시지 목록
  messageList: {
    padding: 16,
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
  cancelButton: {
    backgroundColor: "#FF3B30",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
