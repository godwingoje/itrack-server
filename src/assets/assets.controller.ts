import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import {
  createAssetSchema,
  listAssetsSchema,
  updateAssetSchema,
  type CreateAssetDto,
  type ListAssetsQuery,
  type UpdateAssetDto,
} from './asset.dto';
import { AssetsService } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @Roles(Role.EMPLOYEE, Role.TECHNICIAN, Role.IT_ADMIN)
  list(@Query() rawQuery: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.list(user, this.parse<ListAssetsQuery>(listAssetsSchema, rawQuery));
  }

  @Post()
  @Roles(Role.TECHNICIAN, Role.IT_ADMIN)
  create(@Body() rawBody: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.create(user, this.parse<CreateAssetDto>(createAssetSchema, rawBody));
  }

  @Get(':id')
  @Roles(Role.EMPLOYEE, Role.TECHNICIAN, Role.IT_ADMIN)
  getDetail(@Param('id') assetId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.getDetail(assetId, user);
  }

  @Patch(':id')
  @Roles(Role.TECHNICIAN, Role.IT_ADMIN)
  update(
    @Param('id') assetId: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assetsService.update(assetId, this.parse<UpdateAssetDto>(updateAssetSchema, rawBody), user);
  }

  @Post(':id/retire')
  @Roles(Role.IT_ADMIN)
  retire(@Param('id') assetId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.retire(assetId, user);
  }

  private parse<T>(schema: { safeParse: (input: unknown) => any }, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((issue: { message: string }) => issue.message).join('; '));
    }
    return result.data as T;
  }
}
