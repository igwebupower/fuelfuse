# Database Seed Script

This seed script populates the database with minimal test data for local development.

## Usage

### Basic Seeding

Run the seed script to populate the database with test data:

```bash
npm run db:seed
```

Or using Prisma directly:

```bash
npx prisma db seed
```

### Clear and Reseed

To clear existing data before seeding, set the `SEED_CLEAR` environment variable:

```bash
SEED_CLEAR=true npm run db:seed
```

## What Gets Seeded

### Test Users

1. **Free Tier User**
   - Email: `free@test.fuelfuse.app`
   - Clerk ID: `user_test_free_123`
   - Home Postcode: SW1A 1AA (Westminster)
   - Default Radius: 5 miles
   - Default Fuel Type: Petrol

2. **Pro Tier User**
   - Email: `pro@test.fuelfuse.app`
   - Clerk ID: `user_test_pro_456`
   - Home Postcode: EC1A 1BB (City of London)
   - Default Radius: 10 miles
   - Default Fuel Type: Diesel
   - Has 2 active alert rules
   - Has 1 registered push token

### Test Stations

5 fuel stations in the Westminster/Pimlico area of London:

| Station | Brand | Postcode | Petrol (ppl) | Diesel (ppl) |
|---------|-------|----------|--------------|--------------|
| Shell Westminster | Shell | SW1E 5ND | 145.9 | 152.9 |
| BP Pimlico | BP | SW1V 2SA | **143.9** (cheapest) | 151.9 |
| Tesco Extra Westminster | Tesco | SW1P 2EE | 144.9 | **150.9** (cheapest) |
| Esso Belgravia | Esso | SW1W 0LU | 146.9 | 153.9 |
| Sainsburys Pimlico | Sainsburys | SW1V 3EN | 145.4 | 152.4 |

All stations include:
- Realistic amenities (car wash, shop, ATM, air pump)
- Opening hours (Monday-Sunday)
- Price history entries
- Coordinates for geospatial queries

### Geocoding Cache

4 postcode entries cached for quick lookups:
- SW1A 1AA (Westminster)
- EC1A 1BB (City of London)
- SW1E 5ND (Victoria)
- SW1V 2SA (Pimlico)

### Alert Rules

2 alert rules for the Pro user:
1. Petrol alerts in Westminster (3 mile radius, 2p threshold)
2. Diesel alerts in City of London (5 mile radius, 3p threshold)

### Other Data

- 1 sample push token (iOS) for the Pro user
- 1 sample ingestion run record (successful)

## Testing Search Functionality

After seeding, you can test the search API:

### Search by Postcode

```bash
# Search for cheapest petrol near Westminster
curl "http://localhost:3000/api/search/cheapest?postcode=SW1A%201AA&radiusMiles=3&fuelType=petrol"

# Expected: BP Pimlico (143.9p) should be first
```

### Search by Coordinates

```bash
# Search near Westminster coordinates
curl "http://localhost:3000/api/search/cheapest?lat=51.5014&lng=-0.1419&radiusMiles=3&fuelType=diesel"

# Expected: Tesco Extra Westminster (150.9p) should be first
```

## Idempotency

The seed script is idempotent - you can run it multiple times without errors. It uses `upsert` operations to create or update records based on unique identifiers.

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (required)
- `SEED_CLEAR`: Set to `true` to clear existing data before seeding (optional)

## Notes

- All prices are stored in pence per litre (ppl)
- Timestamps are set to realistic values (30-45 minutes ago)
- Station IDs use the format `station_001`, `station_002`, etc.
- The Pro user's subscription is set to expire 30 days from the seed date
