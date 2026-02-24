# Vercel Cron Configuration Guide

This guide explains how to configure and manage Vercel Cron jobs for the FuelFuse MVP.

## Overview

FuelFuse uses two Vercel Cron jobs:

1. **Fuel Sync Job** - Fetches fuel price data from GOV.UK Fuel Finder API
2. **Alert Run Job** - Evaluates alert rules and sends push notifications

Both jobs are secured with the `CRON_SECRET` environment variable.

---

## Cron Job Endpoints

### 1. Fuel Sync Job

**Endpoint:** `POST /api/cron/fuel-sync`

**Purpose:** Ingests fuel price data from the GOV.UK Fuel Finder API into the database.

**Schedule:** Every 10-15 minutes

**What it does:**
- Authenticates with Fuel Finder API using OAuth2
- Fetches station and price data
- Upserts stations and prices into the database
- Records ingestion metadata in `ingestion_runs` table
- Handles errors and retries with exponential backoff

**Response:**
```json
{
  "status": "success" | "partial" | "failed",
  "stationsProcessed": 1234,
  "pricesUpdated": 1234,
  "errors": [],
  "startedAt": "2024-01-01T00:00:00.000Z",
  "finishedAt": "2024-01-01T00:05:00.000Z"
}
```

### 2. Alert Run Job

**Endpoint:** `POST /api/cron/alert-run`

**Purpose:** Evaluates all enabled alert rules and sends push notifications for price drops.

**Schedule:** Every 60 minutes

**What it does:**
- Fetches all enabled alert rules
- Evaluates each rule against current prices
- Checks 24-hour cooldown and daily rate limits
- Sends push notifications via Expo Push Service
- Updates `lastTriggeredAt` and `lastNotifiedPrice`
- Records alert run metadata in `alert_runs` table

**Response:**
```json
{
  "status": "success" | "failed",
  "startedAt": "2024-01-01T00:00:00.000Z",
  "finishedAt": "2024-01-01T00:01:00.000Z",
  "sentCount": 42,
  "evaluatedCount": 150,
  "errorSummary": []
}
```

---

## Configuration in Vercel

### Method 1: Using `vercel.json` (Recommended)

Create or update `vercel.json` in the root of your project:

```json
{
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

**Cron Schedule Syntax:**

The schedule uses standard cron syntax: `minute hour day month weekday`

Examples:
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour at minute 0
- `0 0 * * *` - Every day at midnight
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1` - Every Monday at 9:00 AM

**Fuel Sync Schedule Options:**
- `*/10 * * * *` - Every 10 minutes (more frequent updates)
- `*/15 * * * *` - Every 15 minutes (recommended)
- `*/30 * * * *` - Every 30 minutes (less frequent)

**Alert Run Schedule Options:**
- `0 * * * *` - Every hour (recommended)
- `*/30 * * * *` - Every 30 minutes (more frequent)
- `0 */2 * * *` - Every 2 hours (less frequent)

### Method 2: Using Vercel Dashboard

1. Go to your project in Vercel
2. Navigate to **Settings** → **Cron Jobs**
3. Click **Add Cron Job**
4. Configure each job:

**Fuel Sync Job:**
- **Path:** `/api/cron/fuel-sync`
- **Schedule:** `*/15 * * * *`
- **Description:** Fetch fuel price data from GOV.UK API

**Alert Run Job:**
- **Path:** `/api/cron/alert-run`
- **Schedule:** `0 * * * *`
- **Description:** Evaluate alert rules and send notifications

---

## Authentication

Both cron endpoints require authentication using the `x-cron-secret` header.

### Setting Up CRON_SECRET

1. Generate a secure random secret:
```bash
openssl rand -base64 32
```

2. Add to Vercel environment variables:
   - Go to **Settings** → **Environment Variables**
   - Add `CRON_SECRET` with your generated value
   - Select **Production**, **Preview**, and **Development**

3. Vercel automatically includes this header when calling cron endpoints

### Manual Testing

To test cron endpoints manually:

```bash
# Test fuel sync
curl -X POST https://your-app.vercel.app/api/cron/fuel-sync \
  -H "x-cron-secret: your-secret-here"

# Test alert run
curl -X POST https://your-app.vercel.app/api/cron/alert-run \
  -H "x-cron-secret: your-secret-here"
```

**Local Testing:**

```bash
# Test fuel sync locally
curl -X POST http://localhost:3000/api/cron/fuel-sync \
  -H "x-cron-secret: your-local-secret"

# Test alert run locally
curl -X POST http://localhost:3000/api/cron/alert-run \
  -H "x-cron-secret: your-local-secret"
```

---

## Monitoring Cron Jobs

### Vercel Dashboard

