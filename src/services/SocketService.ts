/**
 * Socket.io 연결 관리 서비스
 * PC Agent와의 WebSocket 통신 담당
 */
import { io, Socket } from 'socket.io-client';

// 연결 상태 타입
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// 이벤트 리스너 타입
type StatusListener = (status: ConnectionStatus) => void;
type MessageListener = (data: unknown) => void;

class SocketService {
  private socket: Socket | null = null;
  private statusListeners: StatusListener[] = [];
  private messageListeners: Map<string, MessageListener[]> = new Map();

  /**
   * 서버에 연결
   * @param serverUrl - PC Agent 서버 URL (예: http://192.168.0.10:3000)
   */
  connect(serverUrl: string): void {
    // 이미 연결된 경우 먼저 연결 해제
    if (this.socket) {
      this.disconnect();
    }

    this.notifyStatusChange('connecting');

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });

    // 연결 성공
    this.socket.on('connect', () => {
      console.log('Socket 연결 성공:', this.socket?.id);
      this.notifyStatusChange('connected');
    });

    // 연결 해제
    this.socket.on('disconnect', (reason) => {
      console.log('Socket 연결 해제:', reason);
      this.notifyStatusChange('disconnected');
    });

    // 연결 에러
    this.socket.on('connect_error', (error) => {
      console.error('Socket 연결 에러:', error.message);
      this.notifyStatusChange('error');
    });
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.notifyStatusChange('disconnected');
    }
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * 이벤트 전송
   */
  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket이 연결되지 않음');
    }
  }

  /**
   * 이벤트 리스너 등록
   */
  on(event: string, listener: MessageListener): void {
    if (!this.messageListeners.has(event)) {
      this.messageListeners.set(event, []);
    }
    this.messageListeners.get(event)!.push(listener);

    // 실제 소켓에도 리스너 등록
    this.socket?.on(event, listener);
  }

  /**
   * 이벤트 리스너 해제
   */
  off(event: string, listener: MessageListener): void {
    const listeners = this.messageListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    this.socket?.off(event, listener);
  }

  /**
   * 연결 상태 변경 리스너 등록
   */
  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);

    // 해제 함수 반환
    return () => {
      const index = this.statusListeners.indexOf(listener);
      if (index > -1) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  /**
   * 상태 변경 알림
   */
  private notifyStatusChange(status: ConnectionStatus): void {
    this.statusListeners.forEach(listener => listener(status));
  }

  /**
   * Ping 테스트
   */
  async ping(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => resolve(false), 5000);

      this.socket.emit('ping');
      this.socket.once('pong', () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }
}

// 싱글톤 인스턴스
export const socketService = new SocketService();
