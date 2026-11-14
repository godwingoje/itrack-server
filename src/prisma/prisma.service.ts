import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const LEGACY_SSL_MODES = new Set(['prefer', 'require', 'verify-ca']);

export function normalizeDatabaseSslMode(connectionString: string): string {
  const sslModeParameter = /([?&]sslmode=)([^&#]+)/i;
  const match = connectionString.match(sslModeParameter);
  if (!match || !LEGACY_SSL_MODES.has(match[2].toLowerCase())) {
    return connectionString;
  }

  return connectionString.replace(sslModeParameter, '$1verify-full');
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    const connectionString = normalizeDatabaseSslMode(
      configService.getOrThrow<string>('DATABASE_URL'),
    );

    super({
      adapter: new PrismaPg({
        connectionString,
        connectionTimeoutMillis: 10_000,
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
