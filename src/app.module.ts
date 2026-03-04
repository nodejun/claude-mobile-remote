import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import { SignalingModule } from './signaling/signaling.module';

@Module({
  imports: [EventsModule, SignalingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
