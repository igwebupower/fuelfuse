# FuelFuse MVP

A UK fuel-price mobile application that helps users find the cheapest petrol and diesel nearby and receive push alerts when prices drop.

## Project Structure

This is a monorepo containing:

- `apps/web` - Next.js 14 backend API
- `apps/mobile` - React Native (Expo) mobile app
- `packages/shared` - Shared TypeScript types and Zod schemas

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon recommended for production)
- Clerk account for authentication
- Stripe account for payments
- Expo account for push notifications
- Vercel account for backend deployment
- GOV.UK Fuel Finder API credentials

## Quick Start (Local Development)

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

Add all required environment variables to `apps/web/.env` and `apps/mobile/.env`.

See the **Environment Variables** section below for complete documentation.

### 6. Seed Development Data (Optional)

```bash
cd apps/web
npm run seed
```

This will populate the database with sample station data for testing. See `apps/web/prisma/SEED_README.md` for details.

### 7. Run Development Servers

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

See the Prisma schema at `apps/web/prisma/schema.prisma` for complete details.

## Key Features

- **Search**: Find cheapest fuel stations by postcode or coordinates
- **Alerts**: Receive push notifications when prices drop (Pro tier)
- **Subscriptions**: Free and Pro tiers with Stripe integration
- **Data Ingestion**: Automated fuel price updates from GOV.UK Fuel Finder API
- **Geocoding**: Efficient postcode-to-coordinates conversion with caching
- **Rate Limiting**: API rate limiting using Vercel KV
- **Error Tracking**: Sentry integration for error monitoring

## Documentation

- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment instructions
- [Environment Variables](./docs/ENVIRONMENT_VARIABLES.md) - Complete environment variable documentation
- [Vercel Cron Setup](./docs/VERCEL_CRON.md) - Cron job configuration guide
- [Production Checklist](./docs/PRODUCTION_CHECKLIST.md) - Pre and post-deployment checklist
- [Mobile Setup](./apps/mobile/SETUP.md) - Mobile app setup and build instructions
- [Mobile Auth Setup](./apps/mobile/AUTH_SETUP.md) - Authentication configuration
- [Mobile Notifications](./apps/mobile/NOTIFICATIONS_SETUP.md) - Push notification setup
- [Error Handling (Web)](./apps/web/ERROR_HANDLING.md) - Backend error handling strategy
- [Error Handling (Mobile)](./apps/mobile/ERROR_HANDLING.md) - Mobile error handling strategy
- [Database Seeding](./apps/web/prisma/SEED_README.md) - Development data seeding

## Contributing

This is a private project. For development:

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass (`npm test`)
4. Create a pull request

## Testing

Run all tests:

```bash
npm test
```

Run tests for specific workspace:

```bash
npm test --workspace=apps/web
```

Run tests in watch mode:

```bash
npm run test:watch --workspace=apps/web
```

## Environment Variables

### Backend API (`apps/web/.env`)

See [ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md) for complete documentation of all environment variables, including:
- How to obtain API keys and secrets
- Required vs optional variables
- Development vs production values
- Security considerations

### Mobile App (`apps/mobile/.env`)

See [apps/mobile/SETUP.md](./apps/mobile/SETUP.md) for mobile-specific environment configuration.

## Deployment

### Backend API (Vercel)

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for complete deployment instructions, including:
- Vercel deployment setup
- Database migration strategy
- Cron job configuration
- Environment variable configuration
- Production checklist

### Mobile App (EAS Build)

See [apps/mobile/SETUP.md](./apps/mobile/SETUP.md) for mobile app build and deployment instructions.

## Architecture

### High-Level Overview

```
┌─────────────────┐
│  Mobile Client  │
│  (React Native) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│   Next.js API   │◄─────┤  Vercel Cron     │
│  (Vercel)       │      │  - Fuel Sync     │
└────────┬────────┘      │  - Alert Run     │
         │               └──────────────────┘
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   (Neon)        │
└─────────────────┘

External Services:
- Clerk (Authentication)
- Stripe (Payments)
- Expo Push (Notifications)
- GOV.UK Fuel Finder API (Data Source)
- postcodes.io (Geocoding)
```

### Technology Stack

**Mobile Application:**
- React Native with Expo (TypeScript)
- Expo Router for navigation
- expo-notifications for push notifications
- expo-web-browser for Stripe checkout
- Clerk Expo SDK for authentication
- Axios for API requests

**Backend API:**
- Next.js 14 App Router (TypeScript)
- Prisma ORM for database access
- Zod for validation
- Vercel deployment
- Vercel KV for caching

**Database:**
- PostgreSQL (Neon recommended)
- PostGIS extension for geospatial queries
- Prisma migrations

**Jobs:**
- Vercel Cron for scheduled tasks
- OAuth2 client for Fuel Finder API
- Expo Push API for notifications

**External Services:**
- Clerk for authentication
- Stripe Checkout for payments
- Expo Push Service for notifications
- postcodes.io for geocoding
- GOV.UK Fuel Finder API for fuel price data

## License

Private - All rights reserved
