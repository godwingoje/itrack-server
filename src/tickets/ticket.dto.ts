import { z } from 'zod';
import {
  TicketImpact,
  TicketPriority,
  TicketStatus,
  TicketType,
  TicketUrgency,
} from '../generated/prisma/enums';

export const createTicketSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(1).max(100),
  type: z.enum(TicketType).optional(),
  impact: z.enum(TicketImpact).optional(),
  urgency: z.enum(TicketUrgency).optional(),
  assetId: z.uuid().optional().nullable(),
});

export const listTicketsSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(TicketStatus).optional(),
  priority: z.enum(TicketPriority).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  assigneeId: z.union([z.uuid(), z.literal('unassigned')]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(5).max(120).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    impact: z.enum(TicketImpact).optional(),
    urgency: z.enum(TicketUrgency).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const changeTicketStatusSchema = z.object({
  to: z.enum(TicketStatus),
  resolutionNote: z.string().trim().min(1).max(5000).optional(),
  comment: z.string().trim().min(1).max(5000).optional(),
});

export const assignTicketSchema = z.object({
  assigneeId: z.uuid().optional(),
});

export const createTicketCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export type CreateTicketDto = z.infer<typeof createTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsSchema>;
export type UpdateTicketDto = z.infer<typeof updateTicketSchema>;
export type ChangeTicketStatusDto = z.infer<typeof changeTicketStatusSchema>;
export type AssignTicketDto = z.infer<typeof assignTicketSchema>;
export type CreateTicketCommentDto = z.infer<typeof createTicketCommentSchema>;