1. Go to your project in Vercel
2. Navigate to **Deployments** → Select a deployment
3. Click **Functions** tab
4. View cron job execution logs

### Database Monitoring

Check the `ingestion_runs` and `alert_runs` tables for job execution history:

```sql
-- Recent fuel sync runs
SELECT * FROM "IngestionRun"
ORDER BY "startedAt" DESC
LIMIT 10;

-- Recent alert runs
SELECT * FROM "AlertRun"
ORDER BY "startedAt" DESC
LIMIT 10;

-- Failed runs
SELECT * FROM "IngestionRun"
WHERE status = 'failed'
ORDER BY "startedAt" DESC;
```

### Sentry Monitoring

If Sentry is configured, errors from cron jobs will be automatically tracked:

1. Go to your Sentry project
2. Filter by:
   - **Transaction:** `/api/cron/fuel-sync` or `/api/cron/alert-run`
   - **Environment:** production

---

## Troubleshooting

### Cron job returns 401 Unauthorized

**Cause:** Missing or incorrect `CRON_SECRET`

**Solution:**
1. Verify `CRON_SECRET` is set in Vercel environment variables
2. Ensure the value matches what you're using for testing
3. Redeploy the application after adding the variable

### Fuel sync job fails with OAuth errors

**Cause:** Invalid or expired Fuel Finder API credentials

**Solution:**
1. Verify `FUEL_FINDER_CLIENT_ID` and `FUEL_FINDER_CLIENT_SECRET` are correct
2. Check if your API access has expired
3. Verify `FUEL_FINDER_API_URL` is correct
4. Check Vercel KV is configured (for token caching)

### Alert run job fails to send notifications

**Cause:** Invalid Expo access token or push tokens

**Solution:**
1. Verify `EXPO_ACCESS_TOKEN` is set correctly
2. Check that users have valid push tokens registered
3. Verify push tokens are not expired
4. Check Expo Push Service status

### Cron job times out

**Cause:** Job takes longer than Vercel's function timeout (10 seconds for Hobby, 60 seconds for Pro)

**Solution:**
1. Optimize database queries (add indexes)
2. Reduce batch sizes for processing
3. Upgrade to Vercel Pro for longer timeouts
4. Consider splitting large jobs into smaller chunks

### Cron job doesn't run at expected times

**Cause:** Cron schedule syntax error or timezone confusion

**Solution:**
1. Verify cron syntax using [crontab.guru](https://crontab.guru/)
2. Remember: Vercel cron runs in UTC timezone
3. Check Vercel dashboard for execution logs
4. Ensure `vercel.json` is in the project root

---

## Best Practices

### 1. Error Handling

Both cron endpoints implement comprehensive error handling:
- Catch and log all errors
- Record failed runs in database
- Return appropriate HTTP status codes
- Use structured error logging

### 2. Idempotency

Ensure cron jobs are idempotent:
- **Fuel Sync:** Uses unique constraints to prevent duplicate prices
- **Alert Run:** Checks `lastTriggeredAt` to prevent duplicate notifications

### 3. Rate Limiting

Respect external API rate limits:
- **Fuel Finder API:** Implements exponential backoff for 429 errors
- **Expo Push Service:** Batches notifications (up to 100 per request)

### 4. Monitoring

Set up monitoring for:
- Job execution frequency
- Success/failure rates
- Execution duration
- Error patterns

### 5. Alerting

Configure alerts for:
- Multiple consecutive failures
- Execution time exceeding threshold
- No executions in expected timeframe
- High error rates

---

## Scaling Considerations

### Increasing Frequency

If you need more frequent updates:

1. **Fuel Sync:** Can run as frequently as every 5 minutes, but:
   - Check Fuel Finder API rate limits
   - Monitor database load
   - Consider costs (Vercel function invocations)

2. **Alert Run:** Can run every 30 minutes, but:
   - Monitor Expo Push Service limits
   - Consider user experience (too many notifications)
   - Check database query performance

### Decreasing Frequency

If you need to reduce costs or load:

1. **Fuel Sync:** Can run every 30-60 minutes
   - Fuel prices don't change that frequently
   - Users may see slightly stale data

2. **Alert Run:** Can run every 2-4 hours
   - Alerts will be less timely
   - Reduces notification spam

---

## Alternative: Vercel Cron with Edge Functions

For better performance and lower costs, consider using Edge Functions:

```typescript
// apps/web/app/api/cron/fuel-sync/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Your cron logic here
}
```

**Benefits:**
- Faster cold starts
- Lower costs
- Global distribution

**Limitations:**
- Some Node.js APIs not available
- Smaller bundle size limits

---

## Resources

- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Cron Syntax Reference](https://crontab.guru/)
- [Vercel Function Limits](https://vercel.com/docs/functions/limits)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
