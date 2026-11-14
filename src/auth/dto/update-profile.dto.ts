import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
