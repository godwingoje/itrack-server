import {
  TicketImpact,
  TicketPriority,
  TicketStatus,
  TicketUrgency,
} from '../generated/prisma/enums';

const priorityMatrix: Record<
  TicketImpact,
  Record<TicketUrgency, TicketPriority>
> = {
  [TicketImpact.HIGH]: {
    [TicketUrgency.HIGH]: TicketPriority.P1_CRITICAL,
    [TicketUrgency.MEDIUM]: TicketPriority.P2_HIGH,
    [TicketUrgency.LOW]: TicketPriority.P3_MEDIUM,
  },
  [TicketImpact.MEDIUM]: {
    [TicketUrgency.HIGH]: TicketPriority.P2_HIGH,
    [TicketUrgency.MEDIUM]: TicketPriority.P3_MEDIUM,
    [TicketUrgency.LOW]: TicketPriority.P4_LOW,
  },
  [TicketImpact.LOW]: {
    [TicketUrgency.HIGH]: TicketPriority.P3_MEDIUM,
    [TicketUrgency.MEDIUM]: TicketPriority.P4_LOW,
    [TicketUrgency.LOW]: TicketPriority.P5_PLANNING,
  },
};

export const allowedTicketTransitions: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.NEW]: [TicketStatus.ASSIGNED],
  [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.WAITING_ON_USER,
    TicketStatus.RESOLVED,
  ],
  [TicketStatus.WAITING_ON_USER]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  [TicketStatus.CLOSED]: [],
};

const overdueAfterMs: Partial<Record<TicketPriority, number>> = {
  [TicketPriority.P1_CRITICAL]: 4 * 60 * 60 * 1000,
  [TicketPriority.P2_HIGH]: 24 * 60 * 60 * 1000,
  [TicketPriority.P3_MEDIUM]: 72 * 60 * 60 * 1000,
  [TicketPriority.P4_LOW]: 7 * 24 * 60 * 60 * 1000,
};

export function calculateTicketPriority(
  impact: TicketImpact,
  urgency: TicketUrgency,
): TicketPriority {
  return priorityMatrix[impact][urgency];
}

export function formatTicketNumber(number: number): string {
  return `IT-${String(number).padStart(4, '0')}`;
}

export function isTicketOverdue(ticket: {
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date;
}, now = new Date()): boolean {
  if (
    ticket.status === TicketStatus.RESOLVED ||
    ticket.status === TicketStatus.CLOSED
  ) {
    return false;
  }

  const target = overdueAfterMs[ticket.priority];
  return target !== undefined && now.getTime() - ticket.createdAt.getTime() >= target;
}