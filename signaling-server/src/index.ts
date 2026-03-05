/**
 * Claude Mobile Remote - 시그널링 서버
 * Cloudflare Workers + KV 기반
 *
 * PC Agent와 모바일 앱을 페어링 코드로 연결하는 중개 서버
 *
 * 엔드포인트:
 *   POST   /register       - PC가 IP/포트 등록
 *   GET    /discover/:code  - 모바일이 PC IP 조회
 *   PUT    /heartbeat       - PC가 주기적으로 TTL 갱신 + IP 변경 감지
 *   DELETE /unregister      - PC 종료 시 등록 해제
 */

// KV에 저장되는 페어링 데이터 구조
interface PairData {
  ip: string;
  port: number;
  tokenHash: string; // SHA-256 해시 (원본 토큰은 저장하지 않음)
  registeredAt: string; // ISO 타임스탬프
  lastHeartbeat: string; // 마지막 하트비트 시각
}

// Workers 환경 바인딩 타입
interface Env {
  PAIRS: KVNamespace; // wrangler.toml에서 바인딩된 KV
}

// KV TTL: 15분 (하트비트 간격 10분 + 여유 5분)
const KV_TTL_SECONDS = 900;

// KV 키 접두사
const KEY_PREFIX = 'pair:';

/**
 * SHA-256 해시 생성
 * 토큰을 평문으로 저장하지 않기 위해 해시 사용
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * CORS 헤더 추가
 * 모바일 앱에서 직접 호출하므로 모든 origin 허용
 */
function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * JSON 응답 헬퍼
 */
function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

/**
 * 에러 응답 헬퍼
 */
function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ─── 엔드포인트 핸들러 ────────────────────────────────────

/**
 * POST /register
 * PC Agent가 시작할 때 자신의 IP/포트를 등록
 *
 * Body: { pairCode, ip, port, token }
 * - pairCode: 6자리 영숫자 (예: "A3K9X2")
 * - ip: PC의 공인 IP
 * - port: WebSocket 서버 포트
 * - token: 인증 토큰 (UUID, SHA-256으로 해시하여 저장)
 */
async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    pairCode: string;
    ip: string;
    port: number;
    token: string;
  }>();

  const { pairCode, ip, port, token } = body;

  // 필수 필드 검증
  if (!pairCode || !ip || !port || !token) {
    return errorResponse('pairCode, ip, port, token 모두 필요합니다.');
  }

  // 페어링 코드 형식 검증 (6자리 영숫자)
  if (!/^[A-Z0-9]{6}$/.test(pairCode)) {
    return errorResponse('페어링 코드는 6자리 대문자+숫자여야 합니다.');
  }

  // 토큰을 해시하여 저장 (보안)
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();

  const pairData: PairData = {
    ip,
    port,
    tokenHash,
    registeredAt: now,
    lastHeartbeat: now,
  };

  // KV에 저장 (TTL 5분 - 하트비트 없으면 자동 만료)
  await env.PAIRS.put(KEY_PREFIX + pairCode, JSON.stringify(pairData), {
    expirationTtl: KV_TTL_SECONDS,
  });

  return jsonResponse({
    success: true,
    message: `페어링 코드 ${pairCode} 등록 완료`,
    expiresIn: KV_TTL_SECONDS,
  });
}

/**
 * GET /discover/:code
 * 모바일 앱이 페어링 코드로 PC의 IP/포트를 조회
 *
 * 응답: { ip, port } (토큰 해시는 미포함 - 보안)
 */
async function handleDiscover(
  pairCode: string,
  env: Env,
): Promise<Response> {
  // 페어링 코드 형식 검증
  if (!/^[A-Z0-9]{6}$/.test(pairCode)) {
    return errorResponse('유효하지 않은 페어링 코드 형식입니다.');
  }

  // KV에서 조회
  const data = await env.PAIRS.get(KEY_PREFIX + pairCode);

  if (!data) {
    return errorResponse('등록된 PC를 찾을 수 없습니다. 코드를 확인하세요.', 404);
  }

  const pairData: PairData = JSON.parse(data);

  // 민감 정보(tokenHash) 제외하고 응답
  return jsonResponse({
    ip: pairData.ip,
    port: pairData.port,
    registeredAt: pairData.registeredAt,
    lastHeartbeat: pairData.lastHeartbeat,
  });
}

