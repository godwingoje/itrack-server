import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { CookieOptions, Response } from 'express';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { z } from 'zod';
import { AuthenticatedUser } from './types/authenticated-user.interface';
import { JwtPayload } from './types/jwt-payload.interface';

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await bcrypt.hash('timing-protection-dummy-secret', 12);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthenticatedUser(user: {
    id: string;
    staffId: string;
    fullName: string;
    email: string;
    role: Role;
    organizationId: string;
    organization: { id: string; name: string; code: string };
    departmentId: string;
    department: { id: string; name: string; code: string };
    phone: string | null;
    address: string | null;
    isActive: boolean;
  }): AuthenticatedUser {
    return {
      id: user.id,
      staffId: user.staffId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organization: user.organization,
      departmentId: user.departmentId,
      department: user.department,
      phone: user.phone,
      address: user.address,
      isActive: user.isActive,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private getCookieOptions(): CookieOptions {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const baseOptions = this.getCookieOptions();

    res.cookie('fixflow_session', accessToken, {
      ...baseOptions,
      maxAge: ACCESS_TOKEN_TTL_MS,
    });

    res.cookie('fixflow_refresh', refreshToken, {
      ...baseOptions,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  clearAuthCookies(res: Response): void {
    const baseOptions = this.getCookieOptions();
    res.clearCookie('fixflow_session', baseOptions);
    res.clearCookie('fixflow_refresh', baseOptions);
  }

  async listUsers(organizationId: string): Promise<AuthenticatedUser[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      include: { organization: true, department: true },
      orderBy: { fullName: 'asc' },
    });
    return users.map((user) => this.toAuthenticatedUser(user));
  }

  listDepartments(organizationId: string) {
    return this.prisma.department.findMany({
      where: { organizationId },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async createUser(
    input: CreateUserDto,
    organizationId: string,
  ): Promise<AuthenticatedUser> {
    if (!z.string().uuid().safeParse(input.departmentId).success) {
      throw new BadRequestException('The selected department ID is invalid.');
    }

    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('A user with this email already exists.');
    }

    const staffId = input.staffId?.trim() || `USR-${randomUUID()}`;
    if (await this.prisma.user.findUnique({ where: { staffId }, select: { id: true } })) {
      throw new ConflictException('A user with this staff ID already exists.');
    }

    const department = await this.prisma.department.findFirst({
      where: { id: input.departmentId, organizationId },
      select: { id: true },
    });
    if (!department) {
      throw new BadRequestException(
        'The selected department does not belong to your organization.',
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          staffId,
          fullName: input.fullName.trim(),
          email,
          passwordHash,
          role: input.role,
          organizationId,
          departmentId: department.id,
          phone: input.phone?.trim() || null,
          address: input.address?.trim() || null,
        },
        include: { organization: true, department: true },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Email or staff ID is already in use.');
      }
      throw error;
    }

    return this.toAuthenticatedUser(user);
  }

  async login(dto: LoginDto, res: Response): Promise<{ user: AuthenticatedUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: { organization: true, department: true },
    });
    const hashToCompare = user ? user.passwordHash : this.dummyHash;
    const isPasswordValid = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !isPasswordValid || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const rawRefreshToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId,
        expiresAt,
      },
    });

    this.setAuthCookies(res, accessToken, rawRefreshToken);

    return { user: this.toAuthenticatedUser(user) };
  }

  async refresh(
    rawRefreshToken: string | undefined,
    res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // Reuse detection
    if (session.revokedAt !== null) {
      await this.prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.clearAuthCookies(res);
      throw new UnauthorizedException(
        'Refresh token reuse detected. Session terminated.',
      );
    }

    if (new Date() > session.expiresAt) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { organization: true, department: true },
    });
    if (!user || !user.isActive) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException(
        'Account is inactive or no longer exists.',
      );
    }

    const newRawRefreshToken = randomBytes(32).toString('hex');
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const rotatedSession = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.refreshSession.findUnique({
        where: { id: session.id },
      });
      if (!current || current.revokedAt !== null) {
        await transaction.refreshSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }

      const now = new Date();
      const newId = randomUUID();
      const revoked = await transaction.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now, replacedBy: newId },
      });
      if (revoked.count === 0) {
        await transaction.refreshSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      return transaction.refreshSession.create({
        data: {
          id: newId,
          userId: user.id,
          tokenHash: newTokenHash,
          familyId: session.familyId,
          expiresAt: newExpiresAt,
        },
      });
    });

    if (!rotatedSession) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Refresh token rotation failed.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    this.setAuthCookies(res, accessToken, newRawRefreshToken);

    return { user: this.toAuthenticatedUser(user) };
  }

  async logout(
    rawRefreshToken: string | undefined,
    res: Response,
  ): Promise<{ message: string }> {
    if (rawRefreshToken && typeof rawRefreshToken === 'string') {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    this.clearAuthCookies(res);
    return { message: 'Logged out successfully.' };
  }
}
