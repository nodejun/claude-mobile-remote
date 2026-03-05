/**
 * 트레이 모듈
 * Windows 시스템 트레이 아이콘 관리
 * - 페어링 코드, IP, 포트 표시
 * - 종료 기능
 */
import { Module } from '@nestjs/common';
import { TrayService } from './tray.service';

@Module({
  providers: [TrayService],
  exports: [TrayService],
})
export class TrayModule {}
