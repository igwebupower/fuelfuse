// Fuel types
export const FUEL_TYPES = {
  PETROL: 'petrol',
  DIESEL: 'diesel',
} as const;

export type FuelType = typeof FUEL_TYPES[keyof typeof FUEL_TYPES];

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];

// Search defaults
export const DEFAULT_RADIUS_MILES = 5;
export const MAX_FREE_RADIUS_MILES = 5;
export const MAX_PRO_RADIUS_MILES = 25;

// Alert defaults
export const DEFAULT_ALERT_THRESHOLD_PPL = 2;
export const MAX_ALERTS_PER_DAY = 2;

// UI Constants
export const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  background: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  border: '#E5E5E5',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
