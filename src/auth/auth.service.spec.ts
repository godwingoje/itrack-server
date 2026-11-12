import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { createUserSchema } from './dto/create-user.dto';
import { AuthService } from './auth.service';

const organizationId = 'c0a80101-0000-4000-8000-000000000001';
const departmentId = 'c0a80101-0000-4000-8000-000000000002';

function makeService(prisma: object) {
  return new AuthService(
    {} as JwtService,
    {} as ConfigService,
    prisma as PrismaService,
  );
}

function validInput() {
  return createUserSchema.parse({
    fullName: 'New Technician',
    email: '  Tech@Example.com ',
    password: 'api-test-password',
    role: Role.TECHNICIAN,
    departmentId,
  });
}

describe('AuthService.createUser', () => {
  it('normalizes email, hashes the password, and omits the hash from the response', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          ...data,
          id: 'user-id',
          organization: { id: organizationId, name: 'ITrack', code: 'IT' },
          department: { id: departmentId, name: 'IT', code: 'IT' },
          isActive: true,
        })),
      },
      department: {
        findFirst: jest.fn().mockResolvedValue({ id: departmentId }),
      },
    };
    const service = makeService(prisma);

    const user = await service.createUser(validInput(), organizationId);
    const createData = prisma.user.create.mock.calls[0][0].data;

    expect(createData.email).toBe('tech@example.com');
    expect(createData.organizationId).toBe(organizationId);
    expect(createData.departmentId).toBe(departmentId);
    expect(createData.passwordHash).not.toBe('api-test-password');
    await expect(
      bcrypt.compare('api-test-password', createData.passwordHash),
    ).resolves.toBe(true);
    expect(user).not.toHaveProperty('passwordHash');
    expect(user.email).toBe('tech@example.com');
  });

  it('rejects a department outside the administrator organization', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      department: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = makeService(prisma);

    await expect(
      service.createUser(validInput(), organizationId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an already-used email before attempting creation', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing-user' }),
        create: jest.fn(),
      },
      department: { findFirst: jest.fn() },
    };
    const service = makeService(prisma);

    await expect(
      service.createUser(validInput(), organizationId),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.department.findFirst).not.toHaveBeenCalled();
  });
});