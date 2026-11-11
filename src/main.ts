import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

function isLocalFrontendOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      callback(
        null,
        !origin || allowedOrigins.has(origin) || isLocalFrontendOrigin(origin),
      );
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
