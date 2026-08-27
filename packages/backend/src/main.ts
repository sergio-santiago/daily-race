import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // CORS para el Meet Add-on. El frontend hospedado en otro origen
  // (ej. https://daily-race.secture.com) hace polling al endpoint
  // /api/live-race/current desde el iframe del side panel.
  const allowedOrigins = (process.env.LIVE_RACE_API_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (allowedOrigins.length > 0) {
    app.enableCors({
      origin: allowedOrigins,
      methods: ['GET'],
      credentials: false,
      maxAge: 86400,
    });
    Logger.log(`CORS enabled for: ${allowedOrigins.join(', ')}`, 'Bootstrap');
  }

  const port = process.env.BACKEND_PORT || 3001;
  await app.listen(port);
}

bootstrap();
