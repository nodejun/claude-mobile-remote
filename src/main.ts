import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // 백그라운드 실행 시 불필요한 로그 최소화
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : undefined,
  });

  // 종료 시그널 처리 (트레이 종료, 시그널링 해제 등)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
