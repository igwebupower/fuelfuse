// User account services for FuelFuse
import { prisma } from './prisma';
import { UserPreferences } from '@fuelfuse/shared';
import { userPreferencesSchema } from '@fuelfuse/shared';

/**
 * Create a new user with Clerk user ID and email
 * Validates: Requirements 3.1
 */
export async function createUser(clerkUserId: string, email: string) {
  const user = await prisma.user.create({
    data: {
      clerkUserId,
      email,
    },
  });
  
  return user;
}

/**
 * Get user by Clerk user ID
 */
export async function getUserByClerkId(clerkUserId: string) {
  return await prisma.user.findUnique({
    where: { clerkUserId },
  });
}

/**
 * Save user preferences (home postcode, default radius, default fuel type)
 * Validates: Requirements 3.2, 3.4
 */
export async function saveUserPreferences(
  userId: string,
  preferences: UserPreferences
) {
  // Validate input with Zod schema
  const validated = userPreferencesSchema.parse(preferences);
  
  // Upsert preferences (create if not exists, update if exists)
  const savedPreferences = await prisma.userPreferences.upsert({
    where: { userId },
    create: {
      userId,
      homePostcode: validated.homePostcode,
      defaultRadius: validated.defaultRadius,
      defaultFuelType: validated.defaultFuelType,
    },
    update: {
      homePostcode: validated.homePostcode,
      defaultRadius: validated.defaultRadius,
      defaultFuelType: validated.defaultFuelType,
    },
  });
  
  return savedPreferences;
}

/**
 * Retrieve user preferences
 * Validates: Requirements 3.3
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId },
  });
  
  if (!preferences) {
    return null;
  }
  
  return {
    homePostcode: preferences.homePostcode,
    defaultRadius: preferences.defaultRadius,
    defaultFuelType: preferences.defaultFuelType as 'petrol' | 'diesel',
  };
}
