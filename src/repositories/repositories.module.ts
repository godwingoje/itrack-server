import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  REFRESH_SESSION_REPOSITORY,
  USERS_REPOSITORY,
} from '../common/constants/tokens';
import { PrismaModule } from '../prisma/prisma.module';
import { InMemoryRefreshSessionRepository } from './in-memory/in-memory-refresh-session.repository';
import { InMemoryUsersRepository } from './in-memory/in-memory-users.repository';
import { PrismaRefreshSessionRepository } from './prisma/prisma-refresh-session.repository';
import { PrismaUsersRepository } from './prisma/prisma-users.repository';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    InMemoryUsersRepository,
    InMemoryRefreshSessionRepository,
    PrismaUsersRepository,
    PrismaRefreshSessionRepository,
    {
      provide: USERS_REPOSITORY,
      useFactory: (
        config: ConfigService,
        inMemory: InMemoryUsersRepository,
        prisma: PrismaUsersRepository,
      ) => {
        const dataSource = config.get<string>('DATA_SOURCE');
        return dataSource === 'prisma' ? prisma : inMemory;
      },
      inject: [ConfigService, InMemoryUsersRepository, PrismaUsersRepository],
    },
    {
      provide: REFRESH_SESSION_REPOSITORY,
      useFactory: (
        config: ConfigService,
        inMemory: InMemoryRefreshSessionRepository,
        prisma: PrismaRefreshSessionRepository,
      ) => {
        const dataSource = config.get<string>('DATA_SOURCE');
        return dataSource === 'prisma' ? prisma : inMemory;
      },
      inject: [
        ConfigService,
        InMemoryRefreshSessionRepository,
        PrismaRefreshSessionRepository,
      ],
    },
  ],
  exports: [USERS_REPOSITORY, REFRESH_SESSION_REPOSITORY],
})
export class RepositoriesModule {}
