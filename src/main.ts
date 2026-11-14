import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

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
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (setting: string, value: unknown) => void;
  };
  expressApp.set('trust proxy', 1);
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

  await app.listen(port, '0.0.0.0');

  void app
    .get(PrismaService)
    .$connect()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown database error.';
      logger.error(
        `Initial database connection failed after the HTTP listener started: ${message}`,
      );
    });
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error.';
  console.error(`ITrack API failed to start: ${message}`);
  process.exitCode = 1;
});
