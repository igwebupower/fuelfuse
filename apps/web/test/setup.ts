// Test setup file for vitest
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';

// Clean up database before each test
beforeEach(async () => {
  // Clean up in reverse order of dependencies
  await prisma.alertRun.deleteMany();
  await prisma.ingestionRun.deleteMany();
  await prisma.postcodeGeoCache.deleteMany();
  await prisma.stationPriceHistory.deleteMany();
  await prisma.stationPriceLatest.deleteMany();
  await prisma.station.deleteMany();
  await prisma.alertRule.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
