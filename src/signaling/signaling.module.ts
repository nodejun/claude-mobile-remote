/**
 * 시그널링 모듈
 * SignalingService를 전역 모듈로 등록
 * - AppModule에서 import하면 어디서든 SignalingService 주입 가능
 * - OnModuleInit/Destroy로 자동 등록/해제 관리
 */
import { Module, Global } from '@nestjs/common';
import { SignalingService } from './signaling.service';

@Global()
@Module({
  providers: [SignalingService],
  exports: [SignalingService],
})
export class SignalingModule {}
