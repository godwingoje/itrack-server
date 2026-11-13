import { AssetCondition, AssetType, Role, TicketPriority, TicketStatus } from '../generated/prisma/enums';
import { DashboardService } from './dashboard.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  it('returns server-calculated 30-day resolution, overdue, technician, and asset metrics', async () => {
    const now = new Date('2026-11-10T12:00:00.000Z');
    const resolvedAt = new Date('2026-11-09T12:00:00.000Z');
    const createdAt = new Date('2026-11-08T12:00:00.000Z');
    const openTicket = {
      id: 'ticket-id',
      number: 12,
      title: 'Network unavailable',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.P1_CRITICAL,
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      assignee: { id: 'technician-id', fullName: 'Alex Technician', role: Role.TECHNICIAN },
    };
    const assetCount = jest.fn().mockResolvedValue(1);
    const prisma = {
      ticket: {
        count: jest.fn().mockResolvedValue(2),
        groupBy: jest.fn()
          .mockResolvedValueOnce([{ status: TicketStatus.IN_PROGRESS, _count: { _all: 1 } }])
          .mockResolvedValueOnce([{ categoryId: 'category-id', _count: { _all: 1 } }]),
        findMany: jest.fn()
          .mockResolvedValueOnce([{ createdAt, resolvedAt }])
          .mockResolvedValueOnce([openTicket]),
      },
      asset: {
        groupBy: jest.fn()
          .mockResolvedValueOnce([{ type: AssetType.LAPTOP, _count: { _all: 3 } }])
          .mockResolvedValueOnce([{ condition: AssetCondition.GOOD, _count: { _all: 3 } }]),
        count: assetCount,
      },
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: 'category-id', name: 'Network' }]),
      },
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);

    const result = await service.getSummary('organization-id', now);

    expect(result.period.from).toBe(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
    expect(result.resolutionTime).toEqual({ resolvedTickets: 1, averageHours: 24 });
    expect(result.categoryBreakdown).toEqual([{ categoryId: 'category-id', category: 'Network', count: 1 }]);
    expect(result.overdueTickets).toHaveLength(1);
    expect(result.overdueTickets[0]).toMatchObject({
      number: 'IT-0012',
      assignee: { id: 'technician-id', fullName: 'Alex Technician' },
    });
    expect(result.technicianWorkload).toEqual([{
      technicianId: 'technician-id',
      technicianName: 'Alex Technician',
      openTickets: 1,
      overdueTickets: 1,
    }]);
    expect(result.assetSummary).toMatchObject({
      countsByType: expect.arrayContaining([{ type: AssetType.LAPTOP, count: 3 }]),
      countsByCondition: expect.arrayContaining([{ condition: AssetCondition.GOOD, count: 3 }]),
      warrantiesExpiringIn30Days: 1,
    });
    expect(assetCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        warrantyExpiry: expect.objectContaining({
          gte: expect.any(Date),
          lt: expect.any(Date),
        }),
      }),
    }));
  });
});
