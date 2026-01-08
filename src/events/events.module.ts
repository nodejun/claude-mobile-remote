import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { SessionService } from './session.service';
import { FileService } from './file.service';
import { ClaudeService } from './claude.service';

@Module({
  providers: [EventsGateway, SessionService, FileService, ClaudeService],
})
export class EventsModule {}
