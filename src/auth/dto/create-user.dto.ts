import { Role } from '../../generated/prisma/enums';
import { z } from 'zod';

export const createUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(Role),
  departmentId: z.string().trim().min(1).max(64),
  staffId: z.string().trim().min(1).max(64).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  address: z.string().trim().max(255).nullable().optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
