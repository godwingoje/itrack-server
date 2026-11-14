import {
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { createUserSchema } from './dto/create-user.dto';
import { AuthService } from './auth.service';
import type { Response } from 'express';

const organizationId = 'c0a80101-0000-4000-8000-000000000001';
const departmentId = 'c0a80101-0000-4000-8000-000000000002';

function makeService(prisma: object) {
  return new AuthService(
    {} as JwtService,
    { get: jest.fn() } as unknown as ConfigService,
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

describe('AuthService.changePassword', () => {
  it('updates the password, revokes every active refresh session, and clears cookies', async () => {
    const oldPasswordHash = await bcrypt.hash('current-password', 4);
    const transaction = {
      user: { update: jest.fn().mockResolvedValue({}) },
      refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ passwordHash: oldPasswordHash }),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const response = { clearCookie: jest.fn() };
    const service = makeService(prisma);

    await expect(
      service.changePassword(
        'user-id',
        { currentPassword: 'current-password', newPassword: 'new-password-123' },
        response as never,
      ),
    ).resolves.toEqual({
      message: 'Password changed. Sign in again on each device.',
    });

    const passwordUpdate = transaction.user.update.mock.calls[0][0];
    expect(passwordUpdate.where).toEqual({ id: 'user-id' });
    await expect(
      bcrypt.compare('new-password-123', passwordUpdate.data.passwordHash),
    ).resolves.toBe(true);
    expect(transaction.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('rejects an incorrect current password without changing the account', async () => {
    const oldPasswordHash = await bcrypt.hash('current-password', 4);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ passwordHash: oldPasswordHash }),
      },
      $transaction: jest.fn(),
    };
    const service = makeService(prisma);

    await expect(
      service.changePassword(
        'user-id',
        { currentPassword: 'wrong-password', newPassword: 'new-password-123' },
        { clearCookie: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  it('binds the access token to the newly created device session', async () => {
    const passwordHash = await bcrypt.hash('test-password', 4);
    const jwtService = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-id',
          staffId: 'USR-1',
          fullName: 'Test User',
          email: 'user@example.com',
          passwordHash,
          role: Role.EMPLOYEE,
          organizationId,
          organization: { id: organizationId, name: 'ITrack', code: 'IT' },
          departmentId,
          department: { id: departmentId, name: 'IT', code: 'IT' },
          phone: null,
          address: null,
          isActive: true,
        }),
      },
      refreshSession: {
        create: jest.fn().mockResolvedValue({ id: 'device-session-id' }),
      },
    };
    const response = { cookie: jest.fn() };
    const service = new AuthService(
      jwtService as unknown as JwtService,
      { get: jest.fn() } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );

    await service.login(
      { email: 'user@example.com', password: 'test-password' },
      response as unknown as Response,
    );

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-id', sid: 'device-session-id' }),
    );
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });
});

describe('AuthService.updateProfile', () => {
  it('updates and returns the authenticated user profile without exposing the password hash', async () => {
    const updatedUser = {
      id: 'user-id',
      staffId: 'USR-1',
      fullName: 'Updated Name',
      email: 'user@example.com',
      role: Role.EMPLOYEE,
      organizationId,
      organization: { id: organizationId, name: 'ITrack', code: 'IT' },
      departmentId,
      department: { id: departmentId, name: 'IT', code: 'IT' },
      phone: null,
      address: null,
      isActive: true,
    };
    const prisma = {
      user: { update: jest.fn().mockResolvedValue(updatedUser) },
    };
    const service = makeService(prisma);

    await expect(
      service.updateProfile('user-id', { fullName: 'Updated Name' }),
    ).resolves.toEqual(updatedUser);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { fullName: 'Updated Name' },
      include: { organization: true, department: true },
    });
  });
});

describe('AuthService.updateUser', () => {
  const existingUser = {
    id: 'employee-id',
    staffId: 'USR-2',
    fullName: 'Employee Name',
    email: 'employee@example.com',
    role: Role.EMPLOYEE,
    organizationId,
    organization: { id: organizationId, name: 'ITrack', code: 'IT' },
    departmentId,
    department: { id: departmentId, name: 'IT', code: 'IT' },
    phone: null,
    address: null,
    isActive: true,
  };

  it('allows an IT Admin to update another user name and role in the same organization', async () => {
    const transaction = {
      user: {
        update: jest.fn().mockImplementation(({ data }) => ({
          ...existingUser,
          ...data,
        })),
      },
    };
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(existingUser) },
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const service = makeService(prisma);

    await expect(
      service.updateUser(
        existingUser.id,
        { fullName: 'Technician Name', role: Role.TECHNICIAN },
        organizationId,
        'admin-id',
      ),
    ).resolves.toMatchObject({
      id: existingUser.id,
      fullName: 'Technician Name',
      role: Role.TECHNICIAN,
    });
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: existingUser.id },
      data: { fullName: 'Technician Name', role: Role.TECHNICIAN },
      include: { organization: true, department: true },
    });
  });

  it('prevents an administrator from changing their own role', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ ...existingUser, id: 'admin-id', role: Role.IT_ADMIN }) },
      $transaction: jest.fn(),
    };
    const service = makeService(prisma);

    await expect(
      service.updateUser(
        'admin-id',
        { role: Role.EMPLOYEE },
        organizationId,
        'admin-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});