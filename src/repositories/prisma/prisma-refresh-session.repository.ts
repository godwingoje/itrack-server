import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRefreshSessionInput,
  RefreshSessionRecord,
  RefreshSessionRepository,
} from '../interfaces/refresh-session.repository.interface';

@Injectable()
export class PrismaRefreshSessionRepository
  implements RefreshSessionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    input: CreateRefreshSessionInput,
  ): Promise<RefreshSessionRecord> {
    const session = await this.prisma.refreshSession.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
      },
    });

    return session;
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<RefreshSessionRecord | null> {
    return this.prisma.refreshSession.findUnique({
      where: { tokenHash },
    });
  }

  async rotateGuarded(
    oldSessionId: string,
    newSessionInput: CreateRefreshSessionInput,
  ): Promise<RefreshSessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.refreshSession.findUnique({
        where: { id: oldSessionId },
      });

      if (!existing) {
        return null;
      }

      const now = new Date();

      if (existing.revokedAt !== null) {
        await tx.refreshSession.updateMany({
          where: { familyId: existing.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      const newId = randomUUID();

      const updateResult = await tx.refreshSession.updateMany({
        where: {
          id: oldSessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          lastUsedAt: now,
          replacedBy: newId,
        },
      });

      if (updateResult.count === 0) {
        await tx.refreshSession.updateMany({
          where: { familyId: existing.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      const newSession = await tx.refreshSession.create({
        data: {
          id: newId,
          userId: newSessionInput.userId,
          tokenHash: newSessionInput.tokenHash,
          familyId: newSessionInput.familyId,
          expiresAt: newSessionInput.expiresAt,
        },
      });

      return newSession;
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
