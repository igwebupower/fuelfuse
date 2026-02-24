# FuelFuse MVP - Deployment Guide

This guide covers deploying the FuelFuse MVP to production, including backend API deployment to Vercel and mobile app deployment via EAS Build.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Deployment (Vercel)](#backend-deployment-vercel)
3. [Database Setup (Neon)](#database-setup-neon)
4. [Environment Variables](#environment-variables)
5. [Database Migrations](#database-migrations)
6. [Cron Jobs Configuration](#cron-jobs-configuration)
7. [Mobile App Deployment (EAS)](#mobile-app-deployment-eas)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

Before deploying, ensure you have:

- [x] Vercel account (free tier works for development)
- [x] Neon account (or other PostgreSQL provider)
- [x] Clerk account with production application configured
- [x] Stripe account with production keys
- [x] Expo account with EAS access
- [x] GOV.UK Fuel Finder API credentials
- [x] All tests passing locally (`npm test`)
- [x] Git repository (GitHub, GitLab, or Bitbucket)

---

## Backend Deployment (Vercel)

### Initial Setup

1. **Install Vercel CLI** (optional but recommended):
```bash
npm install -g vercel
```

2. **Connect Repository to Vercel:**

**Option A: Using Vercel Dashboard**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your Git repository
4. Select the repository containing FuelFuse
5. Configure project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/web`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

**Option B: Using Vercel CLI**
```bash
cd apps/web
vercel
```
Follow the prompts to link your project.

3. **Configure Build Settings:**

In Vercel dashboard, go to **Settings** → **General**:
- **Framework Preset:** Next.js
- **Node.js Version:** 18.x
- **Root Directory:** `apps/web`

### Monorepo Configuration

Since FuelFuse is a monorepo, you need to configure Vercel to build from the correct directory.

Create `vercel.json` in the project root (if not exists):

```json
{
  "buildCommand": "cd apps/web && npm run build",
  "devCommand": "cd apps/web && npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": "apps/web/.next",
  "crons": [
    {
      "path": "/api/cron/fuel-sync",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/alert-run",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## Database Setup (Neon)

### Create Production Database

1. **Sign up at [Neon](https://neon.tech/)**

2. **Create a new project:**
   - Project name: `fuelfuse-production`
   - Region: Choose closest to your users (e.g., `us-east-2` for US, `eu-west-1` for Europe)
   - PostgreSQL version: 15 or later

3. **Enable PostGIS extension:**
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

You can run this in the Neon SQL Editor.

4. **Copy connection string:**
   - Go to **Dashboard** → **Connection Details**
   - Copy the connection string (it will look like):
   ```
   postgresql://user:password@ep-cool-name-123456.us-east-2.aws.neon.tech/fuelfuse?sslmode=require
   ```

5. **Configure connection pooling** (recommended):
   - Neon provides connection pooling automatically
   - Use the pooled connection string for production

### Alternative: Supabase

If using Supabase instead of Neon:

1. Create a new project at [Supabase](https://supabase.com/)
2. Go to **Settings** → **Database**
3. Copy the connection string (URI format)
4. Enable PostGIS:
   - Go to **SQL Editor**
   - Run: `CREATE EXTENSION IF NOT EXISTS postgis;`

---

## Environment Variables

### Set Production Environment Variables

In Vercel dashboard, go to **Settings** → **Environment Variables** and add:

#### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host/fuelfuse?sslmode=require"

# Clerk (Production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxxxx"
CLERK_SECRET_KEY="sk_live_xxxxx"

# Stripe (Production)
STRIPE_SECRET_KEY="sk_live_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
STRIPE_PRICE_ID="price_xxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_xxxxx"

# Fuel Finder API
FUEL_FINDER_CLIENT_ID="your-client-id"
FUEL_FINDER_CLIENT_SECRET="your-client-secret"
FUEL_FINDER_API_URL="https://api.example.gov.uk/fuel-finder"

# Cron Secret (generate with: openssl rand -base64 32)
CRON_SECRET="your-secure-random-string"

# Admin Secret (generate with: openssl rand -base64 32)
ADMIN_SECRET="your-admin-secret-string"

# Expo Push Notifications
EXPO_ACCESS_TOKEN="your-expo-token"

# Sentry (Optional but recommended)
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx@xxxxx.ingest.sentry.io/xxxxx"
```

#### Vercel KV (Caching)

1. In Vercel dashboard, go to **Storage**
2. Create a new **KV Database**
3. Connect it to your project
4. Vercel will automatically add these variables:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

### Environment Selection

For each variable, select which environments it applies to:
- ✅ **Production** - Live environment
- ✅ **Preview** - Pull request previews
- ⬜ **Development** - Local development (use local `.env` instead)

**Important:** Use different secrets for production and development!

---

## Database Migrations

### Run Migrations in Production

**Option 1: Using Vercel CLI (Recommended)**

```bash
# Set production database URL temporarily
export DATABASE_URL="your-production-database-url"

# Run migrations
cd apps/web
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**Option 2: Using Prisma Data Platform**

1. Sign up at [Prisma Data Platform](https://cloud.prisma.io/)
2. Connect your database
3. Run migrations through the dashboard

**Option 3: Manual SQL Execution**

If you prefer to run migrations manually:

1. Generate SQL from migrations:
```bash
cd apps/web
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migration.sql
```

2. Execute SQL in Neon SQL Editor or using `psql`:
```bash
psql "your-production-database-url" < migration.sql
```

### Migration Best Practices

1. **Always test migrations on a staging database first**
2. **Backup database before running migrations**
3. **Run migrations during low-traffic periods**
4. **Monitor for errors during migration**
5. **Have a rollback plan ready**

### Backup Database

Before running migrations:

```bash
# Using pg_dump
pg_dump "your-production-database-url" > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore if needed
psql "your-production-database-url" < backup-20240101-120000.sql
```

Neon also provides automatic backups - check your plan details.

---

## Cron Jobs Configuration

### Configure Vercel Cron

Cron jobs are configured in `vercel.json` (see Backend Deployment section).

After deployment, verify cron jobs are configured:

1. Go to Vercel dashboard → **Settings** → **Cron Jobs**
2. Verify both jobs are listed:
   - `/api/cron/fuel-sync` - Every 15 minutes
   - `/api/cron/alert-run` - Every hour

### Test Cron Endpoints

```bash
# Test fuel sync
curl -X POST https://your-app.vercel.app/api/cron/fuel-sync \
  -H "x-cron-secret: your-cron-secret"

# Test alert run
curl -X POST https://your-app.vercel.app/api/cron/alert-run \
  -H "x-cron-secret: your-cron-secret"
```

Expected response: `200 OK` with job execution details.

See [VERCEL_CRON.md](./VERCEL_CRON.md) for detailed cron configuration.

---

## Mobile App Deployment (EAS)

### Prerequisites

1. **Install EAS CLI:**
```bash
npm install -g eas-cli
```

2. **Login to Expo:**
```bash
eas login
```

3. **Configure EAS:**
```bash
cd apps/mobile
eas build:configure
```

### Update Mobile Environment Variables

Update `apps/mobile/.env` for production:

```bash
# Clerk (Production)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxxxx"

# Backend API (Production)
EXPO_PUBLIC_API_URL="https://your-app.vercel.app"

# Stripe (Production)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_xxxxx"

# Sentry (Optional)
EXPO_PUBLIC_SENTRY_DSN="https://xxxxx@xxxxx.ingest.sentry.io/xxxxx"
```

### Build for iOS

```bash
cd apps/mobile

# Production build
eas build --platform ios --profile production

# Or use npm script
npm run build:ios
```

This will:
1. Upload your code to EAS
2. Build the iOS app in the cloud
3. Provide a download link when complete

### Build for Android

```bash
cd apps/mobile

# Production build
eas build --platform android --profile production

# Or use npm script
npm run build:android
```

### Submit to App Stores

**iOS (App Store):**
```bash
eas submit --platform ios
```

You'll need:
- Apple Developer account ($99/year)
- App Store Connect credentials
- App icons and screenshots

**Android (Google Play):**
```bash
eas submit --platform android
```

You'll need:
- Google Play Developer account ($25 one-time)
- Signed APK or AAB
- App icons and screenshots

See [apps/mobile/SETUP.md](../apps/mobile/SETUP.md) for detailed mobile deployment instructions.

---

## Post-Deployment Verification

### Backend API Verification

1. **Check deployment status:**
   - Go to Vercel dashboard → **Deployments**
   - Verify latest deployment is successful

2. **Test API endpoints:**

```bash
# Health check (if implemented)
curl https://your-app.vercel.app/api/health

# Test search endpoint (requires authentication)
curl https://your-app.vercel.app/api/search/cheapest?postcode=SW1A1AA&radius=5&fuelType=petrol \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

3. **Verify cron jobs:**
   - Check Vercel dashboard → **Functions** → **Cron Jobs**
   - Verify jobs are running on schedule
   - Check database for recent `IngestionRun` and `AlertRun` records

4. **Check error tracking:**
   - Go to Sentry dashboard
   - Verify no critical errors
   - Check error rates

### Database Verification

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check for recent data
SELECT COUNT(*) FROM "Station";
SELECT COUNT(*) FROM "StationPriceLatest";

-- Check recent ingestion runs
SELECT * FROM "IngestionRun" 
ORDER BY "startedAt" DESC 
LIMIT 5;
```

### Mobile App Verification

1. **Download and install the app** from TestFlight (iOS) or internal testing (Android)

2. **Test core flows:**
   - Sign up / Login
   - Search for fuel stations
   - View station details
   - Save preferences
   - Create alert rule (Pro users)
   - Upgrade to Pro (test Stripe checkout)

3. **Test push notifications:**
   - Create an alert rule
   - Wait for alert job to run
   - Verify notification is received

---

## Rollback Procedures

### Backend Rollback

**Option 1: Vercel Dashboard**
1. Go to **Deployments**
2. Find the last known good deployment
3. Click **⋯** → **Promote to Production**

**Option 2: Vercel CLI**
```bash
vercel rollback
```

### Database Rollback

If a migration causes issues:

1. **Restore from backup:**
```bash
psql "your-production-database-url" < backup-20240101-120000.sql
```

2. **Revert migration:**
```bash
cd apps/web
npx prisma migrate resolve --rolled-back "migration-name"
```

### Mobile App Rollback

You cannot rollback mobile apps directly, but you can:

1. **Submit a hotfix build** with the previous version
2. **Use Expo Updates** (if configured) to push JavaScript-only fixes
3. **Communicate with users** about the issue and timeline

---

## Monitoring and Maintenance

### Set Up Monitoring

1. **Vercel Analytics:**
   - Enable in Vercel dashboard → **Analytics**
   - Monitor response times, error rates, traffic

2. **Sentry Alerts:**
   - Configure alerts for error spikes
   - Set up Slack/email notifications

3. **Database Monitoring:**
   - Monitor connection pool usage
   - Set up alerts for slow queries
   - Track database size growth

4. **Cron Job Monitoring:**
   - Check `IngestionRun` and `AlertRun` tables daily
   - Alert on consecutive failures
   - Monitor execution duration

### Regular Maintenance

- **Weekly:** Review error logs in Sentry
- **Weekly:** Check cron job success rates
- **Monthly:** Review database performance and optimize queries
- **Monthly:** Update dependencies (`npm update`)
- **Quarterly:** Rotate secrets (CRON_SECRET, ADMIN_SECRET)
- **Quarterly:** Review and optimize database indexes

---

## Troubleshooting

### Deployment fails with build errors

**Check:**
- All dependencies are in `package.json`
- TypeScript compiles locally (`npm run build`)
- Environment variables are set correctly
- Vercel build logs for specific errors

### Database connection errors

**Check:**
- `DATABASE_URL` is correct and includes `?sslmode=require`
- Database is accessible from Vercel (check firewall rules)
- Connection pool limits (Neon free tier has limits)
- Prisma Client is generated (`npx prisma generate`)

### Cron jobs not running

**Check:**
- `vercel.json` is in project root
- Cron syntax is correct (use [crontab.guru](https://crontab.guru/))
- `CRON_SECRET` is set in environment variables
- Function logs in Vercel dashboard

### Mobile app can't connect to API

**Check:**
- `EXPO_PUBLIC_API_URL` is set to production URL
- API is deployed and accessible
- CORS is configured correctly (Next.js handles this automatically)
- Clerk authentication is working

---

## Security Checklist

Before going live:

- [ ] All secrets are unique and randomly generated
- [ ] Production secrets differ from development
- [ ] `CRON_SECRET` and `ADMIN_SECRET` are set
- [ ] Database uses SSL (`?sslmode=require`)
- [ ] Stripe webhook signature verification is enabled
- [ ] Rate limiting is configured
- [ ] Sentry is configured for error tracking
- [ ] No sensitive data in logs
- [ ] CORS is properly configured
- [ ] All API endpoints require authentication where appropriate

---

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Production Checklist](./PRODUCTION_CHECKLIST.md)
