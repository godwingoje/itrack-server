import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreateRefreshSessionInput,
  RefreshSessionRecord,
  RefreshSessionRepository,
} from '../interfaces/refresh-session.repository.interface';

@Injectable()
export class InMemoryRefreshSessionRepository
  implements RefreshSessionRepository
{
  private sessions: RefreshSessionRecord[] = [];

  async createSession(
    input: CreateRefreshSessionInput,
  ): Promise<RefreshSessionRecord> {
    const now = new Date();
    const session: RefreshSessionRecord = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      familyId: input.familyId,
      replacedBy: null,
      expiresAt: input.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.push(session);
    return session;
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<RefreshSessionRecord | null> {
    return this.sessions.find((s) => s.tokenHash === tokenHash) ?? null;
  }

  async rotateGuarded(
    oldSessionId: string,
    newSessionInput: CreateRefreshSessionInput,
  ): Promise<RefreshSessionRecord | null> {
    const oldSession = this.sessions.find((s) => s.id === oldSessionId);
    if (!oldSession) {
      return null;
    }

    const now = new Date();

    // Guarded check: If already revoked, token reuse detected!
    if (oldSession.revokedAt !== null) {
      await this.revokeFamily(oldSession.familyId);
      return null;
    }

    const newId = randomUUID();
    oldSession.revokedAt = now;
    oldSession.lastUsedAt = now;
    oldSession.replacedBy = newId;
    oldSession.updatedAt = now;

    const newSession: RefreshSessionRecord = {
      id: newId,
      userId: newSessionInput.userId,
      tokenHash: newSessionInput.tokenHash,
      familyId: newSessionInput.familyId,
      replacedBy: null,
      expiresAt: newSessionInput.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.push(newSession);
    return newSession;
  }

  async revokeFamily(familyId: string): Promise<void> {
    const now = new Date();
    for (const session of this.sessions) {
      if (session.familyId === familyId && session.revokedAt === null) {
        session.revokedAt = now;
        session.updatedAt = now;
      }
    }
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    const session = this.sessions.find((s) => s.tokenHash === tokenHash);
    if (session && session.revokedAt === null) {
      const now = new Date();
      session.revokedAt = now;
      session.updatedAt = now;
    }
  }
}
