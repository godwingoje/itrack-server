import { Injectable } from '@nestjs/common';
import { TicketStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organizationId: string) {
    const where = { organizationId, deletedAt: null };
    const [total, byStatus, categoryBreakdown, resolvedTickets] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.ticket.groupBy({
        by: ['categoryId'],
        where,
        _count: { _all: true },
        orderBy: { _count: { categoryId: 'desc' } },
      }),
      this.prisma.ticket.findMany({
        where: { ...where, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryBreakdown.map((item) => item.categoryId) } },
      select: { id: true, name: true },
    });
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const averageResolutionHours = resolvedTickets.length
      ? resolvedTickets.reduce(
          (totalHours, ticket) =>
            totalHours + (ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()) / 3_600_000,
          0,
        ) / resolvedTickets.length
      : null;

    return {
      counts: {
        total,
        byStatus: Object.fromEntries(
          Object.values(TicketStatus).map((status) => [
            status,
            byStatus.find((item) => item.status === status)?._count._all ?? 0,
          ]),
        ),
      },
      resolutionTime: {
        resolvedTickets: resolvedTickets.length,
        averageHours: averageResolutionHours === null ? null : Number(averageResolutionHours.toFixed(2)),
      },
      categoryBreakdown: categoryBreakdown.map((item) => ({
        categoryId: item.categoryId,
        category: categoryNames.get(item.categoryId) ?? 'Unknown',
        count: item._count._all,
      })),
    };
  }
}
