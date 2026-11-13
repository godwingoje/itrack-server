import { Injectable } from '@nestjs/common';
import {
  AssetCondition,
  AssetType,
  Role,
  TicketStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { formatTicketNumber, isTicketOverdue } from '../tickets/ticket-rules';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organizationId: string, now = new Date()) {
    const where = { organizationId, deletedAt: null };
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const warrantyWindowEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 31),
    );
    const [total, byStatus, categoryBreakdown, resolvedTickets, openTickets, assetsByType, assetsByCondition, warrantiesExpiring] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.ticket.groupBy({
        by: ['categoryId'],
        where: { ...where, createdAt: { gte: last30Days, lte: now } },
        _count: { _all: true },
        orderBy: { _count: { categoryId: 'desc' } },
      }),
      this.prisma.ticket.findMany({
        where: { ...where, resolvedAt: { gte: last30Days, lte: now } },
        select: { createdAt: true, resolvedAt: true },
      }),
      this.prisma.ticket.findMany({
        where: {
          ...where,
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          assignee: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { number: 'asc' }],
      }),
      this.prisma.asset.groupBy({
        by: ['type'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.asset.groupBy({
        by: ['condition'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.asset.count({
        where: {
          organizationId,
          condition: { not: AssetCondition.RETIRED },
          warrantyExpiry: {
            gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
            lt: warrantyWindowEnd,
          },
        },
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
            totalHours + ((ticket.resolvedAt?.getTime() ?? ticket.createdAt.getTime()) - ticket.createdAt.getTime()) / 3_600_000,
          0,
        ) / resolvedTickets.length
      : null;
    const overdueTickets = openTickets
      .filter((ticket) => isTicketOverdue(ticket, now))
      .map((ticket) => ({
        id: ticket.id,
        number: formatTicketNumber(ticket.number),
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        assignee: ticket.assignee
          ? { id: ticket.assignee.id, fullName: ticket.assignee.fullName }
          : null,
      }));
    const workloadByTechnician = new Map<string, {
      technicianId: string;
      technicianName: string;
      openTickets: number;
      overdueTickets: number;
    }>();
    for (const ticket of openTickets) {
      const assignee = ticket.assignee;
      if (!assignee || assignee.role !== Role.TECHNICIAN) continue;
      const workload = workloadByTechnician.get(assignee.id) ?? {
        technicianId: assignee.id,
        technicianName: assignee.fullName,
        openTickets: 0,
        overdueTickets: 0,
      };
      workload.openTickets += 1;
      if (isTicketOverdue(ticket, now)) workload.overdueTickets += 1;
      workloadByTechnician.set(assignee.id, workload);
    }

    return {
      period: { from: last30Days.toISOString(), to: now.toISOString() },
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
      overdueTickets,
      technicianWorkload: [...workloadByTechnician.values()]
        .sort((left, right) => right.openTickets - left.openTickets),
      assetSummary: {
        countsByType: Object.values(AssetType).map((type) => ({
          type,
          count: assetsByType.find((item) => item.type === type)?._count._all ?? 0,
        })),
        countsByCondition: Object.values(AssetCondition).map((condition) => ({
          condition,
          count: assetsByCondition.find((item) => item.condition === condition)?._count._all ?? 0,
        })),
        warrantiesExpiringIn30Days: warrantiesExpiring,
      },
    };
  }
}
