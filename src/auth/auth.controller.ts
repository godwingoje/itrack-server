import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { changePasswordSchema } from './dto/change-password.dto';
import { createUserSchema } from './dto/create-user.dto';
import { loginSchema } from './dto/login.dto';
import { updateProfileSchema } from './dto/update-profile.dto';
import type { AuthenticatedUser } from './types/authenticated-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() rawBody: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parseResult = loginSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const message = parseResult.error.issues
        .map((issue) => issue.message)
        .join('; ');
      throw new BadRequestException(message);
    }

    return this.authService.login(parseResult.data, res);
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const refreshToken = cookies?.fixflow_refresh;

    return this.authService.refresh(
      typeof refreshToken === 'string' ? refreshToken : undefined,
      res,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const refreshToken = cookies?.fixflow_refresh;

    return this.authService.logout(
      typeof refreshToken === 'string' ? refreshToken : undefined,
      res,
    );
  }

  @Post('change-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parseResult = changePasswordSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const message = parseResult.error.issues
        .map((issue) => issue.message)
        .join('; ');
      throw new BadRequestException(message);
    }

    return this.authService.changePassword(user.id, parseResult.data, res);
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Patch('me')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updateProfile(
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parseResult = updateProfileSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const message = parseResult.error.issues
        .map((issue) => issue.message)
        .join('; ');
      throw new BadRequestException(message);
    }

    return { user: await this.authService.updateProfile(user.id, parseResult.data) };
  }

  @Get('departments')
  @Roles(Role.IT_ADMIN)
  async listDepartments(@CurrentUser() user: AuthenticatedUser) {
    const departments = await this.authService.listDepartments(
      user.organizationId,
    );
    return { departments };
  }

  @Get('users')
  @Roles(Role.IT_ADMIN)
  async listUsers(@CurrentUser() user: AuthenticatedUser) {
    const users = await this.authService.listUsers(user.organizationId);
    return { users };
  }

  @Post('users')
  @Roles(Role.IT_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createUser(
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parseResult = createUserSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const message = parseResult.error.issues
        .map((issue) => issue.message)
        .join('; ');
      throw new BadRequestException(message);
    }

    return {
      user: await this.authService.createUser(
        parseResult.data,
        user.organizationId,
      ),
    };
  }
}
