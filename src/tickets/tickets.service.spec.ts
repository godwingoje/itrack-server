import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role, TicketStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { TicketsService } from './tickets.service';

function makeUser(id: string, role: Role): AuthenticatedUser {
  return {
    id,
    staffId: `staff-${id}`,
    fullName: `User ${id}`,
    email: `${id}@example.test`,
    role,
    organizationId: 'organization-id',
    organization: { id: 'organization-id', name: 'Test', code: 'TEST' },
    departmentId: 'department-id',
    department: { id: 'department-id', name: 'IT', code: 'IT' },
    phone: null,
    address: null,
    isActive: true,
  };
}

describe('TicketsService access rules', () => {
  it('does not disclose another employee ticket', async () => {
    const prisma = {
      ticket: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          reporterId: 'another-user',
        }),
      },
    };
    const service = new TicketsService(prisma as unknown as PrismaService);

    await expect(
      service.getDetail('ticket-id', makeUser('employee', Role.EMPLOYEE)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents employees from adding internal notes', async () => {
    const prisma = {
      ticket: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          reporterId: 'employee',
        }),
      },
      ticketComment: { create: jest.fn() },
    };
    const service = new TicketsService(prisma as unknown as PrismaService);

    await expect(
      service.addComment(
        'ticket-id',
        { body: 'Private staff note', isInternal: true },
        makeUser('employee', Role.EMPLOYEE),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.ticketComment.create).not.toHaveBeenCalled();
  });

  it('rejects invalid status transitions before opening a transaction', async () => {
    const prisma = {
      ticket: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          reporterId: 'employee',
          status: TicketStatus.NEW,
        }),
      },
      $transaction: jest.fn(),
    };
    const service = new TicketsService(prisma as unknown as PrismaService);

    await expect(
      service.changeStatus(
        'ticket-id',
        { to: TicketStatus.CLOSED },
        makeUser('technician', Role.TECHNICIAN),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});