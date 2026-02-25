/**
 * AsyncStorage 기반 로컬 저장소 서비스
 * 앱 설정, 서버 연결 기록, 채팅 메시지를 관리
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from '../types/chat';

// ─── 타입 정의 ──────────────────────────────────────────

/** 앱 설정 */
export interface AppSettings {
  /** 코드 뷰어 글꼴 크기 (pt) */
  codeFontSize: number;
  /** 다크 모드 활성화 여부 */
  darkMode: boolean;
}

// ─── 상수 ──────────────────────────────────────────────

/** 기본 설정값 */
const DEFAULT_SETTINGS: AppSettings = {
  codeFontSize: 13,
  darkMode: false,
};

/** AsyncStorage 키 */
const STORAGE_KEYS = {
  SETTINGS: '@app_settings',
  RECENT_SERVERS: '@recent_servers',
  CHAT_MESSAGES: '@chat_messages',
} as const;

/** 최근 서버 URL 최대 저장 수 */
const MAX_RECENT_SERVERS = 5;

// ─── 서비스 클래스 ──────────────────────────────────────

class StorageService {
  // ═══ 앱 설정 ═══

  /**
   * 앱 설정 조회
   * 저장된 설정이 없으면 기본값 반환
   */
  async getSettings(): Promise<AppSettings> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (json) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
      }
      return { ...DEFAULT_SETTINGS };
    } catch (error) {
      console.error('❌ 설정 로드 실패:', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * 앱 설정 저장 (부분 업데이트 지원)
   * 전달된 키만 업데이트하고 나머지는 유지
   */
  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await AsyncStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify(updated),
      );
      console.log('✅ 설정 저장됨:', updated);
    } catch (error) {
      console.error('❌ 설정 저장 실패:', error);
    }
  }

  // ═══ 서버 URL 기록 ═══

  /**
   * 최근 연결 서버 URL 목록 조회
   * 가장 최근에 연결한 서버가 배열 앞에 위치
   */
  async getRecentServers(): Promise<string[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_SERVERS);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error('❌ 서버 기록 로드 실패:', error);
      return [];
    }
  }

  /**
   * 서버 URL 추가 (중복 제거, 최대 5개 유지)
   * 이미 있으면 맨 앞으로 이동
   */
  async addRecentServer(url: string): Promise<void> {
    try {
      const servers = await this.getRecentServers();
      // 중복 제거 후 맨 앞에 추가
      const filtered = servers.filter((s) => s !== url);
      const updated = [url, ...filtered].slice(0, MAX_RECENT_SERVERS);
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECENT_SERVERS,
        JSON.stringify(updated),
      );
      console.log('✅ 서버 기록 추가:', url);
    } catch (error) {
      console.error('❌ 서버 기록 저장 실패:', error);
    }
  }

  /**
   * 서버 URL 삭제
   */
  async removeRecentServer(url: string): Promise<void> {
    try {
      const servers = await this.getRecentServers();
      const updated = servers.filter((s) => s !== url);
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECENT_SERVERS,
        JSON.stringify(updated),
      );
      console.log('✅ 서버 기록 삭제:', url);
    } catch (error) {
      console.error('❌ 서버 기록 삭제 실패:', error);
    }
  }

  // ═══ 채팅 메시지 ═══

  /**
   * 채팅 메시지 저장
   * streaming/sending 상태 메시지는 제외하고 저장
   */
  async saveChatMessages(messages: ChatMessage[]): Promise<void> {
    try {
      // 완료된 메시지만 필터링 (streaming/sending 제외)
      const completedMessages = messages.filter(
        (msg) =>
          msg.role === 'user' ||
          msg.status === 'complete' ||
          msg.status === 'error',
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.CHAT_MESSAGES,
        JSON.stringify(completedMessages),
      );
    } catch (error) {
      console.error('❌ 채팅 저장 실패:', error);
    }
  }

  /**
   * 저장된 채팅 메시지 불러오기
   */
  async loadChatMessages(): Promise<ChatMessage[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error('❌ 채팅 로드 실패:', error);
      return [];
    }
  }

  /**
   * 채팅 메시지 전체 삭제
   */
  async clearChatMessages(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CHAT_MESSAGES);
      console.log('✅ 채팅 기록 삭제됨');
    } catch (error) {
      console.error('❌ 채팅 삭제 실패:', error);
    }
  }
}

// 싱글톤 인스턴스
export const storageService = new StorageService();
