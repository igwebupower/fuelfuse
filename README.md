# FuelFuse MVP

A UK fuel-price mobile application that helps users find the cheapest petrol and diesel nearby and receive push alerts when prices drop.

## Project Structure

This is a monorepo containing:

- `apps/web` - Next.js 14 backend API
- `apps/mobile` - React Native (Expo) mobile app
- `packages/shared` - Shared TypeScript types and Zod schemas

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon recommended)
- Clerk account for authentication
- Stripe account for payments
- Expo account for push notifications

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

Create a PostgreSQL database and set up the connection:

```bash
cd apps/web
cp .env.example .env
```

Edit `.env` and add your `DATABASE_URL`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/fuelfuse?schema=public"
```

**For Testing:**
You'll also need a test database. You can either:
- Use the same database (data will be cleaned between tests)
- Create a separate test database: `fuelfuse_test`
- Use a cloud PostgreSQL instance (Neon, Supabase, etc.)

**Quick Setup with Docker:**
```bash
docker run --name fuelfuse-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fuelfuse_dev -p 5432:5432 -d postgres:15
```

Then update your `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fuelfuse_dev?schema=public"
```

### 3. Run Prisma Migrations

```bash
cd apps/web
npx prisma migrate dev --name init
```

This will:
- Create all database tables
- Generate the Prisma Client
- Apply all indexes and constraints

### 4. Generate Prisma Client

```bash
cd apps/web
npx prisma generate
```

### 5. Configure Environment Variables

Add all required environment variables to `apps/web/.env`:

- Clerk authentication keys
- Stripe API keys
- Fuel Finder API credentials
- Cron secret
- Vercel KV credentials
- Expo access token

See `.env.example` for the complete list.

### 6. Run Development Servers

**Backend API:**
```bash
npm run dev:web
```

**Mobile App:**
```bash
npm run dev:mobile
```

## Database Schema

The database includes the following tables:

- `User` - User accounts with Clerk integration
- `Subscription` - Stripe subscription management
- `UserPreferences` - User settings (home postcode, default radius, fuel type)
- `PushToken` - Expo push notification tokens
- `AlertRule` - User-defined price alert rules
- `Station` - Fuel station information
- `StationPriceLatest` - Current fuel prices
- `StationPriceHistory` - Historical price data with duplicate prevention
- `PostcodeGeoCache` - Cached postcode geocoding results
- `IngestionRun` - Data ingestion job tracking
- `AlertRun` - Alert job execution tracking

## Testing

Run all tests:

```bash
npm test
```

Run tests for specific workspace:

```bash
npm test --workspace=apps/web
```

## Key Features

- **Search**: Find cheapest fuel stations by postcode or coordinates
- **Alerts**: Receive push notifications when prices drop (Pro tier)
- **Subscriptions**: Free and Pro tiers with Stripe integration
- **Data Ingestion**: Automated fuel price updates from GOV.UK Fuel Finder API
- **Geocoding**: Efficient postcode-to-coordinates conversion with caching

## Architecture

- **Frontend**: React Native with Expo
- **Backend**: Next.js 14 App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **Payments**: Stripe Checkout
- **Push Notifications**: Expo Push Service
- **Deployment**: Vercel (backend), EAS (mobile)

## License

Private - All rights reserved
