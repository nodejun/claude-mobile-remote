/**
 * 시그널링 서비스
 * PC Agent가 시작될 때 자동으로 시그널링 서버에 등록하고,
 * 주기적으로 하트비트를 보내 연결을 유지
 *
 * 생명주기:
 *   onModuleInit()    → 페어링 코드 로드/생성 → 등록 → 하트비트 시작
 *   onModuleDestroy()  → 등록 해제 → 하트비트 정리
 */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  SIGNALING_SERVER_URL,
  HEARTBEAT_INTERVAL_MS,
  PUBLIC_IP_API,
  PAIR_CODE_CONFIG,
  PAIR_FILE_DIR,
  PAIR_FILE_NAME,
} from './signaling.constants';

/** 페어링 정보 파일 구조 */
interface PairInfo {
  pairCode: string;
  token: string;
}

@Injectable()
export class SignalingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SignalingService.name);

  /** 현재 페어링 정보 */
  private pairCode: string = '';
  private token: string = '';

  /** 현재 공인 IP */
  private publicIp: string = '';

  /** WebSocket 서버 포트 */
  private port: number = 3000;

  /** 하트비트 타이머 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** 시그널링 서버 등록 여부 */
  private isRegistered: boolean = false;

  /**
   * 모듈 초기화 시 자동 호출
   * 페어링 코드 로드 → 공인 IP 조회 → 서버 등록 → 하트비트 시작
   */
  async onModuleInit() {
    try {
      // 1. 포트 설정
      this.port = parseInt(process.env.PORT || '3000', 10);

      // 2. 페어링 코드 로드 또는 생성
      this.loadOrCreatePairInfo();

      // 3. 공인 IP 조회
      await this.fetchPublicIp();

      // 4. 시그널링 서버에 등록
      await this.register();

      // 5. 콘솔에 페어링 코드 배너 출력
      this.printPairBanner();

      // 6. 하트비트 타이머 시작
      this.startHeartbeat();
    } catch (error) {
      // 시그널링 실패해도 서버는 정상 동작 (수동 연결 가능)
      this.logger.warn(
        `시그널링 초기화 실패 (수동 연결은 정상 동작): ${error}`,
      );
    }
  }

  /**
   * 모듈 종료 시 자동 호출
   * 하트비트 정리 + 등록 해제
   */
  async onModuleDestroy() {
    this.stopHeartbeat();

    if (this.isRegistered) {
      try {
        await this.unregister();
      } catch (error) {
        this.logger.warn(`등록 해제 실패: ${error}`);
      }
    }
  }

  // ─── 공개 API ────────────────────────────────────

  /**
   * 현재 페어링 정보 반환 (Gateway에서 호출)
   */
  getPairInfo(): { pairCode: string; publicIp: string; port: number } {
    return {
      pairCode: this.pairCode,
      publicIp: this.publicIp,
      port: this.port,
    };
  }

  // ─── 페어링 코드 관리 ────────────────────────────────────

  /**
   * 페어링 정보 파일 경로: ~/.claude-mobile/pair.json
   */
  private getPairFilePath(): string {
    return path.join(os.homedir(), PAIR_FILE_DIR, PAIR_FILE_NAME);
  }

  /**
   * 페어링 정보 로드 또는 최초 생성
   * - 파일이 있으면: 기존 코드+토큰 로드 (고정 코드)
   * - 파일이 없으면: 새로 생성하여 저장
   */
  private loadOrCreatePairInfo(): void {
    const filePath = this.getPairFilePath();

    try {
      if (fs.existsSync(filePath)) {
        // 기존 파일에서 로드
        const data = fs.readFileSync(filePath, 'utf-8');
        const pairInfo: PairInfo = JSON.parse(data);

        if (pairInfo.pairCode && pairInfo.token) {
          this.pairCode = pairInfo.pairCode;
          this.token = pairInfo.token;
          this.logger.log(`기존 페어링 코드 로드: ${this.pairCode}`);
          return;
        }
      }
    } catch {
      this.logger.warn('페어링 파일 읽기 실패, 새로 생성합니다.');
    }

    // 새 코드 생성
    this.pairCode = this.generatePairCode();
    this.token = uuidv4();

    // 파일에 저장
    this.savePairInfo();
    this.logger.log(`새 페어링 코드 생성: ${this.pairCode}`);
  }

  /**
   * 6자리 페어링 코드 생성
   * 혼동 방지 문자(0/O, 1/I/L) 제외
   */
  private generatePairCode(): string {
    const { CHARACTERS, LENGTH } = PAIR_CODE_CONFIG;
    let code = '';
    for (let i = 0; i < LENGTH; i++) {
      const randomIndex = Math.floor(Math.random() * CHARACTERS.length);
      code += CHARACTERS[randomIndex];
    }
    return code;
  }

  /**
   * 페어링 정보를 파일에 저장
   */
  private savePairInfo(): void {
    const filePath = this.getPairFilePath();
    const dirPath = path.dirname(filePath);

    // 디렉토리 생성
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const pairInfo: PairInfo = {
      pairCode: this.pairCode,
      token: this.token,
    };

    fs.writeFileSync(filePath, JSON.stringify(pairInfo, null, 2), 'utf-8');
    this.logger.log(`페어링 정보 저장: ${filePath}`);
  }

  // ─── 공인 IP 조회 ────────────────────────────────────

  /**
   * api.ipify.org를 통해 공인 IP 조회
   */
  private async fetchPublicIp(): Promise<void> {
    try {
      const response = await fetch(PUBLIC_IP_API);

      if (!response.ok) {
        throw new Error(`IP 조회 실패: ${response.status}`);
      }

      this.publicIp = (await response.text()).trim();
      this.logger.log(`공인 IP: ${this.publicIp}`);
    } catch (error) {
      this.logger.warn(`공인 IP 조회 실패: ${error}`);
      // fallback: 로컬 네트워크 IP
      this.publicIp = this.getLocalIp();
      this.logger.log(`로컬 IP 사용: ${this.publicIp}`);
    }
  }

  /**
   * 로컬 네트워크 IP 조회 (fallback용)
   */
  private getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  // ─── 시그널링 서버 통신 ────────────────────────────────────

  /**
   * 시그널링 서버에 등록 (POST /register)
   */
  private async register(): Promise<void> {
    const response = await fetch(`${SIGNALING_SERVER_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairCode: this.pairCode,
        ip: this.publicIp,
        port: this.port,
        token: this.token,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`등록 실패: ${response.status} - ${error}`);
    }

    this.isRegistered = true;
    this.logger.log('시그널링 서버 등록 완료');
  }

  /**
   * 시그널링 서버에서 등록 해제 (DELETE /unregister)
   */
  private async unregister(): Promise<void> {
    const response = await fetch(`${SIGNALING_SERVER_URL}/unregister`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairCode: this.pairCode,
        token: this.token,
      }),
    });

    if (response.ok) {
      this.isRegistered = false;
      this.logger.log('시그널링 서버 등록 해제 완료');
    }
  }

  // ─── 하트비트 ────────────────────────────────────

  /**
   * 하트비트 타이머 시작 (2분 간격)
   * - TTL 갱신
   * - IP 변경 감지 및 업데이트
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    this.logger.log(`하트비트 시작 (${HEARTBEAT_INTERVAL_MS / 1000}초 간격)`);
  }

  /**
   * 하트비트 1회 전송 (async 로직 분리)
   * - 공인 IP 재조회 (변경 감지)
   * - PUT /heartbeat로 TTL 갱신
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      // 최신 공인 IP 조회 (변경 감지용)
      const previousIp = this.publicIp;
      await this.fetchPublicIp();

      const response = await fetch(`${SIGNALING_SERVER_URL}/heartbeat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairCode: this.pairCode,
          token: this.token,
          ip: this.publicIp,
          port: this.port,
        }),
      });

      if (!response.ok) {
        // 서버에서 찾을 수 없으면 재등록
        if (response.status === 404) {
          this.logger.warn('하트비트 실패 (404) - 재등록 시도');
          await this.register();
          return;
        }
        throw new Error(`하트비트 실패: ${response.status}`);
      }

      const result = await response.json();
      if (result.ipChanged) {
        this.logger.log(`IP 변경 감지: ${previousIp} → ${this.publicIp}`);
      }
    } catch (error) {
      this.logger.warn(`하트비트 오류: ${error}`);
    }
  }

  /**
   * 하트비트 타이머 정리
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.logger.log('하트비트 중지');
    }
  }

  // ─── 콘솔 출력 ────────────────────────────────────

  /**
   * 페어링 코드 배너 출력
   * PC Agent 시작 시 콘솔에 눈에 띄게 표시
   */
  private printPairBanner(): void {
    const banner = `
╔══════════════════════════════════════╗
║                                      ║
║   📱 모바일 앱 연결 코드             ║
║                                      ║
║       ${this.pairCode}                       ║
║                                      ║
║   모바일 앱에서 위 코드를 입력하세요  ║
║   IP: ${this.publicIp.padEnd(20)}       ║
║   Port: ${String(this.port).padEnd(19)}       ║
║                                      ║
╚══════════════════════════════════════╝`;
    console.log(banner);
  }
}
