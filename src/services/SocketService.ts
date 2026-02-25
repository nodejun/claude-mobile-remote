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

// 파일 작업 결과 타입
export interface FileOperationResult {
  success: boolean;
  filePath?: string;
  error?: {
    code: string;
    message: string;
  };
}

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
      console.log('✅ Socket 연결 성공:', this.socket?.id);
      this.notifyStatusChange('connected');

      // 기존에 등록된 리스너들을 새 소켓에 다시 등록
      this.reattachListeners();
    });

    // 연결 해제
    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket 연결 해제:', reason);
      this.notifyStatusChange('disconnected');
    });

    // 연결 에러
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket 연결 에러:', error.message);
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
      console.log(`📤 emit: ${event}`, data);
      this.socket.emit(event, data);
    } else {
      console.warn('⚠️ Socket이 연결되지 않음, emit 실패:', event);
    }
  }

  /**
   * 이벤트 리스너 등록 (제네릭 타입 지원)
   * @returns unsubscribe 함수
   */
  on<T = unknown>(event: string, listener: (data: T) => void): () => void {
    if (!this.messageListeners.has(event)) {
      this.messageListeners.set(event, []);
    }
    this.messageListeners.get(event)!.push(listener as MessageListener);

    // 실제 소켓에도 리스너 등록
    if (this.socket) {
      this.socket.on(event, listener as MessageListener);
      console.log(`✅ 리스너 등록됨: ${event} (소켓 연결됨)`);
    } else {
      console.log(`⏳ 리스너 저장됨: ${event} (소켓 연결 대기 중)`);
    }

    // 해제 함수 반환
    return () => {
      this.off(event, listener as MessageListener);
    };
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
   * 기존 리스너들을 새 소켓에 다시 등록
   * (재연결 시 리스너 유지용)
   */
  private reattachListeners(): void {
    if (!this.socket) {
      console.log('⚠️ reattachListeners: 소켓이 없음');
      return;
    }

    const events = Array.from(this.messageListeners.keys());
    console.log('🔄 reattachListeners 시작, 등록된 이벤트:', events);

    this.messageListeners.forEach((listeners, event) => {
      console.log(`  - ${event}: ${listeners.length}개 리스너`);
      listeners.forEach((listener) => {
        this.socket?.on(event, listener);
      });
    });

    console.log('✅ 리스너 재등록 완료');
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

  /**
   * 변경 승인
   */
  async approveChange(changeId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: '연결되지 않음' });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: '응답 시간 초과' });
      }, 10000);

      this.socket.emit('approve_change', { changeId });
      this.socket.once('change_approved', (data: { success: boolean; error?: string }) => {
        clearTimeout(timeout);
        resolve(data);
      });
      this.socket.once('error', (data: { message: string }) => {
        clearTimeout(timeout);
        resolve({ success: false, error: data.message });
      });
    });
  }

  /**
   * 변경 거부
   */
  async rejectChange(changeId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: '연결되지 않음' });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: '응답 시간 초과' });
      }, 10000);

      this.socket.emit('reject_change', { changeId });
      this.socket.once('change_rejected', (data: { success: boolean; error?: string }) => {
        clearTimeout(timeout);
        resolve(data);
      });
      this.socket.once('error', (data: { message: string }) => {
        clearTimeout(timeout);
        resolve({ success: false, error: data.message });
      });
    });
  }

  /**
   * 파일 저장
   */
  async saveFile(
    filePath: string,
    content: string
  ): Promise<{ success: boolean; filePath?: string; size?: number; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: '연결되지 않음' });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: '응답 시간 초과' });
      }, 10000);

      this.socket.emit('save_file', { filePath, content });
      this.socket.once(
        'file_saved',
        (data: { success: boolean; filePath: string; size: number }) => {
          clearTimeout(timeout);
          resolve(data);
        }
      );
      this.socket.once('error', (data: { message: string }) => {
        clearTimeout(timeout);
        resolve({ success: false, error: data.message });
      });
    });
  }

  /**
   * 파일/폴더 생성
   */
  async createFile(
    filePath: string,
    isDirectory: boolean,
    content?: string
  ): Promise<FileOperationResult> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({
          success: false,
          error: { code: 'NO_CONNECTION', message: '연결되지 않음' },
        });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: { code: 'TIMEOUT', message: '응답 시간 초과' },
        });
      }, 10000);

      this.socket.emit('create_file', { filePath, isDirectory, content });
      this.socket.once('file_operation_result', (data: FileOperationResult) => {
        clearTimeout(timeout);
        resolve(data);
      });
      this.socket.once('error', (data: { message: string }) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: { code: 'SERVER_ERROR', message: data.message },
        });
      });
    });
  }

  /**
   * 파일/폴더 삭제
   */
  async deleteFile(filePath: string): Promise<FileOperationResult> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({
          success: false,
          error: { code: 'NO_CONNECTION', message: '연결되지 않음' },
        });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: { code: 'TIMEOUT', message: '응답 시간 초과' },
        });
      }, 10000);

      this.socket.emit('delete_file', { filePath });
      this.socket.once('file_operation_result', (data: FileOperationResult) => {
        clearTimeout(timeout);
        resolve(data);
      });
      this.socket.once('error', (data: { message: string }) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: { code: 'SERVER_ERROR', message: data.message },
        });
      });
    });
  }

  /**
   * 파일/폴더 이름 변경
   */
  async renameFile(filePath: string, newName: string): Promise<FileOperationResult> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({
          success: false,
          error: { code: 'NO_CONNECTION', message: '연결되지 않음' },
        });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: { code: 'TIMEOUT', message: '응답 시간 초과' },
        });
      }, 10000);

      this.socket.emit('rename_file', { filePath, newName });
      this.socket.once('file_operation_result', (data: FileOperationResult) => {
        clearTimeout(timeout);
        resolve(data);
      });
      this.socket.once('error', (data: { message: string }) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: { code: 'SERVER_ERROR', message: data.message },
        });
      });
    });
  }
  /**
   * 파일 검색
   * @param query - 검색어
   * @param type - 검색 타입 (filename: 파일명, content: 내용)
   * @param searchPath - 검색 시작 경로 (선택)
   */
  async searchFiles(
    query: string,
    type: 'filename' | 'content',
    searchPath?: string
  ): Promise<{
    query: string;
    type: 'filename' | 'content';
    results: Array<{
      name: string;
      relativePath: string;
      isDirectory: boolean;
      matches?: { line: number; text: string }[];
    }>;
    totalCount: number;
  }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ query, type, results: [], totalCount: 0 });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ query, type, results: [], totalCount: 0 });
      }, 15000); // 내용 검색은 오래 걸릴 수 있으므로 15초

      this.socket.emit('search_files', { query, type, path: searchPath });
      this.socket.once('search_result', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      this.socket.once('error', () => {
        clearTimeout(timeout);
        resolve({ query, type, results: [], totalCount: 0 });
      });
    });
  }
}

// 싱글톤 인스턴스
export const socketService = new SocketService();
