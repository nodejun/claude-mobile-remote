/**
 * 채팅 관련 타입 정의
 */

// 메시지 역할 (누가 보낸 메시지인지)
export type MessageRole = 'user' | 'assistant';

// 메시지 상태 (AI 응답의 상태)
export type MessageStatus = 'sending' | 'streaming' | 'complete' | 'error';

// 채팅 메시지
export interface ChatMessage {
  id: string;                    // 메시지 고유 ID
  role: MessageRole;             // 'user' 또는 'assistant'
  content: string;               // 메시지 내용
  timestamp: number;             // 메시지 생성 시간 (Unix timestamp)
  status?: MessageStatus;        // AI 응답의 상태 (사용자 메시지는 없음)
}
