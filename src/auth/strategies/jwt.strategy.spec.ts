import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

const userId = 'c0a80101-0000-4000-8000-000000000003';
const sessionId = 'c0a80101-0000-4000-8000-000000000004';

function makeStrategy(prisma: object) {
  return new JwtStrategy(
    { get: jest.fn(() => 'test-secret') } as unknown as ConfigService,
    prisma as PrismaService,
  );
}

describe('JwtStrategy.validate', () => {
  it('rejects an access token after its session has been revoked', async () => {
    const prisma = {
      user: { findUnique: jest.fn() },
      refreshSession: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const strategy = makeStrategy(prisma);

    await expect(
      strategy.validate({
        sub: userId,
        sid: sessionId,
        email: 'user@example.com',
        role: Role.EMPLOYEE,
        organizationId: 'org-id',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshSession.findFirst).toHaveBeenCalled();
  });

  it('accepts a user only when the token session is still active', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          staffId: 'USR-1',
          fullName: 'Test User',
          email: 'user@example.com',
          role: Role.EMPLOYEE,
          organizationId: 'org-id',
          organization: { id: 'org-id', name: 'ITrack', code: 'IT' },
          departmentId: 'department-id',
          department: { id: 'department-id', name: 'IT', code: 'IT' },
          phone: null,
          address: null,
          isActive: true,
        }),
      },
      refreshSession: {
        findFirst: jest.fn().mockResolvedValue({ id: sessionId }),
      },
    };
    const strategy = makeStrategy(prisma);

    await expect(
      strategy.validate({
        sub: userId,
        sid: sessionId,
        email: 'user@example.com',
        role: Role.EMPLOYEE,
        organizationId: 'org-id',
      }),
    ).resolves.toMatchObject({ id: userId, email: 'user@example.com' });
    expect(prisma.refreshSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });
});
