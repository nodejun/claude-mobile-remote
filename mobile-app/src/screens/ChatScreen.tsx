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
  StatusBar,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { socketService, storageService } from "../services";
import { MarkdownMessage } from "../components";
import { useTheme } from "../theme";
import type { ChatMessage } from "../types/chat";

/**
 * Claude 아바타 컴포넌트
 * 앰버 원형 배경 + "C" 이니셜
 */
function ClaudeAvatar({ size = 32, color }: { size?: number; color: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: size * 0.45,
          fontWeight: "700",
        }}
      >
        C
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  // 테마 색상
  const { colors } = useTheme();

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

  // 저장 디바운스 타이머 ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 초기 로드 여부 (저장 루프 방지)
  const isInitialLoadRef = useRef(true);

  // 설정에서 불러온 글꼴 크기
  const [chatFontSize, setChatFontSize] = useState<number>(16);

  /**
   * 화면에 포커스될 때마다 글꼴 크기 설정 다시 로드
   * (설정 탭에서 변경 후 돌아올 때 즉시 반영)
   */
  useFocusEffect(
    useCallback(() => {
      storageService.getSettings().then((settings) => {
        setChatFontSize(settings.codeFontSize);
      });
    }, []),
  );

  /**
   * 앱 시작 시 저장된 대화 기록 복구
   */
  useEffect(() => {
    const loadSavedMessages = async () => {
      const saved = await storageService.loadChatMessages();
      if (saved.length > 0) {
        setMessages(saved);
        console.log(`✅ 저장된 대화 ${saved.length}개 복구됨`);
        // 복구 후 스크롤
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
      // 초기 로드 완료 표시
      isInitialLoadRef.current = false;
    };
    loadSavedMessages();
  }, []);

  /**
   * 메시지 변경 시 AsyncStorage에 자동 저장 (디바운스 500ms)
   * streaming 상태 메시지는 StorageService에서 필터링됨
   */
  useEffect(() => {
    // 초기 로드 중이면 저장하지 않음 (복구 → 저장 루프 방지)
    if (isInitialLoadRef.current) return;

    // 기존 타이머 취소
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // 500ms 후 저장
    saveTimerRef.current = setTimeout(() => {
      storageService.saveChatMessages(messages);
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [messages]);

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
    [],
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
              : msg,
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
      },
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
              : msg,
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
                : msg,
            );
          }

          return prev;
        });

        setIsLoading(false);
        currentAssistantIdRef.current = null;
      },
    );

    // 응답 중단 완료
    const unsubscribeCancelled = socketService.on(
      "cancelled",
      (data: { success: boolean; reason?: string }) => {
        console.log("🛑 응답 중단 완료:", data);

        setMessages((prev) => {
          // 완료된 assistant 메시지가 있는지 확인 (첫 번째 프롬프트인지 판단)
          const hasCompletedAssistant = prev.some(
            (msg) => msg.role === "assistant" && msg.status === "complete",
          );

          // 첫 번째 프롬프트에서 중단된 경우 → 세션 리셋
          if (!hasCompletedAssistant) {
            console.log("🔄 첫 번째 프롬프트 중단 → 세션 리셋");
            socketService.emit("end_session");
            return prev; // session_ended에서 메시지 초기화됨
          }

          // 이후 프롬프트에서 중단된 경우 → 메시지에 중단 표시
          const pendingAssistant = findLastPendingAssistant(prev);

          if (pendingAssistant) {
            return prev.map((msg) =>
              msg.id === pendingAssistant.id
                ? {
                    ...msg,
                    content: msg.content + "\n\n*(응답 중단됨)*",
                    status: "complete" as const,
                  }
                : msg,
            );
          }

          return prev;
        });

        setIsLoading(false);
        currentAssistantIdRef.current = null;
      },
    );

    // 세션 종료 완료
    const unsubscribeSessionEnded = socketService.on(
      "session_ended",
      (data: { success: boolean; newSessionId?: string; reason?: string }) => {
        console.log("🔄 세션 종료 완료:", data);

        if (data.success) {
          // 메시지 초기화 (메모리 + AsyncStorage)
          setMessages([]);
          storageService.clearChatMessages();
          currentAssistantIdRef.current = null;
          console.log("✅ 새 대화가 시작되었습니다. 세션:", data.newSessionId);
        } else {
          console.error("❌ 세션 종료 실패:", data.reason);
        }
      },
    );

    // 컴포넌트 언마운트 시 리스너 해제
    return () => {
      unsubscribeChunk();
      unsubscribeComplete();
      unsubscribeError();
      unsubscribeCancelled();
      unsubscribeSessionEnded();
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
   * 세션 종료 (새 대화 시작)
   */
  const handleEndSession = useCallback(() => {
    if (isLoading) {
      alert("응답 중에는 새 대화를 시작할 수 없습니다.");
      return;
    }

    console.log("🔄 세션 종료 요청");
    socketService.emit("end_session");
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
  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === "user";
      const isStreaming =
        item.status === "streaming" || item.status === "sending";

      // AI 메시지: 아바타 + 버블 래퍼
      if (!isUser) {
        return (
          <View style={styles.assistantRow}>
            <ClaudeAvatar size={28} color={colors.primary} />
            <View
              style={[
                styles.messageBubble,
                styles.assistantBubble,
                { backgroundColor: colors.chatAssistantBubble },
              ]}
            >
              <Text
                style={[styles.roleLabel, styles.assistantLabel, { color: colors.primary }]}
              >
                Claude
              </Text>
              {item.status === "sending" && !item.content ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginVertical: 8 }}
                />
              ) : (
                <MarkdownMessage
                  content={item.content}
                  isStreaming={isStreaming}
                  fontSize={chatFontSize}
                />
              )}
              {!isStreaming && (
                <Text style={[styles.timestamp, { color: colors.chatTimestamp }]}>
                  {new Date(item.timestamp).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )}
            </View>
          </View>
        );
      }

      // 사용자 메시지
      return (
        <View
          style={[
            styles.messageBubble,
            styles.userBubble,
            { backgroundColor: colors.chatUserBubble },
          ]}
        >
          <Text
            style={[styles.roleLabel, styles.userLabel, { color: colors.chatUserLabel }]}
          >
            나
          </Text>
          <Text
            style={[
              styles.messageText,
              styles.userText,
              {
                color: colors.textOnPrimary,
                fontSize: chatFontSize,
                lineHeight: Math.round(chatFontSize * 1.4),
              },
            ]}
          >
            {item.content}
          </Text>
          {!isStreaming && (
            <Text style={[styles.timestamp, { color: colors.chatTimestamp }]}>
              {new Date(item.timestamp).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          )}
        </View>
      );
    },
    [chatFontSize, colors],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* 헤더 영역 */}
      {messages.length > 0 && (
        <View
          style={[
            styles.header,
            {
              paddingTop: (StatusBar.currentHeight || 24) + 8,
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.newChatButton,
              { backgroundColor: colors.surfaceSecondary },
            ]}
            onPress={handleEndSession}
            disabled={isLoading}
          >
            <Feather
              name="plus"
              size={16}
              color={isLoading ? colors.textTertiary : colors.primary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.newChatButtonText,
                { color: colors.primary },
                isLoading && { color: colors.textTertiary },
              ]}
            >
              새 대화
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 메시지 목록 */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={true}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ClaudeAvatar size={64} color={colors.primary} />
            <Text
              style={[styles.welcomeTitle, { color: colors.textPrimary }]}
            >
              Claude에게 물어보세요
            </Text>
            <Text
              style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}
            >
              코드 작성, 분석, 디버깅 등을 도와드립니다
            </Text>
          </View>
        ) : (
          messages.map((item) => (
            <View key={item.id}>{renderMessage({ item })}</View>
          ))
        )}
      </ScrollView>

      {/* 입력 영역 — pill 형태 + 원형 버튼 */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            shadowColor: colors.shadow,
            shadowOpacity: colors.shadowOpacity,
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.chatInputBackground,
              color: colors.textPrimary,
              borderColor: colors.borderLight,
            },
          ]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={4000}
          editable={!isLoading}
        />
        {isLoading ? (
          // 로딩 중: 중단 버튼 (원형 + square 아이콘)
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.danger }]}
            onPress={handleCancel}
          >
            <Feather name="square" size={18} color={colors.textOnPrimary} />
          </TouchableOpacity>
        ) : (
          // 평상시: 전송 버튼 (원형 + arrow-up 아이콘)
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: colors.primary },
              !inputText.trim() && { backgroundColor: colors.textTertiary },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Feather name="arrow-up" size={20} color={colors.textOnPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // 헤더 영역
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newChatButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // 스크롤 뷰
  scrollView: {
    flex: 1,
  },

  // 메시지 목록
  messageList: {
    padding: 16,
  },

  // Welcome 화면 (메시지 없을 때)
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 120,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
  },
  welcomeSubtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
  },

  // AI 메시지 행 (아바타 + 버블)
  assistantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },

  // 메시지 버블 (공통)
  messageBubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 20,
    marginBottom: 12,
  },

  // 사용자 메시지 버블
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
  },

  // AI 메시지 버블
  assistantBubble: {
    flex: 1,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
    marginBottom: 0,
  },

  // 역할 라벨
  roleLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  userLabel: {},
  assistantLabel: {},

  // 메시지 텍스트
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {},

  // 시간 표시
  timestamp: {
    fontSize: 11,
    marginTop: 6,
    alignSelf: "flex-end",
  },

  // 입력 영역 — 상단 보더 제거, 그림자로 대체
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 12 : 12,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 6,
    elevation: 4,
  },

  // 텍스트 입력 — pill 형태
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    fontSize: 16,
  },

  // 전송 버튼 — 원형
  sendButton: {
    marginLeft: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
});
