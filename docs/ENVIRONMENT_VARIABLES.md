# Environment Variables Documentation

This document provides complete documentation for all environment variables used in the FuelFuse MVP.

## Backend API (`apps/web/.env`)

### Database

#### `DATABASE_URL` (Required)
PostgreSQL connection string for the main database.

**Format:**
```
DATABASE_URL="postgresql://username:password@host:port/database?schema=public"
```

**Development Example:**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fuelfuse_dev?schema=public"
```

**Production Example (Neon):**
```
DATABASE_URL="postgresql://user:password@ep-cool-name-123456.us-east-2.aws.neon.tech/fuelfuse?sslmode=require"
```

**How to obtain:**
- **Local Development**: Use Docker or local PostgreSQL installation
- **Production**: Create a database on [Neon](https://neon.tech/), [Supabase](https://supabase.com/), or [Railway](https://railway.app/)
- Neon provides a free tier with PostgreSQL + PostGIS support

**Security Notes:**
- Never commit this value to version control
- Use connection pooling in production (Neon provides this automatically)
- Ensure SSL is enabled for production databases

---

### Authentication (Clerk)

#### `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Required)
Clerk publishable key for client-side authentication.

**Format:**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
1. Sign up at [Clerk](https://clerk.com/)
2. Create a new application
3. Go to **API Keys** in the dashboard
4. Copy the **Publishable Key**

**Note:** Use `pk_test_` for development and `pk_live_` for production.

#### `CLERK_SECRET_KEY` (Required)
Clerk secret key for server-side authentication.

**Format:**
```
CLERK_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
1. In Clerk dashboard, go to **API Keys**
2. Copy the **Secret Key**

**Security Notes:**
- Never expose this key to the client
- Use `sk_test_` for development and `sk_live_` for production
- Rotate this key if compromised

---

### Payments (Stripe)

#### `STRIPE_SECRET_KEY` (Required)
Stripe secret key for server-side payment operations.

**Format:**
```
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
1. Sign up at [Stripe](https://stripe.com/)
2. Go to **Developers** → **API Keys**
3. Copy the **Secret Key**

**Note:** Use `sk_test_` for development and `sk_live_` for production.

#### `STRIPE_WEBHOOK_SECRET` (Required)
Stripe webhook signing secret for verifying webhook events.

**Format:**
```
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
1. In Stripe dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Signing secret**

**Development:**
For local testing, use Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
This will provide a temporary webhook secret.

#### `STRIPE_PRICE_ID` (Required)
Stripe Price ID for the Pro subscription plan.

**Format:**
```
STRIPE_PRICE_ID="price_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
1. In Stripe dashboard, go to **Products**
2. Create a new product (e.g., "FuelFuse Pro")
3. Add a price (e.g., £4.99/month)
4. Copy the **Price ID** (starts with `price_`)

#### `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Required)
Stripe publishable key for client-side operations.

**Format:**
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
1. In Stripe dashboard, go to **Developers** → **API Keys**
2. Copy the **Publishable Key**

---

### Fuel Finder API

#### `FUEL_FINDER_CLIENT_ID` (Required)
OAuth2 client ID for GOV.UK Fuel Finder API.

**Format:**
```
FUEL_FINDER_CLIENT_ID="your-client-id"
```

**How to obtain:**
1. Register for API access at [GOV.UK Fuel Finder API](https://www.gov.uk/guidance/access-the-price-of-fuel-at-service-stations-api)
2. Follow the registration process
3. Receive client credentials via email

**Note:** This is a real government API. Ensure you comply with their terms of service.

#### `FUEL_FINDER_CLIENT_SECRET` (Required)
OAuth2 client secret for GOV.UK Fuel Finder API.

**Format:**
```
FUEL_FINDER_CLIENT_SECRET="your-client-secret"
```

**How to obtain:**
Provided along with the client ID during API registration.

**Security Notes:**
- Never expose this secret to the client
- Store securely in environment variables
- Rotate if compromised

#### `FUEL_FINDER_API_URL` (Required)
Base URL for the Fuel Finder API.

**Format:**
```
FUEL_FINDER_API_URL="https://api.example.gov.uk/fuel-finder"
```

**How to obtain:**
Provided in the API documentation when you register.

---

### Cron Authentication

#### `CRON_SECRET` (Required)
Secret token for authenticating cron job requests.

**Format:**
```
CRON_SECRET="your-random-secret-string"
```

**How to generate:**
```bash
# Generate a secure random string
openssl rand -base64 32
```

**Usage:**
This secret is used to authenticate requests to:
- `/api/cron/fuel-sync`
- `/api/cron/alert-run`

Vercel Cron jobs will send this in the `x-cron-secret` header.

**Security Notes:**
- Use a long, random string (at least 32 characters)
- Never commit to version control
- Rotate periodically

---

### Admin Authentication

#### `ADMIN_SECRET` (Required)
Secret token for authenticating admin-only endpoints.

**Format:**
```
ADMIN_SECRET="your-admin-secret-string"
```

**How to generate:**
```bash
# Generate a secure random string
openssl rand -base64 32
```

**Usage:**
Used to authenticate requests to:
- `/api/admin/ingest-csv` (CSV fallback ingestion)

**Security Notes:**
- Use a different secret than `CRON_SECRET`
- Share only with authorized administrators
- Rotate if compromised

---

### Caching (Vercel KV)

#### `KV_URL` (Required for production)
Vercel KV connection URL.

**Format:**
```
KV_URL="redis://default:xxxxx@xxxxx.kv.vercel-storage.com:xxxxx"
```

**How to obtain:**
1. In Vercel dashboard, go to **Storage**
2. Create a new **KV Database**
3. Connect it to your project
4. Vercel will automatically add these environment variables

#### `KV_REST_API_URL` (Required for production)
Vercel KV REST API URL.

**Format:**
```
KV_REST_API_URL="https://xxxxx.kv.vercel-storage.com"
```

**How to obtain:**
Automatically provided when you create a Vercel KV database.

#### `KV_REST_API_TOKEN` (Required for production)
Vercel KV REST API token for read/write operations.

**Format:**
```
KV_REST_API_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
Automatically provided when you create a Vercel KV database.

#### `KV_REST_API_READ_ONLY_TOKEN` (Optional)
Vercel KV REST API token for read-only operations.

**Format:**
```
KV_REST_API_READ_ONLY_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
Automatically provided when you create a Vercel KV database.

**Note:** For local development, the app will work without KV (caching will be disabled).

---

### Push Notifications (Expo)

#### `EXPO_ACCESS_TOKEN` (Required)
Expo access token for sending push notifications.

**Format:**
```
EXPO_ACCESS_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
1. Sign up at [Expo](https://expo.dev/)
2. Go to **Account Settings** → **Access Tokens**
3. Create a new token with push notification permissions
4. Copy the token

**Security Notes:**
- Never expose this token to the client
- Use a token with minimal required permissions
- Rotate if compromised

---

### Error Tracking (Sentry)

#### `NEXT_PUBLIC_SENTRY_DSN` (Optional but recommended)
Sentry DSN for error tracking and monitoring.

**Format:**
```
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx@xxxxx.ingest.sentry.io/xxxxx"
```

**How to obtain:**
1. Sign up at [Sentry](https://sentry.io/)
2. Create a new project (Next.js)
3. Copy the **DSN** from the project settings

**Note:** This is optional for development but highly recommended for production.

---

## Mobile App (`apps/mobile/.env`)

### Authentication (Clerk)

#### `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (Required)
Clerk publishable key for mobile authentication.

**Format:**
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
Same as backend - use the same Clerk application and publishable key.

---

### Backend API

#### `EXPO_PUBLIC_API_URL` (Required)
Base URL for the backend API.

**Development:**
```
EXPO_PUBLIC_API_URL="http://localhost:3000"
```

**Production:**
```
EXPO_PUBLIC_API_URL="https://your-app.vercel.app"
```

**Note:** For testing on physical devices, use your computer's local IP:
```
EXPO_PUBLIC_API_URL="http://192.168.1.100:3000"
```

---

### Payments (Stripe)

#### `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Required)
Stripe publishable key for mobile checkout.

**Format:**
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**How to obtain:**
Same as backend - use the same Stripe publishable key.

---

### Error Tracking (Sentry)

#### `EXPO_PUBLIC_SENTRY_DSN` (Optional but recommended)
Sentry DSN for mobile error tracking.

**Format:**
```
EXPO_PUBLIC_SENTRY_DSN="https://xxxxx@xxxxx.ingest.sentry.io/xxxxx"
```

**How to obtain:**
1. In Sentry, create a separate project for React Native
2. Copy the DSN

**Note:** Use a separate Sentry project for mobile to distinguish between backend and mobile errors.

---

## Environment-Specific Configuration

### Development

For local development, create `.env` files:

```bash
# Backend
cd apps/web
cp .env.example .env
# Edit .env with your development values

# Mobile
cd apps/mobile
cp .env.example .env
# Edit .env with your development values
```

### Production (Vercel)

Set environment variables in Vercel dashboard:

1. Go to your project in Vercel
2. Navigate to **Settings** → **Environment Variables**
3. Add all required variables
4. Select **Production**, **Preview**, and **Development** as needed

**Important:** Some variables (like `DATABASE_URL`) should differ between environments.

---

## Security Best Practices

1. **Never commit `.env` files** - They are in `.gitignore` for a reason
2. **Use different secrets for development and production**
3. **Rotate secrets periodically** - Especially after team member changes
4. **Use environment-specific values** - Don't use production credentials in development
5. **Limit access** - Only share secrets with team members who need them
6. **Use secret management tools** - Consider using Vercel's secret management or tools like 1Password
7. **Monitor for leaks** - Use tools like GitGuardian to detect accidentally committed secrets

---

## Troubleshooting

### "Missing environment variable" errors

Ensure all required variables are set in your `.env` file and that you've restarted your development server after adding them.

### Vercel deployment fails with environment variable errors

Check that all required variables are set in Vercel dashboard under **Settings** → **Environment Variables**.

### Mobile app can't connect to backend

Ensure `EXPO_PUBLIC_API_URL` is set correctly:
- For iOS Simulator: `http://localhost:3000`
- For Android Emulator: `http://10.0.2.2:3000`
- For physical devices: `http://YOUR_LOCAL_IP:3000`

### Cron jobs not authenticating

Verify that `CRON_SECRET` is set in Vercel environment variables and matches the value configured in your cron job settings.
