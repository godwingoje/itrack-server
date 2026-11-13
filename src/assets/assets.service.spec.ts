import { AssetCondition, Role } from '../generated/prisma/enums';
import { AssetsService } from './assets.service';
import type { ListAssetsQuery } from './asset.dto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import type { PrismaService } from '../prisma/prisma.service';

describe('AssetsService.list', () => {
  const user = {
    id: 'user-id',
    organizationId: 'organization-id',
    role: Role.IT_ADMIN,
  } as AuthenticatedUser;

  function createService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      asset: { findMany, count },
      $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    } as unknown as PrismaService;
    return { service: new AssetsService(prisma), findMany };
  }

  it('excludes retired assets by default', async () => {
    const { service, findMany } = createService();
    const query: ListAssetsQuery = { page: 1, pageSize: 20, includeRetired: false };

    await service.list(user, query);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: user.organizationId,
        condition: { not: AssetCondition.RETIRED },
      }),
    }));
  });

  it('allows explicitly querying retired assets and assigned assets', async () => {
    const { service, findMany } = createService();
    const query: ListAssetsQuery = {
      page: 1,
      pageSize: 20,
      includeRetired: true,
      condition: AssetCondition.RETIRED,
      assignedToId: 'assigned',
      warrantyExpiringWithinDays: 30,
    };

    await service.list(user, query);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: user.organizationId,
        condition: AssetCondition.RETIRED,
        assignedToId: { not: null },
        warrantyExpiry: {
          gte: expect.any(Date),
          lt: expect.any(Date),
        },
      }),
    }));
  });
});
