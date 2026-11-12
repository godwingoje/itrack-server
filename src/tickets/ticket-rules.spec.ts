import {
  TicketImpact,
  TicketPriority,
  TicketStatus,
  TicketUrgency,
} from '../generated/prisma/enums';
import {
  allowedTicketTransitions,
  calculateTicketPriority,
  formatTicketNumber,
  isTicketOverdue,
} from './ticket-rules';

describe('ticket rules', () => {
  it('calculates priority from impact and urgency', () => {
    expect(
      calculateTicketPriority(TicketImpact.HIGH, TicketUrgency.HIGH),
    ).toBe(TicketPriority.P1_CRITICAL);
    expect(
      calculateTicketPriority(TicketImpact.MEDIUM, TicketUrgency.LOW),
    ).toBe(TicketPriority.P4_LOW);
    expect(
      calculateTicketPriority(TicketImpact.LOW, TicketUrgency.LOW),
    ).toBe(TicketPriority.P5_PLANNING);
  });

  it('allows only the documented lifecycle transitions', () => {
    expect(allowedTicketTransitions[TicketStatus.NEW]).toEqual([
      TicketStatus.ASSIGNED,
    ]);
    expect(allowedTicketTransitions[TicketStatus.RESOLVED]).toEqual([
      TicketStatus.CLOSED,
      TicketStatus.IN_PROGRESS,
    ]);
    expect(allowedTicketTransitions[TicketStatus.CLOSED]).toEqual([]);
  });

  it('formats readable ticket numbers', () => {
    expect(formatTicketNumber(42)).toBe('IT-0042');
  });

  it('flags open tickets after their priority target but not resolved tickets', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');
    const createdAt = new Date('2026-11-11T07:00:00.000Z');

    expect(
      isTicketOverdue(
        {
          status: TicketStatus.IN_PROGRESS,
          priority: TicketPriority.P1_CRITICAL,
          createdAt,
        },
        now,
      ),
    ).toBe(true);
    expect(
      isTicketOverdue(
        {
          status: TicketStatus.RESOLVED,
          priority: TicketPriority.P1_CRITICAL,
          createdAt,
        },
        now,
      ),
    ).toBe(false);
  });
});