/**
 * 시스템 트레이 서비스
 * Windows 시스템 트레이에 아이콘을 표시하고 페어링 정보를 메뉴로 제공
 *
 * 기능:
 *   - 트레이 아이콘 표시 (숨겨진 아이콘 영역)
 *   - 페어링 코드, IP, 포트 메뉴 표시
 *   - 페어링 코드 클릭 시 클립보드 복사
 *   - 종료 메뉴로 서버 안전 종료
 *
 * 의존성:
 *   - systray2: Go 바이너리 기반 시스템 트레이 (NestJS와 같은 프로세스)
 *   - SignalingService: 페어링 코드/IP/포트 정보 제공
 */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { SignalingService } from '../signaling/signaling.service';
import * as fs from 'fs';
import * as path from 'path';

// systray2는 CommonJS 모듈이라 require로 가져옴
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SysTray = require('systray2').default;

/** 트레이 메뉴 아이템 ID */
const MENU_ID = {
  TITLE: 'title',
  PAIR_CODE: 'pair_code',
  IP: 'ip',
  PORT: 'port',
  QUIT: 'quit',
} as const;

@Injectable()
export class TrayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrayService.name);
  private systray: InstanceType<typeof SysTray> | null = null;

  constructor(private readonly signalingService: SignalingService) {}

  /**
   * 모듈 초기화 시 시스템 트레이 생성
   * SignalingService.onModuleInit() 이후에 호출됨 (모듈 import 순서로 보장)
   */
  async onModuleInit() {
    // Windows가 아니면 트레이 미사용
    if (process.platform !== 'win32') {
      this.logger.warn('시스템 트레이는 Windows에서만 지원됩니다.');
      return;
    }

    try {
      await this.createTray();
    } catch (error) {
      // 트레이 실패해도 서버는 정상 동작
      this.logger.warn(`시스템 트레이 생성 실패: ${error}`);
    }
  }

  /**
   * 모듈 종료 시 트레이 정리
   */
  async onModuleDestroy() {
    if (this.systray) {
      try {
        this.systray.kill(false);
        this.logger.log('시스템 트레이 종료');
      } catch {
        // 이미 종료된 경우 무시
      }
    }
  }

  /**
   * 시스템 트레이 생성
   */
  private async createTray(): Promise<void> {
    const iconBase64 = this.loadIconBase64();
    const pairInfo = this.signalingService.getPairInfo();

    this.systray = new SysTray({
      menu: {
        icon: iconBase64,
        title: '',
        tooltip: `Claude Code Mobile Agent - ${pairInfo.pairCode}`,
        items: [
          {
            title: 'Claude Code Mobile Agent',
            tooltip: '서버 실행 중',
            enabled: false, // 클릭 불가 (제목)
          },
          SysTray.separator,
          {
            title: `페어링 코드: ${pairInfo.pairCode}`,
            tooltip: '클릭하면 코드를 복사합니다',
            enabled: true,
          },
          {
            title: `IP: ${pairInfo.publicIp}`,
            tooltip: 'PC 공인 IP',
            enabled: false,
          },
          {
            title: `Port: ${pairInfo.port}`,
            tooltip: 'WebSocket 포트',
            enabled: false,
          },
          SysTray.separator,
          {
            title: '종료',
            tooltip: '서버를 종료합니다',
            enabled: true,
          },
        ],
      },
      debug: false,
      copyDir: true, // Go 바이너리를 임시 폴더에 복사하여 실행 (권한 문제 방지)
    });

    // 트레이 준비 완료
    this.systray.onClick((action: { seq_id: number }) => {
      this.handleMenuClick(action.seq_id);
    });

    this.logger.log('시스템 트레이 생성 완료');
  }

  /**
   * 메뉴 클릭 핸들러
   * seq_id는 메뉴 아이템의 순서 (separator 제외한 인덱스)
   */
  private handleMenuClick(seqId: number): void {
    switch (seqId) {
      case 2: {
        // 페어링 코드 복사
        const pairInfo = this.signalingService.getPairInfo();
        this.copyToClipboard(pairInfo.pairCode);
        this.logger.log(`페어링 코드 클립보드 복사: ${pairInfo.pairCode}`);
        break;
      }
      case 6: {
        // 종료
        this.logger.log('트레이 메뉴에서 종료 요청');
        // 약간의 딜레이 후 종료 (트레이 정리 시간 확보)
        setTimeout(() => {
          process.exit(0);
        }, 500);
        break;
      }
    }
  }

  /**
   * 클립보드에 텍스트 복사 (Windows PowerShell 사용)
   */
  private copyToClipboard(text: string): void {
    try {
      const { execSync } = require('child_process');
      execSync(`powershell -command "Set-Clipboard -Value '${text}'"`, {
        windowsHide: true,
      });
    } catch (error) {
      this.logger.warn(`클립보드 복사 실패: ${error}`);
    }
  }

  /**
   * 아이콘 파일을 base64로 읽기
   * 실행 환경에 따라 여러 경로를 시도
   */
  private loadIconBase64(): string {
    const possiblePaths = [
      // 개발 환경: 프로젝트 루트/assets/icon.ico
      path.join(process.cwd(), 'assets', 'icon.ico'),
      // 인스톨러 환경: 실행 파일과 같은 폴더/assets/icon.ico
      path.join(path.dirname(process.execPath), 'assets', 'icon.ico'),
      // 인스톨러 환경: __dirname 기준
      path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
    ];

    for (const iconPath of possiblePaths) {
      try {
        if (fs.existsSync(iconPath)) {
          const iconData = fs.readFileSync(iconPath);
          this.logger.log(`아이콘 로드: ${iconPath}`);
          return iconData.toString('base64');
        }
      } catch {
        // 다음 경로 시도
      }
    }

    // 기본 빈 아이콘 (아이콘 파일 없을 때)
    this.logger.warn('아이콘 파일을 찾을 수 없어 기본 아이콘 사용');
    return '';
  }
}
