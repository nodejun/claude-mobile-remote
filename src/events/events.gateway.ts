import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { CORS_CONFIG } from '#constants/claude.constants';
import { FILE_ERROR_MESSAGES } from '#constants/file.constants';
import { SessionService } from './session.service';
import { FileService } from './file.service';
import { ClaudeService } from './claude.service';
import type { ClaudeResponse } from '#interfaces/claude.interface';

/**
 * WebSocket 이벤트 게이트웨이
 * 클라이언트와의 실시간 통신 담당 (비즈니스 로직은 서비스에 위임)
 */
@WebSocketGateway({
  cors: {
    origin: CORS_CONFIG.ORIGIN,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly sessionService: SessionService,
    private readonly fileService: FileService,
    private readonly claudeService: ClaudeService,
  ) {}

  /**
   * 클라이언트 연결 시 세션 생성
   */
  handleConnection(client: Socket) {
    console.log(`클라이언트 연결됨: ${client.id}`);
    this.sessionService.createSession(client.id);
  }

  /**
   * 클라이언트 연결 해제 시 세션 정리
   */
  handleDisconnect(client: Socket) {
    console.log(`클라이언트 연결 해제: ${client.id}`);
    this.sessionService.deleteSession(client.id);
  }

  /**
   * Ping 테스트
   */
  @SubscribeMessage('ping')
  handlePing(_client: Socket) {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  /**
   * 현재 응답 중단 (세션은 유지)
   */
  @SubscribeMessage('cancel')
  handleCancel(client: Socket) {
    console.log(`응답 중단 요청: ${client.id}`);

    const session = this.sessionService.getSession(client.id);
    if (session?.claudeProcess) {
      this.claudeService.interruptProcess(session.claudeProcess);
      return { event: 'cancelled', data: { success: true } };
    }

    return {
      event: 'cancelled',
      data: { success: false, reason: 'No active process' },
    };
  }

  /**
   * 세션 완전 종료 (새로 시작)
   */
  @SubscribeMessage('end_session')
  handleEndSession(client: Socket) {
    console.log(`세션 종료 요청: ${client.id}`);

    const newSession = this.sessionService.resetSession(client.id);
    if (newSession) {
      return {
        event: 'session_ended',
        data: { success: true, newSessionId: newSession.sessionId },
      };
    }

    return {
      event: 'session_ended',
      data: { success: false, reason: 'No session found' },
    };
  }

  /**
   * 파일 트리 조회
   */
  @SubscribeMessage('get_file_tree')
  handleGetFileTree(client: Socket, payload: { path?: string }) {
    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return {
        event: 'error',
        data: { message: FILE_ERROR_MESSAGES.NO_SESSION },
      };
    }

    console.log(`📂 파일 트리 요청: ${payload?.path || session.projectPath}`);

    try {
      const result = this.fileService.getFileTree(
        session.projectPath,
        payload?.path,
      );
      return { event: 'file_tree', data: result };
    } catch (error) {
      console.error('❌ 파일 트리 조회 실패:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        event: 'error',
        data: {
          message: `${FILE_ERROR_MESSAGES.FAILED_READ_DIRECTORY}: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * 파일 내용 조회
   */
  @SubscribeMessage('get_file_content')
  handleGetFileContent(client: Socket, payload: { filePath: string }) {
    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return {
        event: 'error',
        data: { message: FILE_ERROR_MESSAGES.NO_SESSION },
      };
    }

    if (!payload?.filePath) {
      return {
        event: 'error',
        data: { message: FILE_ERROR_MESSAGES.FILE_PATH_REQUIRED },
      };
    }

    console.log(`📄 파일 내용 요청: ${payload.filePath}`);

    try {
      const result = this.fileService.getFileContent(
        session.projectPath,
        payload.filePath,
      );
      return { event: 'file_content', data: result };
    } catch (error) {
      console.error('❌ 파일 내용 조회 실패:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        event: 'error',
        data: {
          message: `${FILE_ERROR_MESSAGES.FAILED_READ_FILE}: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * 파일 저장
   */
  @SubscribeMessage('save_file')
  handleSaveFile(
    client: Socket,
    payload: { filePath: string; content: string },
  ) {
    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return {
        event: 'error',
        data: { message: FILE_ERROR_MESSAGES.NO_SESSION },
      };
    }

    if (!payload?.filePath || payload?.content === undefined) {
      return {
        event: 'error',
        data: { message: FILE_ERROR_MESSAGES.FILE_PATH_AND_CONTENT_REQUIRED },
      };
    }

    console.log(`💾 파일 저장 요청: ${payload.filePath}`);

    try {
      const result = this.fileService.saveFile(
        session.projectPath,
        payload.filePath,
        payload.content,
      );
      return { event: 'file_saved', data: result };
    } catch (error) {
      console.error('❌ 파일 저장 실패:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        event: 'error',
        data: {
          message: `${FILE_ERROR_MESSAGES.FAILED_SAVE_FILE}: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * 프롬프트 처리 (Claude CLI 실행 - stream-json 방식)
   */
  @SubscribeMessage('prompt')
  handlePrompt(client: Socket, payload: { message: string }) {
    console.log(`프롬프트 받음: ${payload.message}`);

    const session = this.sessionService.getSession(client.id);
    if (!session) {
      client.emit('error', { message: FILE_ERROR_MESSAGES.NO_SESSION });
      return;
    }

    // 기존 프로세스 종료
    this.sessionService.killExistingProcess(client.id);

    // Claude CLI 인자 생성
    const claudeArgs = this.claudeService.buildClaudeArgs(
      session.sessionId,
      payload.message,
      session.isFirstPrompt,
    );

    if (session.isFirstPrompt) {
      console.log(`🆕 첫 번째 프롬프트 (새 세션: ${session.sessionId})`);
      this.sessionService.markFirstPromptUsed(client.id);
    } else {
      console.log(`🔄 이어가기 프롬프트 (--resume ${session.sessionId})`);
    }

    // Claude 프로세스 생성
    const claudeProcess = this.claudeService.spawnClaudeProcess(
      claudeArgs,
      session.projectPath,
    );

    // 세션에 프로세스 저장
    this.sessionService.updateClaudeProcess(client.id, claudeProcess);

    // stdout 버퍼 (라인 단위 처리용)
    let buffer = '';

    // stdout 데이터 수신 (stream-json)
    claudeProcess.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();

      // 라인 단위로 JSON 파싱
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 유지

      for (const line of lines) {
        const parsed = this.claudeService.parseJsonLine(line);
        if (!parsed) continue;

        this.handleClaudeResponse(client, parsed);
      }
    });

    // stderr 데이터 (에러 로깅)
    claudeProcess.stderr?.on('data', (data: Buffer) => {
      console.error('⚠️ Claude stderr:', data.toString());
    });

    // 프로세스 종료 시
    claudeProcess.on('close', (exitCode) => {
      // 버퍼에 남은 데이터 처리
      if (buffer.trim()) {
        const parsed = this.claudeService.parseJsonLine(buffer);
        if (parsed) {
          this.handleClaudeResponse(client, parsed);
        }
      }

      console.log('🔚 Claude 프로세스 종료, exit code:', exitCode);
      client.emit('response_complete', { exitCode });
      this.sessionService.updateClaudeProcess(client.id, null);
    });

    // 프로세스 에러
    claudeProcess.on('error', (error) => {
      console.error('❌ Claude 프로세스 에러:', error);
      client.emit('error', { message: `Process error: ${error.message}` });
    });
  }

  /**
   * Claude 응답 처리 (타입별 분기)
   */
  private handleClaudeResponse(client: Socket, response: ClaudeResponse): void {
    switch (response.type) {
      case 'system': {
        // 시스템 초기화 정보 (세션 ID, 도구 목록 등)
        console.log('📋 Claude 세션 시작:', response.session_id);
        client.emit('session_info', {
          sessionId: response.session_id,
          model: response.model,
        });
        break;
      }

      case 'assistant': {
        // 어시스턴트 응답 (실시간 청크)
        const text = this.claudeService.extractTextFromAssistant(response);
        if (text) {
          console.log('📨 Claude 응답:', text.substring(0, 50) + '...');
          client.emit('response_chunk', { text });
        }
        break;
      }

      case 'result': {
        // 최종 결과
        console.log('✅ Claude 결과:', response.subtype);
        client.emit('response_result', {
          result: response.result,
          isError: response.is_error,
        });
        break;
      }

      default: {
        // exhaustive check: 예상치 못한 응답 타입 로깅
        const unknownResponse = response as { type: string };
        console.log('❓ 알 수 없는 응답 타입:', unknownResponse.type);
      }
    }
  }
}
