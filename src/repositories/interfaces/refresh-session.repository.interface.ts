export interface RefreshSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  replacedBy: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRefreshSessionInput {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export interface RefreshSessionRepository {
  createSession(input: CreateRefreshSessionInput): Promise<RefreshSessionRecord>;
  findByTokenHash(tokenHash: string): Promise<RefreshSessionRecord | null>;
  rotateGuarded(
    oldSessionId: string,
    newSessionInput: CreateRefreshSessionInput,
  ): Promise<RefreshSessionRecord | null>;
  revokeFamily(familyId: string): Promise<void>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
}
