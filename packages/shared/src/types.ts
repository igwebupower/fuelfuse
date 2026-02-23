// Shared TypeScript types for FuelFuse

export type FuelType = 'petrol' | 'diesel';
export type SubscriptionTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
export type Platform = 'ios' | 'android';
export type TriggerType = 'price_drop';
export type IngestionStatus = 'success' | 'partial' | 'failed';
export type AlertJobStatus = 'success' | 'failed';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface StationResult {
  stationId: string;
  brand: string;
  name: string;
  address: string;
  postcode: string;
  pricePerLitre: number;
  distanceMiles: number;
  lastUpdated: Date;
}

export interface StationDetail extends StationResult {
  lat: number;
  lng: number;
  petrolPrice: number | null;
  dieselPrice: number | null;
  amenities: Record<string, any> | null;
  openingHours: Record<string, any> | null;
}

export interface SearchParams {
  postcode?: string;
  lat?: number;
  lng?: number;
  radiusMiles: number;
  fuelType: FuelType;
}

export interface UserPreferences {
  homePostcode: string | null;
  defaultRadius: number;
  defaultFuelType: FuelType;
}

export interface AlertRule {
  id: string;
  userId: string;
  centerPostcode?: string;
  lat?: number;
  lng?: number;
  radiusMiles: number;
  fuelType: FuelType;
  triggerType: TriggerType;
  thresholdPpl: number;
  enabled: boolean;
  lastTriggeredAt?: Date;
  lastNotifiedPrice?: number;
}

export interface AlertNotification {
  title: string;
  body: string;
  data: {
    stationId: string;
    newPrice: number;
    priceDrop: number;
  };
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status?: SubscriptionStatus;
  periodEnd?: Date;
}

export interface FuelFinderStation {
  stationId: string;
  brand: string;
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  petrolPrice: number | null;
  dieselPrice: number | null;
  updatedAt: Date;
  amenities?: Record<string, any>;
  openingHours?: Record<string, any>;
}

export interface IngestionResult {
  status: IngestionStatus;
  stationsProcessed: number;
  pricesUpdated: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

export interface AlertJobResult {
  status: AlertJobStatus;
  alertsEvaluated: number;
  notificationsSent: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}
