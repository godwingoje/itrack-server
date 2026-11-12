import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Role,
  TicketEventType,
  TicketImpact,
  TicketPriority,
  TicketStatus,
  TicketType,
  TicketUrgency,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import type {
  AssignTicketDto,
  ChangeTicketStatusDto,
  CreateTicketCommentDto,
  CreateTicketDto,
  ListTicketsQuery,
  UpdateTicketDto,
} from './ticket.dto';
import {
  allowedTicketTransitions,
  calculateTicketPriority,
  formatTicketNumber,
  isTicketOverdue,
} from './ticket-rules';

const ticketDetails = {
  category: true,
  reporter: {
    select: {
      id: true,
      staffId: true,
      fullName: true,
      email: true,
      department: { select: { id: true, name: true } },
    },
  },
  assignee: {
    select: {
      id: true,
      staffId: true,
      fullName: true,
      email: true,
      department: { select: { id: true, name: true } },
    },
  },
  asset: true,
} as const;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, input: CreateTicketDto) {
    const impact = input.impact ?? TicketImpact.MEDIUM;
    const urgency = input.urgency ?? TicketUrgency.MEDIUM;
    const priority = calculateTicketPriority(impact, urgency);

    if (input.assetId) {
      await this.assertAssetAccess(input.assetId, user);
    }

    const category = await this.prisma.category.upsert({
      where: {
        organizationId_name: {
          organizationId: user.organizationId,
          name: input.category,
        },
      },
      update: {},
      create: {
        organizationId: user.organizationId,
        name: input.category,
        defaultPriority: priority,
      },
    });

    const ticket = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.ticket.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type ?? TicketType.PROBLEM,
          impact,
          urgency,
          priority,
          categoryId: category.id,
          reporterId: user.id,
          organizationId: user.organizationId,
          assetId: input.assetId ?? null,
        },
      });

      await transaction.ticketEvent.create({
        data: {
          ticketId: created.id,
          actorId: user.id,
          type: TicketEventType.STATUS,
          fromValue: null,
          toValue: TicketStatus.NEW,
        },
      });

      return created;
    });

    return this.getDetail(ticket.id, user);
  }

  async list(user: AuthenticatedUser, query: ListTicketsQuery) {
    const where = {
      deletedAt: null,
      ...(this.isOwnTicketsOnly(user) ? { reporterId: user.id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assigneeId
        ? {
            assigneeId:
              query.assigneeId === 'unassigned' ? null : query.assigneeId,
          }
        : {}),
      organizationId: user.organizationId,
      ...(query.category
        ? { category: { name: { equals: query.category, mode: 'insensitive' as const } } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              {
                description: {
                  contains: query.q,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: ticketDetails,
        orderBy: [{ createdAt: 'desc' }, { number: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets.map((ticket) => this.serialize(ticket)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async getDetail(ticketId: string, user: AuthenticatedUser) {
    const ticket = await this.findTicket(ticketId, user.organizationId, {
      ...ticketDetails,
      comments: {
        where: this.isStaff(user) ? {} : { isInternal: false },
        include: {
          author: {
            select: { id: true, staffId: true, fullName: true, role: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      events: {
        include: {
          actor: {
            select: { id: true, staffId: true, fullName: true, role: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    });
    this.assertTicketAccess(ticket.reporterId, user);
    return this.serialize(ticket);
  }

  async update(
    ticketId: string,
    input: UpdateTicketDto,
    user: AuthenticatedUser,
  ) {
    this.assertStaff(user);
    const current = await this.findTicket(ticketId, user.organizationId);
    const category = input.category
      ? await this.prisma.category.upsert({
          where: {
            organizationId_name: {
              organizationId: user.organizationId,
              name: input.category,
            },
          },
          update: {},
          create: {
            organizationId: user.organizationId,
            name: input.category,
            defaultPriority: current.priority,
          },
        })
      : undefined;

    const impact = input.impact ?? current.impact;
    const urgency = input.urgency ?? current.urgency;
    const priority = calculateTicketPriority(impact, urgency);
    const priorityChanged = priority !== current.priority;

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.ticket.update({
        where: { id: current.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(category ? { categoryId: category.id } : {}),
          ...(input.impact !== undefined ? { impact } : {}),
          ...(input.urgency !== undefined ? { urgency } : {}),
          ...(priorityChanged ? { priority } : {}),
        },
      });

      if (priorityChanged) {
        await transaction.ticketEvent.create({
          data: {
            ticketId: current.id,
            actorId: user.id,
            type: TicketEventType.PRIORITY,
            fromValue: current.priority,
            toValue: priority,
          },
        });
      }

      return result;
    });

    return this.getDetail(updated.id, user);
  }

  async changeStatus(
    ticketId: string,
    input: ChangeTicketStatusDto,
    user: AuthenticatedUser,
  ) {
    const current = await this.findTicket(ticketId, user.organizationId);
    const isOwner = current.reporterId === user.id;
    const isReopen =
      current.status === TicketStatus.RESOLVED &&
      input.to === TicketStatus.IN_PROGRESS;
    const isClose =
      current.status === TicketStatus.RESOLVED &&
      input.to === TicketStatus.CLOSED;

    if (isOwner && (isReopen || isClose)) {
      if (isReopen && !input.comment) {
        throw new UnprocessableEntityException(
          'A comment is required to reopen a ticket.',
        );
      }
    } else {
      this.assertStaff(user);
    }

    if (!allowedTicketTransitions[current.status].includes(input.to)) {
      throw new UnprocessableEntityException(
        `Cannot move a ticket from ${current.status} to ${input.to}.`,
      );
    }
    if (input.to === TicketStatus.RESOLVED && !input.resolutionNote) {
      throw new UnprocessableEntityException(
        'A resolution note is required to resolve a ticket.',
      );
    }
    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.ticket.update({
        where: { id: current.id },
        data: {
          status: input.to,
          ...(input.to === TicketStatus.RESOLVED
            ? {
                resolutionNote: input.resolutionNote,
                resolvedAt: new Date(),
              }
            : {}),
          ...(input.to === TicketStatus.CLOSED ? { closedAt: new Date() } : {}),
          ...(isReopen
            ? { resolutionNote: null, resolvedAt: null, closedAt: null }
            : {}),
        },
      });

      await transaction.ticketEvent.create({
        data: {
          ticketId: current.id,
          actorId: user.id,
          type: TicketEventType.STATUS,
          fromValue: current.status,
          toValue: input.to,
        },
      });

      if (isReopen && input.comment) {
        await transaction.ticketComment.create({
          data: {
            ticketId: current.id,
            authorId: user.id,
            body: input.comment,
            isInternal: false,
          },
        });
      }

      return result;
    });

    return this.getDetail(updated.id, user);
  }

  async assign(
    ticketId: string,
    input: AssignTicketDto,
    user: AuthenticatedUser,
  ) {
    const current = await this.findTicket(ticketId, user.organizationId);
    let assigneeId: string;

    if (user.role === Role.TECHNICIAN) {
      if (input.assigneeId && input.assigneeId !== user.id) {
        throw new ForbiddenException('Technicians can only assign tickets to themselves.');
      }
      assigneeId = user.id;
    } else if (user.role === Role.IT_ADMIN) {
      if (!input.assigneeId) {
        throw new UnprocessableEntityException(
          'An assigneeId is required for administrator assignment.',
        );
      }
      assigneeId = input.assigneeId;
    } else {
      throw new ForbiddenException('Insufficient permissions to assign tickets.');
    }

    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, role: true, isActive: true },
    });
    const sameOrganizationAssignee = assignee
      ? await this.prisma.user.findFirst({
          where: { id: assigneeId, organizationId: user.organizationId },
          select: { id: true },
        })
      : null;
    if (!assignee || !assignee.isActive || !sameOrganizationAssignee) {
      throw new UnprocessableEntityException(
        'Tickets can only be assigned to an active user.',
      );
    }

    const nextStatus =
      current.status === TicketStatus.NEW
        ? TicketStatus.ASSIGNED
        : current.status;
    if (
      current.status !== TicketStatus.NEW &&
      current.status !== TicketStatus.ASSIGNED
    ) {
      throw new UnprocessableEntityException(
        'Only new or assigned tickets can be assigned.',
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.ticket.update({
        where: { id: current.id },
        data: { assigneeId, status: nextStatus },
      });

      await transaction.ticketEvent.create({
        data: {
          ticketId: current.id,
          actorId: user.id,
          type: TicketEventType.ASSIGN,
          fromValue: current.assigneeId,
          toValue: assigneeId,
        },
      });

      if (current.status !== nextStatus) {
        await transaction.ticketEvent.create({
          data: {
            ticketId: current.id,
            actorId: user.id,
            type: TicketEventType.STATUS,
            fromValue: current.status,
            toValue: nextStatus,
          },
        });
      }

      return result;
    });

    return this.getDetail(updated.id, user);
  }

  async addComment(
    ticketId: string,
    input: CreateTicketCommentDto,
    user: AuthenticatedUser,
  ) {
    const ticket = await this.findTicket(ticketId, user.organizationId);
    this.assertTicketAccess(ticket.reporterId, user);
    const isInternal = input.isInternal ?? false;
    if (isInternal && !this.isStaff(user)) {
      throw new ForbiddenException('Only IT staff can add internal notes.');
    }

    await this.prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body: input.body,
        isInternal,
      },
    });
    return this.getDetail(ticket.id, user);
  }

  async remove(ticketId: string, user: AuthenticatedUser) {
    this.assertAdmin(user);
    const current = await this.findTicket(ticketId, user.organizationId);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.ticket.update({
        where: { id: current.id },
        data: { deletedAt: new Date() },
      });
      await transaction.ticketEvent.create({
        data: {
          ticketId: current.id,
          actorId: user.id,
          type: TicketEventType.DELETE,
          fromValue: current.status,
          toValue: null,
        },
      });
    });

    return { id: current.id, number: formatTicketNumber(current.number) };
  }

  private async findTicket(
    ticketId: string,
    organizationId: string,
    include?: object,
  ) {
    const normalized = ticketId.trim().toUpperCase();
    const numberMatch = /^IT-(\d+)$/.exec(normalized);
    const ticket = numberMatch
      ? await this.prisma.ticket.findFirst({
          where: {
            number: Number(numberMatch[1]),
            deletedAt: null,
            organizationId,
          },
          ...(include ? { include } : {}),
        })
      : await this.prisma.ticket.findFirst({
          where: { id: ticketId, deletedAt: null, organizationId },
          ...(include ? { include } : {}),
        });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    return ticket;
  }

  private async assertAssetAccess(assetId: string, user: AuthenticatedUser) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId, organizationId: user.organizationId },
      select: { id: true, assignedToId: true },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    if (this.isOwnTicketsOnly(user) && asset.assignedToId !== user.id) {
      throw new ForbiddenException('You can only link assets assigned to you.');
    }
  }

  private isOwnTicketsOnly(user: AuthenticatedUser): boolean {
    return user.role === Role.EMPLOYEE || user.role === Role.SECURITY;
  }

  private isStaff(user: AuthenticatedUser): boolean {
    return user.role === Role.TECHNICIAN || user.role === Role.IT_ADMIN;
  }

  private assertTicketAccess(reporterId: string, user: AuthenticatedUser) {
    if (this.isOwnTicketsOnly(user) && reporterId !== user.id) {
      throw new NotFoundException('Ticket not found.');
    }
  }

  private assertStaff(user: AuthenticatedUser) {
    if (!this.isStaff(user)) {
      throw new ForbiddenException('Only IT staff can perform this action.');
    }
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== Role.IT_ADMIN) {
      throw new ForbiddenException('Only an IT administrator can delete tickets.');
    }
  }

  private serialize<T extends {
    number: number;
    status: TicketStatus;
    priority: TicketPriority;
    createdAt: Date;
  }>(ticket: T) {
    return {
      ...ticket,
      number: formatTicketNumber(ticket.number),
      overdue: isTicketOverdue(ticket),
    };
  }
}