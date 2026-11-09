import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { USERS_REPOSITORY } from '../../common/constants/tokens';
import type { UsersRepository } from '../../repositories/interfaces/users.repository.interface';
import { AuthenticatedUser } from '../types/authenticated-user.interface';
import { JwtPayload } from '../types/jwt-payload.interface';

function extractJwtFromCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const token = cookies?.fixflow_session;
  return typeof token === 'string' ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractJwtFromCookie]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Account is inactive or no longer exists.',
      );
    }

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
}
