import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import { SignalingModule } from './signaling/signaling.module';
import { TrayModule } from './tray/tray.module';

@Module({
  // SignalingModule → TrayModule 순서로 import (초기화 순서 보장)
  imports: [EventsModule, SignalingModule, TrayModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
