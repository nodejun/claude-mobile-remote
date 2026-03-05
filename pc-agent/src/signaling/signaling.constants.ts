/**
 * 시그널링 서비스 상수
 * Cloudflare Workers 시그널링 서버와 통신하는 데 필요한 설정값
 */

/** 시그널링 서버 URL (Cloudflare Workers) */
// TODO: 배포 후 실제 Workers URL로 교체
export const SIGNALING_SERVER_URL =
  process.env.SIGNALING_URL ||
  'https://claude-mobile-signaling.nodejun.workers.dev';

/** 하트비트 간격 (밀리초) - 10분
 * Cloudflare KV 무료 플랜: 쓰기 1,000회/일 제한
 * 10분 간격 = 하루 144회 쓰기 (14%) → PC 6대까지 여유
 */
export const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;

/** 공인 IP 조회 URL */
export const PUBLIC_IP_API = 'https://api.ipify.org?format=text';

/** 페어링 코드 설정 */
export const PAIR_CODE_CONFIG = {
  /** 코드 길이 */
  LENGTH: 6,
  /** 사용할 문자 (혼동 방지: 0/O, 1/I/L 제외) */
  CHARACTERS: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
} as const;

/** 페어링 정보 저장 경로 (~/.claude-mobile/pair.json) */
export const PAIR_FILE_DIR = '.claude-mobile';
export const PAIR_FILE_NAME = 'pair.json';
