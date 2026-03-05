import { Injectable } from '@nestjs/common';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';

import { CLAUDE_CLI_CONFIG } from '#constants/claude.constants';
import type {
  ClaudeResponse,
  ClaudeAssistantResponse,
} from '#interfaces/claude.interface';

/**
 * Claude CLI 서비스
 * node-pty를 사용하여 PTY(가상 터미널)로 Claude CLI 실행
 * Windows에서 실시간 stdout 수신을 위해 필수
 */
@Injectable()
export class ClaudeService {
  /**
   * Claude CLI 인자 배열 생성
   * @param sessionId - 세션 UUID
   * @param message - 사용자 메시지
   * @param isFirstPrompt - 첫 번째 프롬프트 여부
   * @returns Claude CLI 인자 배열
   */
  buildClaudeArgs(
    sessionId: string,
    message: string,
    isFirstPrompt: boolean,
  ): string[] {
    const args: string[] = [...CLAUDE_CLI_CONFIG.BASE_OPTIONS];

    if (isFirstPrompt) {
      // 첫 번째 프롬프트: --session-id로 새 세션 시작
      args.push('--session-id', sessionId);
    } else {
      // 이후 프롬프트: --resume으로 기존 세션 이어가기
      args.push('--resume', sessionId);
    }

    // 메시지 추가
    args.push(message);

    return args;
  }

  /**
   * Claude CLI 명령어 문자열 생성 (PowerShell용)
   * @param args - Claude CLI 인자 배열
   * @returns 전체 명령어 문자열
   */
  buildClaudeCommand(args: string[]): string {
    // PowerShell용 인자 이스케이프
    // 작은따옴표로 감싸면 변수 확장 없이 리터럴로 처리됨
    const escapedArgs = args.map((arg) => {
      // 작은따옴표가 있으면 두 개로 이스케이프, 전체를 작은따옴표로 감싸기
      const escaped = arg.replace(/'/g, "''");
      return `'${escaped}'`;
    });

    return `${CLAUDE_CLI_CONFIG.COMMAND} ${escapedArgs.join(' ')}`;
  }

  /**
   * Claude PTY 프로세스 생성 및 실행
   * node-pty를 사용하여 가상 터미널에서 실행 (Windows 실시간 출력 지원)
   * @param args - Claude CLI 인자 배열
   * @param cwd - 작업 디렉토리
   * @returns IPty 인스턴스
   */
  spawnClaudePtyProcess(args: string[], cwd: string): IPty {
    const command = this.buildClaudeCommand(args);

    // Windows: PowerShell 사용 (유니코드/한글 지원 우수), Unix: bash 사용
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const shellArgs =
      process.platform === 'win32'
        ? ['-NoProfile', '-Command', command]
        : ['-c', command];

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-color',
      cols: 32000, // JSON 라인이 래핑되지 않도록 매우 크게 설정
      rows: 30,
      cwd,
      env: process.env as { [key: string]: string },
    });

    console.log(`🚀 Claude PTY 프로세스 시작, PID: ${ptyProcess.pid}`);
    console.log(`📝 명령어: ${command}`);

    return ptyProcess;
  }

  /**
   * ANSI 이스케이프 코드 제거
   * PTY 출력에 포함된 컬러/커서 제어 코드 제거
   * @param text - ANSI 코드가 포함된 텍스트
   * @returns 순수 텍스트
   */
  stripAnsi(text: string): string {
    // ANSI 이스케이프 시퀀스 패턴
    // eslint-disable-next-line no-control-regex
    const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
    return text.replace(ansiRegex, '');
  }

  /**
   * JSON 라인 파싱
   * stream-json은 각 라인이 독립적인 JSON 객체
   * @param line - JSON 문자열 라인
   * @returns 파싱된 객체 또는 null
   */
  parseJsonLine(line: string): ClaudeResponse | null {
    // ANSI 코드 제거 후 트림
    const trimmed = this.stripAnsi(line).trim();
    if (!trimmed || !trimmed.startsWith('{')) {
      return null;
    }

    try {
      return JSON.parse(trimmed) as ClaudeResponse;
    } catch {
      console.warn('⚠️ JSON 파싱 실패:', trimmed.substring(0, 100));
      return null;
    }
  }

  /**
   * assistant 응답에서 텍스트 추출
   * @param response - Claude assistant 응답
   * @returns 추출된 텍스트
   */
  extractTextFromAssistant(response: ClaudeAssistantResponse): string {
    const textContent = response.message?.content?.find(
      (c) => c.type === 'text',
    );
    return textContent?.text || '';
  }

  /**
   * PTY 프로세스 종료
   * @param ptyProcess - IPty 인스턴스
   */
  killPtyProcess(ptyProcess: IPty): void {
    try {
      ptyProcess.kill();
      console.log('💀 Claude PTY 프로세스 종료됨');
    } catch (error) {
      console.error('프로세스 종료 실패:', error);
    }
  }

  /**
   * PTY 프로세스에 Ctrl+C 전송 (중단)
   * @param ptyProcess - IPty 인스턴스
   */
  interruptPtyProcess(ptyProcess: IPty): void {
    try {
      // Ctrl+C 문자 전송
      ptyProcess.write('\x03');
      console.log('🛑 Ctrl+C 전송 (응답 중단)');
    } catch (error) {
      console.error('프로세스 중단 실패:', error);
    }
  }
}