/**
 * PUT /heartbeat
 * PC Agent가 2분마다 호출하여 등록을 갱신
 * - TTL을 다시 5분으로 리셋
 * - IP가 변경되었으면 업데이트
 *
 * Body: { pairCode, token, ip?, port? }
 */
async function handleHeartbeat(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    pairCode: string;
    token: string;
    ip?: string;
    port?: number;
  }>();

  const { pairCode, token, ip, port } = body;

  if (!pairCode || !token) {
    return errorResponse('pairCode와 token이 필요합니다.');
  }

  // 기존 데이터 조회
  const data = await env.PAIRS.get(KEY_PREFIX + pairCode);

  if (!data) {
    return errorResponse('등록되지 않은 페어링 코드입니다. 다시 등록해주세요.', 404);
  }

  const pairData: PairData = JSON.parse(data);

  // 토큰 검증 (해시 비교)
  const tokenHash = await hashToken(token);
  if (tokenHash !== pairData.tokenHash) {
    return errorResponse('인증 토큰이 일치하지 않습니다.', 403);
  }

  // IP/포트 변경 감지 및 업데이트
  let ipChanged = false;
  if (ip && ip !== pairData.ip) {
    pairData.ip = ip;
    ipChanged = true;
  }
  if (port && port !== pairData.port) {
    pairData.port = port;
  }

  // 하트비트 시각 갱신
  pairData.lastHeartbeat = new Date().toISOString();

  // TTL을 다시 5분으로 갱신하여 저장
  await env.PAIRS.put(KEY_PREFIX + pairCode, JSON.stringify(pairData), {
    expirationTtl: KV_TTL_SECONDS,
  });

  return jsonResponse({
    success: true,
    ipChanged,
    currentIp: pairData.ip,
  });
}

/**
 * DELETE /unregister
 * PC Agent 종료 시 등록 해제
 *
 * Body: { pairCode, token }
 */
async function handleUnregister(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await request.json<{
    pairCode: string;
    token: string;
  }>();

  const { pairCode, token } = body;

  if (!pairCode || !token) {
    return errorResponse('pairCode와 token이 필요합니다.');
  }

  // 기존 데이터 조회
  const data = await env.PAIRS.get(KEY_PREFIX + pairCode);

  if (!data) {
    // 이미 만료/삭제됨 - 성공으로 처리
    return jsonResponse({ success: true, message: '이미 등록 해제되었습니다.' });
  }

  const pairData: PairData = JSON.parse(data);

  // 토큰 검증
  const tokenHash = await hashToken(token);
  if (tokenHash !== pairData.tokenHash) {
    return errorResponse('인증 토큰이 일치하지 않습니다.', 403);
  }

  // KV에서 삭제
  await env.PAIRS.delete(KEY_PREFIX + pairCode);

  return jsonResponse({
    success: true,
    message: `페어링 코드 ${pairCode} 등록 해제 완료`,
  });
}

// ─── 메인 라우터 ────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // CORS Preflight 처리
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      // 라우팅
      if (method === 'POST' && url.pathname === '/register') {
        return await handleRegister(request, env);
      }

      if (method === 'GET' && url.pathname.startsWith('/discover/')) {
        const code = url.pathname.split('/discover/')[1]?.toUpperCase();
        if (!code) {
          return errorResponse('페어링 코드가 필요합니다.');
        }
        return await handleDiscover(code, env);
      }

      if (method === 'PUT' && url.pathname === '/heartbeat') {
        return await handleHeartbeat(request, env);
      }

      if (method === 'DELETE' && url.pathname === '/unregister') {
        return await handleUnregister(request, env);
      }

      // 헬스체크
      if (method === 'GET' && url.pathname === '/') {
        return jsonResponse({
          service: 'claude-mobile-signaling',
          status: 'running',
          version: '1.0.0',
        });
      }

      // 404
      return errorResponse('엔드포인트를 찾을 수 없습니다.', 404);
    } catch (err) {
      // 예기치 못한 에러 처리
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      return errorResponse(`서버 오류: ${message}`, 500);
    }
  },
};
