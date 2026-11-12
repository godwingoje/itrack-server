import { z } from 'zod';
import { AssetCondition, AssetType } from '../generated/prisma/enums';

const assetFields = {
  assetTag: z.string().trim().min(1).max(64),
  serialNumber: z.string().trim().min(1).max(128),
  type: z.enum(AssetType),
  make: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120),
  purchaseDate: z.coerce.date().optional().nullable(),
  warrantyExpiry: z.coerce.date().optional().nullable(),
  condition: z.enum(AssetCondition).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
  assignedToId: z.uuid().optional().nullable(),
};

export const createAssetSchema = z.object(assetFields);
export const updateAssetSchema = z
  .object({
    assetTag: assetFields.assetTag.optional(),
    serialNumber: assetFields.serialNumber.optional(),
    type: assetFields.type.optional(),
    make: assetFields.make.optional(),
    model: assetFields.model.optional(),
    purchaseDate: assetFields.purchaseDate,
    warrantyExpiry: assetFields.warrantyExpiry,
    condition: assetFields.condition,
    notes: assetFields.notes,
    assignedToId: assetFields.assignedToId,
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field is required.',
  });

export const listAssetsSchema = z.object({
  q: z.string().trim().max(200).optional(),
  type: z.enum(AssetType).optional(),
  condition: z.enum(AssetCondition).optional(),
  assignedToId: z.union([z.uuid(), z.literal('unassigned')]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateAssetDto = z.infer<typeof createAssetSchema>;
export type UpdateAssetDto = z.infer<typeof updateAssetSchema>;
export type ListAssetsQuery = z.infer<typeof listAssetsSchema>;
