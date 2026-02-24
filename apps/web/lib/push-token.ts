// Push token services for FuelFuse
import { prisma } from './prisma';

/**
 * Register or update an Expo push token for a user
 * Stores the token with user ID and platform (ios/android)
 * Validates: Requirements 4.1
 */
export async function registerToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android'
) {
  // Upsert: if token exists, update it; if not, create it
  const pushToken = await prisma.pushToken.upsert({
    where: { expoPushToken: token },
    create: {
      userId,
      expoPushToken: token,
      platform,
    },
    update: {
      userId,
      platform,
      updatedAt: new Date(),
    },
  });

  return pushToken;
}

/**
 * Get all push tokens for a user
 */
export async function getTokensForUser(userId: string): Promise<string[]> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { expoPushToken: true },
  });

  return tokens.map(t => t.expoPushToken);
}

/**
 * Remove a specific push token
 */
export async function removeToken(token: string) {
  await prisma.pushToken.delete({
    where: { expoPushToken: token },
  });
}

/**
 * Update the last_used_at timestamp for a token
 */
export async function updateTokenLastUsed(token: string) {
  await prisma.pushToken.update({
    where: { expoPushToken: token },
    data: { updatedAt: new Date() },
  });
}
