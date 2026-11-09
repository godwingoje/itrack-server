import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { loginSchema } from './dto/login.dto';
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

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
