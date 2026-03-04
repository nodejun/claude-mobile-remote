/**
 * 시그널링 서비스 (모바일 클라이언트)
 * Cloudflare Workers 시그널링 서버에서 PC Agent의 IP/포트를 조회
 *
 * 사용 흐름:
 *   1. 사용자가 페어링 코드 입력
 *   2. discover(code)로 PC IP/포트 조회
 *   3. 받은 정보로 WebSocket 연결
 */

/** 시그널링 서버 URL */
// TODO: 배포 후 실제 Workers URL로 교체
const SIGNALING_SERVER_URL =
  'https://claude-mobile-signaling.nodejun.workers.dev';

/** discover 응답 타입 */
export interface DiscoverResult {
  ip: string;
  port: number;
  registeredAt: string;
  lastHeartbeat: string;
}

/** 시그널링 에러 타입 */
export class SignalingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'SignalingError';
  }
}

class SignalingService {
  /**
   * 페어링 코드로 PC Agent의 IP/포트 조회
   *
   * @param pairCode 6자리 페어링 코드 (예: "A3K9X2")
   * @returns PC Agent의 IP, 포트, 등록 시각
   * @throws SignalingError 코드가 유효하지 않거나 PC를 찾을 수 없을 때
   */
  async discover(pairCode: string): Promise<DiscoverResult> {
    const code = pairCode.toUpperCase().trim();

    // 클라이언트측 형식 검증
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      throw new SignalingError(
        '페어링 코드는 6자리 영문+숫자입니다.',
        400,
      );
    }

    try {
      const response = await fetch(
        `${SIGNALING_SERVER_URL}/discover/${code}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        // 서버에서 보낸 에러 메시지 사용
        throw new SignalingError(
          data.error || 'PC를 찾을 수 없습니다.',
          response.status,
        );
      }

      return data as DiscoverResult;
    } catch (error) {
      // SignalingError는 그대로 throw
      if (error instanceof SignalingError) {
        throw error;
      }

      // 네트워크 에러
      throw new SignalingError(
        '시그널링 서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.',
        0,
      );
    }
  }

  /**
   * 시그널링 서버 상태 확인 (헬스체크)
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(SIGNALING_SERVER_URL, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// 싱글톤 인스턴스
export const signalingService = new SignalingService();
