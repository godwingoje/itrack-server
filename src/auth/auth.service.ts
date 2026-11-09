import {
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { CookieOptions, Response } from 'express';
import {
  REFRESH_SESSION_REPOSITORY,
  USERS_REPOSITORY,
} from '../common/constants/tokens';
import type { RefreshSessionRepository } from '../repositories/interfaces/refresh-session.repository.interface';
import type { UsersRepository } from '../repositories/interfaces/users.repository.interface';
import { LoginDto } from './dto/login.dto';
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
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(REFRESH_SESSION_REPOSITORY)
    private readonly refreshSessionRepository: RefreshSessionRepository,
  ) {}

  async onModuleInit() {
    this.dummyHash = await bcrypt.hash('timing-protection-dummy-secret', 12);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
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

  async login(dto: LoginDto, res: Response): Promise<{ user: AuthenticatedUser }> {
    const user = await this.usersRepository.findByEmail(dto.email);
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

    await this.refreshSessionRepository.createSession({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
    });

    this.setAuthCookies(res, accessToken, rawRefreshToken);

    return {
      user: {
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
      },
    };
  }

  async refresh(
    rawRefreshToken: string | undefined,
    res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const session =
      await this.refreshSessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // Reuse detection
    if (session.revokedAt !== null) {
      await this.refreshSessionRepository.revokeFamily(session.familyId);
      this.clearAuthCookies(res);
      throw new UnauthorizedException(
        'Refresh token reuse detected. Session terminated.',
      );
    }

    if (new Date() > session.expiresAt) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const user = await this.usersRepository.findById(session.userId);
    if (!user || !user.isActive) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException(
        'Account is inactive or no longer exists.',
      );
    }

    const newRawRefreshToken = randomBytes(32).toString('hex');
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const rotatedSession = await this.refreshSessionRepository.rotateGuarded(
      session.id,
      {
        userId: user.id,
        tokenHash: newTokenHash,
        familyId: session.familyId,
        expiresAt: newExpiresAt,
      },
    );

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

    return {
      user: {
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
      },
    };
  }

  async logout(
    rawRefreshToken: string | undefined,
    res: Response,
  ): Promise<{ message: string }> {
    if (rawRefreshToken && typeof rawRefreshToken === 'string') {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.refreshSessionRepository.revokeByTokenHash(tokenHash);
    }

    this.clearAuthCookies(res);
    return { message: 'Logged out successfully.' };
  }
}
