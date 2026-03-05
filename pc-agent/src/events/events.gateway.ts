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
import { ChangesService } from './changes.service';
import { SignalingService } from '../signaling/signaling.service';
import type {
  ClaudeResponse,
  ClaudeStreamEventResponse,
  ClaudeUserResponse,
} from '#interfaces/claude.interface';
import type {
  ChangeActionPayload,
  DeleteChangePayload,
} from '#interfaces/changes.interface';
import type {
  FileOperationRequest,
  SearchRequest,
} from '#interfaces/file.interface';

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
    private readonly changesService: ChangesService,
    private readonly signalingService: SignalingService,
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
   * 페어링 정보 조회
   * 모바일 앱이 연결 후 현재 PC의 페어링 코드/IP/포트 확인용
   */
  @SubscribeMessage('get_pair_info')
  handleGetPairInfo(_client: Socket) {
    const pairInfo = this.signalingService.getPairInfo();
    return { event: 'pair_info', data: pairInfo };
  }

  /**
   * 현재 응답 중단 (세션은 유지)
   */
  @SubscribeMessage('cancel')
  handleCancel(client: Socket) {
    console.log(`응답 중단 요청: ${client.id}`);

    const session = this.sessionService.getSession(client.id);
    if (session?.claudeProcess) {
      this.claudeService.interruptPtyProcess(session.claudeProcess);
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
   * 파일/폴더 생성
   */
  @SubscribeMessage('create_file')
  handleCreateFile(client: Socket, payload: FileOperationRequest) {
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
        data: { message: '파일 경로가 필요합니다' },
      };
    }

    console.log(
      `✨ 파일 생성 요청: ${payload.filePath} (${payload.isDirectory ? '폴더' : '파일'})`,
    );

    const result = this.fileService.createFile(
      session.projectPath,
      payload.filePath,
      payload.isDirectory || false,
      payload.content,
    );

    return { event: 'file_operation_result', data: result };
  }

  /**
   * 파일/폴더 삭제
   */
  @SubscribeMessage('delete_file')
  handleDeleteFile(client: Socket, payload: FileOperationRequest) {
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
        data: { message: '파일 경로가 필요합니다' },
      };
    }

    console.log(`🗑️ 파일 삭제 요청: ${payload.filePath}`);

    const result = this.fileService.deleteFile(
      session.projectPath,
      payload.filePath,
    );

    return { event: 'file_operation_result', data: result };
  }

  /**
   * 파일/폴더 이름 변경
   */
  @SubscribeMessage('rename_file')
  handleRenameFile(client: Socket, payload: FileOperationRequest) {
    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return {
        event: 'error',
        data: { message: FILE_ERROR_MESSAGES.NO_SESSION },
      };
    }

    if (!payload?.filePath || !payload?.newName) {
      return {
        event: 'error',
        data: { message: '파일 경로와 새 이름이 필요합니다' },
      };
    }

    console.log(
      `✏️ 파일 이름 변경 요청: ${payload.filePath} → ${payload.newName}`,
    );

    const result = this.fileService.renameFile(
      session.projectPath,
      payload.filePath,
      payload.newName,
    );

    return { event: 'file_operation_result', data: result };
  }

  /**
   * 파일 검색 (파일명 / 내용)
   */
  @SubscribeMessage('search_files')
  handleSearchFiles(client: Socket, payload: SearchRequest) {
    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return {
        event: 'error',
        data: { message: FILE_ERROR_MESSAGES.NO_SESSION },
      };
    }

    if (!payload?.query || !payload?.type) {
      return {
        event: 'error',
        data: { message: '검색어와 검색 타입이 필요합니다' },
      };
    }

    console.log(`🔍 검색 요청: "${payload.query}" (${payload.type})`);

    try {
      const result = this.fileService.searchFiles(session.projectPath, payload);
      return { event: 'search_result', data: result };
    } catch (error) {
      console.error('❌ 검색 실패:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        event: 'error',
        data: { message: `검색 실패: ${errorMessage}` },
      };
    }
  }

  /**
   * 프롬프트 처리 (Claude CLI 실행 - PTY + stream-json 방식)
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

    // Claude PTY 프로세스 생성
    const ptyProcess = this.claudeService.spawnClaudePtyProcess(
      claudeArgs,
      session.projectPath,
    );

    // 세션에 프로세스 저장
    this.sessionService.updateClaudeProcess(client.id, ptyProcess);

    // PTY 출력 버퍼 (라인 단위 처리용)
    let buffer = '';

    // PTY 데이터 수신 (실시간)
    ptyProcess.onData((data: string) => {
      // Windows PTY는 \r\n을 사용하므로 \r 제거
      buffer += data.replace(/\r/g, '');

      // 라인 단위로 JSON 파싱
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 유지

      for (const line of lines) {
        const parsed = this.claudeService.parseJsonLine(line);
        if (!parsed) continue;

        this.handleClaudeResponse(client, parsed);
      }
    });

    // PTY 프로세스 종료 시
    ptyProcess.onExit(({ exitCode }) => {
      // 버퍼에 남은 데이터 처리
      if (buffer.trim()) {
        const parsed = this.claudeService.parseJsonLine(buffer);
        if (parsed) {
          this.handleClaudeResponse(client, parsed);
        }
      }

      console.log('🔚 Claude PTY 프로세스 종료, exit code:', exitCode);
      client.emit('response_complete', { exitCode });
      this.sessionService.updateClaudeProcess(client.id, null);
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
        // 어시스턴트 응답 (누적 메시지 - stream_event와 중복되므로 emit 안 함)
        // stream_event가 토큰 단위 스트리밍을 담당
        const text = this.claudeService.extractTextFromAssistant(response);
        if (text) {
          console.log('📨 Claude 누적 응답:', text.substring(0, 50) + '...');
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

      case 'stream_event': {
        // 토큰 단위 실시간 스트리밍 (--include-partial-messages)
        const streamResponse = response as ClaudeStreamEventResponse;
        const event = streamResponse.event;

        // content_block_delta 이벤트에서 텍스트 추출
        if (event.type === 'content_block_delta' && event.delta?.text) {
          client.emit('response_chunk', { text: event.delta.text });
        }
        break;
      }

      case 'user': {
        // tool_result 응답 (파일 변경 정보 포함)
        const userResponse = response as ClaudeUserResponse;
        if (userResponse.tool_use_result) {
          const session = this.sessionService.getSession(client.id);
          if (session) {
            const change = this.changesService.trackFromToolUse(
              session.projectPath,
              userResponse.tool_use_result,
            );
            if (change) {
              // 클라이언트에게 파일 변경 알림
              client.emit('file_changed', {
                id: change.id,
                type: change.type,
                filePath: change.filePath,
                additions: change.additions,
                deletions: change.deletions,
              });
            }
          }
        }
        break;
      }

      default: {
        // exhaustive check: 예상치 못한 응답 타입 로깅
        const unknownResponse = response as { type: string };
        console.log('❓ 알 수 없는 응답 타입:', unknownResponse.type);
        console.log(
          '   데이터:',
          JSON.stringify(unknownResponse).substring(0, 200),
        );
      }
    }
  }

  /**
   * 변경사항 목록 조회
   */
  @SubscribeMessage('get_changes')
  handleGetChanges(client: Socket) {
    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return {
        event: 'changes_list',
        data: { changes: [], totalCount: 0, pendingCount: 0 },
      };
    }

    const result = this.changesService.getChanges(session.projectPath);
    return { event: 'changes_list', data: result };
  }

  /**
   * 특정 변경사항 상세 조회
   */
  @SubscribeMessage('get_change_detail')
  handleGetChangeDetail(client: Socket, payload: ChangeActionPayload) {
    if (!payload?.changeId) {
      return {
        event: 'error',
        data: { message: 'Change ID is required' },
      };
    }

    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return { event: 'error', data: { message: 'No session found' } };
    }

    const change = this.changesService.getChange(
      session.projectPath,
      payload.changeId,
    );
    if (!change) {
      return {
        event: 'error',
        data: { message: 'Change not found' },
      };
    }

    return { event: 'change_detail', data: change };
  }

  /**
   * 변경 승인
   */
  @SubscribeMessage('approve_change')
  handleApproveChange(client: Socket, payload: ChangeActionPayload) {
    if (!payload?.changeId) {
      return {
        event: 'error',
        data: { message: 'Change ID is required' },
      };
    }

    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return { event: 'error', data: { message: 'No session found' } };
    }

    const result = this.changesService.approveChange(
      session.projectPath,
      payload.changeId,
    );
    return { event: 'change_approved', data: result };
  }

  /**
   * 변경 거부 (원본으로 복원)
   */
  @SubscribeMessage('reject_change')
  handleRejectChange(client: Socket, payload: ChangeActionPayload) {
    if (!payload?.changeId) {
      return {
        event: 'error',
        data: { message: 'Change ID is required' },
      };
    }

    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return { event: 'error', data: { message: 'No session found' } };
    }

    const result = this.changesService.rejectChange(
      session.projectPath,
      payload.changeId,
    );
    return { event: 'change_rejected', data: result };
  }

  /**
   * 변경사항 삭제 (개별 또는 처리 완료 일괄)
   */
  @SubscribeMessage('delete_change')
  handleDeleteChange(client: Socket, payload: DeleteChangePayload) {
    const session = this.sessionService.getSession(client.id);
    if (!session) {
      return { event: 'error', data: { message: 'No session found' } };
    }

    // 처리 완료 항목 일괄 삭제
    if (payload?.deleteAll) {
      const result = this.changesService.deleteResolvedChanges(
        session.projectPath,
      );
      return { event: 'change_deleted', data: result };
    }

    // 개별 삭제
    if (!payload?.changeId) {
      return {
        event: 'error',
        data: { message: 'Change ID or deleteAll flag is required' },
      };
    }

    const result = this.changesService.deleteChange(
      session.projectPath,
      payload.changeId,
    );
    return { event: 'change_deleted', data: result };
  }
}
