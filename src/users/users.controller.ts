import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserDto,
  type UpdateUserDto,
} from '../auth/dto/create-user.dto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';

@Controller('users')
@Roles(Role.IT_ADMIN)
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { users: await this.authService.listUsers(user.organizationId) };
  }

  @Post()
  async create(@Body() rawBody: unknown, @CurrentUser() user: AuthenticatedUser) {
    const input = this.parse<CreateUserDto>(createUserSchema, rawBody);
    return { user: await this.authService.createUser(input, user.organizationId) };
  }

  @Patch(':id')
  async update(
    @Param('id') userId: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const input = this.parse<UpdateUserDto>(updateUserSchema, rawBody);
    return {
      user: await this.authService.updateUser(
        userId,
        input,
        user.organizationId,
        user.id,
      ),
    };
  }

  private parse<T>(schema: { safeParse: (input: unknown) => any }, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((issue: { message: string }) => issue.message).join('; '));
    }
    return result.data as T;
  }
}
