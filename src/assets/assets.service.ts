import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AssetCondition, Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import type { CreateAssetDto, ListAssetsQuery, UpdateAssetDto } from './asset.dto';

const assetDetails = {
  assignedTo: {
    select: { id: true, staffId: true, fullName: true, email: true, role: true },
  },
} as const;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: ListAssetsQuery) {
    const where = {
      organizationId: user.organizationId,
      ...(user.role === Role.EMPLOYEE ? { assignedToId: user.id } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.assignedToId && user.role !== Role.EMPLOYEE
        ? { assignedToId: query.assignedToId === 'unassigned' ? null : query.assignedToId }
        : {}),
      ...(query.q
        ? {
            OR: [
              { assetTag: { contains: query.q, mode: 'insensitive' as const } },
              { serialNumber: { contains: query.q, mode: 'insensitive' as const } },
              { make: { contains: query.q, mode: 'insensitive' as const } },
              { model: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [assets, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        include: assetDetails,
        orderBy: { assetTag: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.asset.count({ where }),
    ]);
    return { data: assets, page: query.page, pageSize: query.pageSize, total };
  }

  async getDetail(assetId: string, user: AuthenticatedUser) {
    const asset = await this.find(assetId, user.organizationId, {
      ...assetDetails,
      tickets: {
        where: { deletedAt: null },
        select: { id: true, number: true, title: true, status: true, priority: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    });
    this.assertAccess(asset.assignedToId, user);
    return asset;
  }

  async create(user: AuthenticatedUser, input: CreateAssetDto) {
    this.assertStaff(user);
    await this.assertAssignee(input.assignedToId, user.organizationId);
    try {
      return await this.prisma.asset.create({
        data: {
          assetTag: input.assetTag,
          serialNumber: input.serialNumber,
          type: input.type,
          make: input.make,
          model: input.model,
          purchaseDate: input.purchaseDate,
          warrantyExpiry: input.warrantyExpiry,
          condition: input.condition ?? AssetCondition.GOOD,
          notes: input.notes,
          assignedToId: input.assignedToId,
          organizationId: user.organizationId,
        },
        include: assetDetails,
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Asset tag or serial number is already in use.');
      throw error;
    }
  }

  async update(assetId: string, input: UpdateAssetDto, user: AuthenticatedUser) {
    this.assertStaff(user);
    const asset = await this.find(assetId, user.organizationId);
    if (asset.condition === AssetCondition.RETIRED) {
      throw new UnprocessableEntityException('Retired assets cannot be edited.');
    }
    if (input.assignedToId !== undefined) await this.assertAssignee(input.assignedToId, user.organizationId);
    try {
      return await this.prisma.asset.update({
        where: { id: asset.id },
        data: input,
        include: assetDetails,
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Asset tag or serial number is already in use.');
      throw error;
    }
  }

  async retire(assetId: string, user: AuthenticatedUser) {
    if (user.role !== Role.IT_ADMIN) throw new ForbiddenException('Only an IT administrator can retire assets.');
    const asset = await this.find(assetId, user.organizationId);
    if (asset.condition === AssetCondition.RETIRED) {
      throw new UnprocessableEntityException('Asset is already retired.');
    }
    return this.prisma.asset.update({
      where: { id: asset.id },
      data: { condition: AssetCondition.RETIRED, assignedToId: null },
      include: assetDetails,
    });
  }

  private async find(assetId: string, organizationId: string, include?: object) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, organizationId },
      ...(include ? { include } : {}),
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    return asset;
  }

  private async assertAssignee(assigneeId: string | null | undefined, organizationId: string) {
    if (!assigneeId) return;
    const assignee = await this.prisma.user.findFirst({
      where: { id: assigneeId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!assignee) throw new UnprocessableEntityException('Assets can only be assigned to an active user in your organization.');
  }

  private assertAccess(assignedToId: string | null, user: AuthenticatedUser) {
    if (user.role === Role.EMPLOYEE && assignedToId !== user.id) throw new NotFoundException('Asset not found.');
  }

  private assertStaff(user: AuthenticatedUser) {
    if (user.role !== Role.TECHNICIAN && user.role !== Role.IT_ADMIN) {
      throw new ForbiddenException('Only IT staff can manage assets.');
    }
  }

  private isUniqueError(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
