import Constants from 'expo-constants';

export const config = {
  // API Configuration
  apiUrl: Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  
  // Clerk Configuration
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
  
  // Stripe Configuration
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  
  // App Configuration
  appName: 'FuelFuse',
  appVersion: Constants.expoConfig?.version || '1.0.0',
  
  // Feature Flags
  isDevelopment: __DEV__,
};

// Validate required configuration
export function validateConfig() {
  const errors: string[] = [];
  
  if (!config.clerkPublishableKey) {
    errors.push('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set');
  }
  
  if (!config.stripePublishableKey) {
    errors.push('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
  }
  
  if (errors.length > 0 && !__DEV__) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
  
  return errors;
}
