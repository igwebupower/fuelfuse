import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (optional - can be controlled via env var)
  const shouldClear = process.env.SEED_CLEAR === 'true';
  
  if (shouldClear) {
    console.log('🧹 Clearing existing data...');
    await prisma.alertRun.deleteMany();
    await prisma.ingestionRun.deleteMany();
    await prisma.stationPriceHistory.deleteMany();
    await prisma.stationPriceLatest.deleteMany();
    await prisma.station.deleteMany();
    await prisma.postcodeGeoCache.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.pushToken.deleteMany();
    await prisma.userPreferences.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Cleared existing data');
  }

  // Create test users
  console.log('👤 Creating test users...');
  
  const freeUser = await prisma.user.upsert({
    where: { clerkUserId: 'user_test_free_123' },
    update: {},
    create: {
      clerkUserId: 'user_test_free_123',
      email: 'free@test.fuelfuse.app',
      subscription: {
        create: {
          stripeCustomerId: 'cus_test_free_123',
          status: 'active',
          plan: 'free',
        },
      },
      preferences: {
        create: {
          homePostcode: 'SW1A 1AA',
          defaultRadius: 5,
          defaultFuelType: 'petrol',
        },
      },
    },
  });

  const proUser = await prisma.user.upsert({
    where: { clerkUserId: 'user_test_pro_456' },
    update: {},
    create: {
      clerkUserId: 'user_test_pro_456',
      email: 'pro@test.fuelfuse.app',
      subscription: {
        create: {
          stripeCustomerId: 'cus_test_pro_456',
          stripeSubscriptionId: 'sub_test_pro_456',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      },
      preferences: {
        create: {
          homePostcode: 'EC1A 1BB',
          defaultRadius: 10,
          defaultFuelType: 'diesel',
        },
      },
    },
  });

  console.log(`✅ Created users: ${freeUser.email}, ${proUser.email}`);

  // Create test stations with realistic UK locations
  console.log('⛽ Creating test stations...');
  
  const stations = [
    {
      stationId: 'station_001',
      brand: 'Shell',
      name: 'Shell Westminster',
      address: '123 Victoria Street',
      postcode: 'SW1E 5ND',
      lat: 51.4975,
      lng: -0.1357,
      petrolPpl: 14590, // 145.9p
      dieselPpl: 15290, // 152.9p
    },
    {
      stationId: 'station_002',
      brand: 'BP',
      name: 'BP Pimlico',
      address: '45 Vauxhall Bridge Road',
      postcode: 'SW1V 2SA',
      lat: 51.4920,
      lng: -0.1410,
      petrolPpl: 14390, // 143.9p (cheapest petrol)
      dieselPpl: 15190, // 151.9p
    },
    {
      stationId: 'station_003',
      brand: 'Tesco',
      name: 'Tesco Extra Westminster',
      address: '78 Horseferry Road',
      postcode: 'SW1P 2EE',
      lat: 51.4955,
      lng: -0.1320,
      petrolPpl: 14490, // 144.9p
      dieselPpl: 15090, // 150.9p (cheapest diesel)
    },
    {
      stationId: 'station_004',
      brand: 'Esso',
      name: 'Esso Belgravia',
      address: '12 Ebury Street',
      postcode: 'SW1W 0LU',
      lat: 51.4935,
      lng: -0.1480,
      petrolPpl: 14690, // 146.9p
      dieselPpl: 15390, // 153.9p
    },
    {
      stationId: 'station_005',
      brand: 'Sainsburys',
      name: 'Sainsburys Pimlico',
      address: '89 Lupus Street',
      postcode: 'SW1V 3EN',
      lat: 51.4885,
      lng: -0.1395,
      petrolPpl: 14540, // 145.4p
      dieselPpl: 15240, // 152.4p
    },
  ];

  const now = new Date();
  const updatedAtSource = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

  for (const stationData of stations) {
    const station = await prisma.station.upsert({
      where: { stationId: stationData.stationId },
      update: {},
      create: {
        stationId: stationData.stationId,
        brand: stationData.brand,
        name: stationData.name,
        address: stationData.address,
        postcode: stationData.postcode,
        lat: stationData.lat,
        lng: stationData.lng,
        amenities: {
          carWash: stationData.brand === 'Shell' || stationData.brand === 'BP',
          shop: true,
          atm: stationData.brand !== 'Esso',
          airPump: true,
        },
        openingHours: {
          monday: '06:00-22:00',
          tuesday: '06:00-22:00',
          wednesday: '06:00-22:00',
          thursday: '06:00-22:00',
          friday: '06:00-23:00',
          saturday: '07:00-23:00',
          sunday: '08:00-20:00',
        },
        updatedAtSource,
        latestPrice: {
          create: {
            petrolPpl: stationData.petrolPpl,
            dieselPpl: stationData.dieselPpl,
            updatedAtSource,
          },
        },
        priceHistory: {
          create: {
            petrolPpl: stationData.petrolPpl,
            dieselPpl: stationData.dieselPpl,
            updatedAtSource,
          },
        },
      },
    });

    console.log(`  ✅ ${station.name} - Petrol: ${stationData.petrolPpl / 100}p, Diesel: ${stationData.dieselPpl / 100}p`);
  }

  // Create postcode geocoding cache entries
  console.log('📍 Creating geocoding cache entries...');
  
  const postcodes = [
    { postcode: 'SW1A 1AA', lat: 51.5014, lng: -0.1419 }, // Westminster
    { postcode: 'EC1A 1BB', lat: 51.5174, lng: -0.0933 }, // City of London
    { postcode: 'SW1E 5ND', lat: 51.4975, lng: -0.1357 }, // Victoria
    { postcode: 'SW1V 2SA', lat: 51.4920, lng: -0.1410 }, // Pimlico
  ];

  for (const pc of postcodes) {
    await prisma.postcodeGeoCache.upsert({
      where: { postcodeNormalized: pc.postcode },
      update: { lastUsedAt: now },
      create: {
        postcodeNormalized: pc.postcode,
        lat: pc.lat,
        lng: pc.lng,
        lastUsedAt: now,
      },
    });
  }

  console.log(`✅ Created ${postcodes.length} geocoding cache entries`);

  // Create sample alert rules for Pro user
  console.log('🔔 Creating sample alert rules...');
  
  await prisma.alertRule.upsert({
    where: { id: 'alert_test_001' },
    update: {},
    create: {
      id: 'alert_test_001',
      userId: proUser.id,
      centerPostcode: 'SW1A 1AA',
      lat: 51.5014,
      lng: -0.1419,
      radiusMiles: 3,
      fuelType: 'petrol',
      triggerType: 'price_drop',
      thresholdPpl: 2,
      enabled: true,
    },
  });

  await prisma.alertRule.upsert({
    where: { id: 'alert_test_002' },
    update: {},
    create: {
      id: 'alert_test_002',
      userId: proUser.id,
      centerPostcode: 'EC1A 1BB',
      lat: 51.5174,
      lng: -0.0933,
      radiusMiles: 5,
      fuelType: 'diesel',
      triggerType: 'price_drop',
      thresholdPpl: 3,
      enabled: true,
    },
  });

  console.log('✅ Created 2 alert rules for Pro user');

  // Create sample push token for Pro user
  console.log('📱 Creating sample push token...');
  
  await prisma.pushToken.upsert({
    where: { expoPushToken: 'ExponentPushToken[test_token_123]' },
    update: {},
    create: {
      userId: proUser.id,
      expoPushToken: 'ExponentPushToken[test_token_123]',
      platform: 'ios',
    },
  });

  console.log('✅ Created push token for Pro user');

  // Create sample ingestion run
  console.log('📊 Creating sample ingestion run...');
  
  await prisma.ingestionRun.create({
    data: {
      startedAt: new Date(now.getTime() - 45 * 60 * 1000), // 45 minutes ago
      finishedAt: new Date(now.getTime() - 40 * 60 * 1000), // 40 minutes ago
      status: 'success',
      counts: {
        stationsProcessed: stations.length,
        pricesUpdated: stations.length * 2,
        errors: 0,
      },
    },
  });

  console.log('✅ Created sample ingestion run');

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📝 Test accounts:');
  console.log(`   Free tier: free@test.fuelfuse.app (Clerk ID: user_test_free_123)`);
  console.log(`   Pro tier:  pro@test.fuelfuse.app (Clerk ID: user_test_pro_456)`);
  console.log(`\n⛽ Created ${stations.length} test stations in Westminster/Pimlico area`);
  console.log(`   Cheapest petrol: BP Pimlico (143.9p)`);
  console.log(`   Cheapest diesel: Tesco Extra Westminster (150.9p)`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
