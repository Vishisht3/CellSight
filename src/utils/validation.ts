import { z } from 'zod';
import { UserRole, AssetType, MaterialType, SupplierTier } from '../config/constants';

// Telemetry validation schema
export const telemetryIngestSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  voltage: z.number().min(0, 'Voltage must be non-negative').max(1000, 'Voltage exceeds maximum'),
  current: z.number().min(-500, 'Current out of range').max(500, 'Current out of range'),
  temperature: z.number().min(-50, 'Temperature too low').max(100, 'Temperature too high'),
  stateOfCharge: z.number().min(0, 'SoC must be between 0 and 100').max(100, 'SoC must be between 0 and 100'),
  cycleCount: z.number().int('Cycle count must be an integer').min(0, 'Cycle count must be non-negative'),
  timestamp: z.string().datetime().optional(),
});

// Password strength: 8+ chars, at least one digit or special character
const passwordStrength = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    pw => /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw),
    'Password must contain at least one number or special character'
  );

// User validation schemas
export const userLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const userRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordStrength,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Invalid user role' }) }),
});

// Asset validation schema
export const assetCreateSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(100, 'Asset name too long'),
  assetType: z.nativeEnum(AssetType, { errorMap: () => ({ message: 'Invalid asset type' }) }),
  batteryPackId: z.string().uuid('Invalid battery pack ID'),
});

// Supplier validation schema
export const supplierCreateSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200, 'Supplier name too long'),
  tier: z.nativeEnum(SupplierTier, { errorMap: () => ({ message: 'Invalid supplier tier' }) }),
  country: z.string().length(2, 'Country must be a 2-letter ISO code').toUpperCase(),
  certificationExpiry: z.string().datetime().optional(),
});

// Material lot validation schema
export const materialLotCreateSchema = z.object({
  lotNumber: z.string().min(1, 'Lot number is required').max(50, 'Lot number too long'),
  materialType: z.nativeEnum(MaterialType, { errorMap: () => ({ message: 'Invalid material type' }) }),
  supplierId: z.string().uuid('Invalid supplier ID'),
  quantity: z.number().positive('Quantity must be positive'),
  country: z.string().length(2, 'Country must be a 2-letter ISO code').toUpperCase(),
  receivedAt: z.string().datetime().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  specificationMin: z.number().optional(),
  specificationMax: z.number().optional(),
});

// Cell batch validation schema
export const cellBatchCreateSchema = z.object({
  batchNumber: z.string().min(1, 'Batch number is required').max(50, 'Batch number too long'),
  manufacturerId: z.string().uuid('Invalid manufacturer ID'),
  productionDate: z.string().datetime().optional(),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive'),
  materialLotIds: z.array(z.string().uuid('Invalid material lot ID')).optional(),
});

// Battery pack validation schema
export const batteryPackCreateSchema = z.object({
  packNumber: z.string().min(1, 'Pack number is required').max(50, 'Pack number too long'),
  cellBatchId: z.string().uuid('Invalid cell batch ID'),
  assemblyDate: z.string().datetime().optional(),
  capacity: z.number().positive('Capacity must be positive'),
});

// Alert acknowledgment schema
export const alertAcknowledgeSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export type TelemetryIngestInput = z.infer<typeof telemetryIngestSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UserRegisterInput = z.infer<typeof userRegisterSchema>;
export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export type MaterialLotCreateInput = z.infer<typeof materialLotCreateSchema>;
export type CellBatchCreateInput = z.infer<typeof cellBatchCreateSchema>;
export type BatteryPackCreateInput = z.infer<typeof batteryPackCreateSchema>;
