// Shared Zod validation schemas for FuelFuse
import { z } from 'zod';

// Fuel type schema
export const fuelTypeSchema = z.enum(['petrol', 'diesel']);

// Platform schema
export const platformSchema = z.enum(['ios', 'android']);

// Coordinates schema
export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// UK postcode regex (simplified)
export const postcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i;

export const postcodeSchema = z.string().regex(postcodeRegex, 'Invalid UK postcode format');

// Search parameters schema
export const searchParamsSchema = z.object({
  postcode: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusMiles: z.number().min(1).max(25),
  fuelType: fuelTypeSchema,
}).refine(
  (data) => (data.postcode !== undefined) || (data.lat !== undefined && data.lng !== undefined),
  { message: 'Either postcode or lat/lng coordinates must be provided' }
);

// User preferences schema
export const userPreferencesSchema = z.object({
  homePostcode: postcodeSchema.nullable(),
  defaultRadius: z.number().min(1).max(25).default(5),
  defaultFuelType: fuelTypeSchema.default('petrol'),
});

// Alert rule creation schema
export const createAlertRuleSchema = z.object({
  centerPostcode: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusMiles: z.number().min(1).max(25),
  fuelType: fuelTypeSchema,
  triggerType: z.literal('price_drop').default('price_drop'),
  thresholdPpl: z.number().min(1).max(100).default(2),
  enabled: z.boolean().default(true),
}).refine(
  (data) => (data.centerPostcode !== undefined) || (data.lat !== undefined && data.lng !== undefined),
  { message: 'Either centerPostcode or lat/lng coordinates must be provided' }
);

// Push token registration schema
export const pushTokenSchema = z.object({
  expoPushToken: z.string().min(1),
  platform: platformSchema,
});

// Station result schema
export const stationResultSchema = z.object({
  stationId: z.string(),
  brand: z.string(),
  name: z.string(),
  address: z.string(),
  postcode: z.string(),
  pricePerLitre: z.number(),
  distanceMiles: z.number(),
  lastUpdated: z.date(),
});

// Station detail schema
export const stationDetailSchema = stationResultSchema.extend({
  lat: z.number(),
  lng: z.number(),
  petrolPrice: z.number().nullable(),
  dieselPrice: z.number().nullable(),
  amenities: z.record(z.any()).nullable(),
  openingHours: z.record(z.any()).nullable(),
});

// Fuel Finder API station schema
export const fuelFinderStationSchema = z.object({
  stationId: z.string().min(1),
  brand: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  postcode: z.string().min(1),
  lat: z.number().min(-90).max(90).finite(),
  lng: z.number().min(-180).max(180).finite(),
  petrolPrice: z.number().min(0).nullable(),
  dieselPrice: z.number().min(0).nullable(),
  updatedAt: z.coerce.date(),
  amenities: z.record(z.any()).optional(),
  openingHours: z.record(z.any()).optional(),
});

// Ingestion result schema
export const ingestionResultSchema = z.object({
  status: z.enum(['success', 'partial', 'failed']),
  stationsProcessed: z.number(),
  pricesUpdated: z.number(),
  errors: z.array(z.string()),
  startedAt: z.date(),
  finishedAt: z.date(),
});

// Alert job result schema
export const alertJobResultSchema = z.object({
  status: z.enum(['success', 'failed']),
  alertsEvaluated: z.number(),
  notificationsSent: z.number(),
  errors: z.array(z.string()),
  startedAt: z.date(),
  finishedAt: z.date(),
});
