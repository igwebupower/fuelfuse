# Production Checklist

Use this checklist before and after deploying FuelFuse MVP to production.

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests pass locally (`npm test`)
- [ ] No TypeScript errors (`npm run build`)
- [ ] Code has been reviewed (if working in a team)
- [ ] No console.log statements in production code
- [ ] No commented-out code blocks
- [ ] All TODO comments addressed or documented

### Database

- [ ] Prisma schema is up to date
- [ ] All migrations have been tested on staging database
- [ ] Database backup created before migration
- [ ] Indexes are properly configured for performance
- [ ] Database connection string uses SSL (`?sslmode=require`)
- [ ] Connection pooling is enabled (Neon provides this automatically)

### Environment Variables

#### Backend (Vercel)

- [ ] `DATABASE_URL` - Production database connection string
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Production Clerk key (pk_live_)
- [ ] `CLERK_SECRET_KEY` - Production Clerk secret (sk_live_)
- [ ] `STRIPE_SECRET_KEY` - Production Stripe key (sk_live_)
- [ ] `STRIPE_WEBHOOK_SECRET` - Production webhook secret (whsec_)
- [ ] `STRIPE_PRICE_ID` - Production price ID (price_)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Production Stripe key (pk_live_)
- [ ] `FUEL_FINDER_CLIENT_ID` - GOV.UK API client ID
- [ ] `FUEL_FINDER_CLIENT_SECRET` - GOV.UK API client secret
- [ ] `FUEL_FINDER_API_URL` - GOV.UK API base URL
- [ ] `CRON_SECRET` - Secure random string (32+ characters)
- [ ] `ADMIN_SECRET` - Secure random string (different from CRON_SECRET)
- [ ] `KV_URL` - Vercel KV connection URL
- [ ] `KV_REST_API_URL` - Vercel KV REST API URL
- [ ] `KV_REST_API_TOKEN` - Vercel KV token
- [ ] `KV_REST_API_READ_ONLY_TOKEN` - Vercel KV read-only token
- [ ] `EXPO_ACCESS_TOKEN` - Expo push notification token
- [ ] `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN (optional but recommended)

#### Mobile (EAS)

- [ ] `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` - Production Clerk key (pk_live_)
- [ ] `EXPO_PUBLIC_API_URL` - Production API URL (https://your-app.vercel.app)
- [ ] `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Production Stripe key (pk_live_)
- [ ] `EXPO_PUBLIC_SENTRY_DSN` - Sentry DSN for mobile (optional)

### Security

- [ ] All secrets are randomly generated (use `openssl rand -base64 32`)
- [ ] Production secrets differ from development secrets
- [ ] No secrets committed to version control
- [ ] `.env` files are in `.gitignore`
- [ ] Webhook signature verification is enabled (Stripe)
- [ ] Cron endpoints require authentication (`x-cron-secret` header)
- [ ] Admin endpoints require authentication (`x-admin-secret` header)
- [ ] Rate limiting is configured for public endpoints
- [ ] CORS is properly configured (Next.js handles this automatically)

### External Services

#### Clerk

- [ ] Production application created
- [ ] Email verification enabled
- [ ] Social login providers configured (if using)
- [ ] Webhook endpoints configured (if needed)
- [ ] Production keys obtained (pk_live_ and sk_live_)

#### Stripe

- [ ] Production account activated
- [ ] Business details completed
- [ ] Bank account connected
- [ ] Product created ("FuelFuse Pro")
- [ ] Price created (e.g., £4.99/month)
- [ ] Webhook endpoint configured: `https://your-app.vercel.app/api/stripe/webhook`
- [ ] Webhook events selected:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- [ ] Webhook signing secret obtained
- [ ] Test mode disabled for production

#### Expo

- [ ] Expo account created
- [ ] EAS project configured
- [ ] Push notification credentials configured
- [ ] Access token generated with push permissions
- [ ] App icons and splash screens added

#### GOV.UK Fuel Finder API

- [ ] API access approved
- [ ] Client credentials obtained
- [ ] API rate limits understood
- [ ] Terms of service reviewed and accepted

#### Neon (or PostgreSQL provider)

- [ ] Production database created
- [ ] PostGIS extension enabled
- [ ] Connection string obtained
- [ ] Backups configured
- [ ] Monitoring enabled

#### Sentry (Optional but Recommended)

- [ ] Projects created (one for backend, one for mobile)
- [ ] DSN obtained for each project
- [ ] Error alerts configured
- [ ] Team members invited

### Vercel Configuration

- [ ] Project connected to Git repository
- [ ] Build settings configured (Root: `apps/web`)
- [ ] Environment variables set for Production
- [ ] Vercel KV database created and connected
- [ ] Cron jobs configured in `vercel.json`:
  - Fuel sync: `*/15 * * * *` (every 15 minutes)
  - Alert run: `0 * * * *` (every hour)
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active

### Testing

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All property-based tests pass
- [ ] Manual testing completed on staging environment
- [ ] Search functionality tested
- [ ] Alert creation and notification tested
- [ ] Stripe checkout flow tested (use test mode first)
- [ ] Mobile app tested on iOS and Android
- [ ] Push notifications tested on physical devices

### Documentation

- [ ] README.md is up to date
- [ ] Environment variables documented
- [ ] Deployment guide reviewed
- [ ] API endpoints documented (if applicable)
- [ ] Runbook created for common issues

---

## Deployment Steps

### 1. Backend Deployment

- [ ] Push code to main branch
- [ ] Vercel automatically deploys
- [ ] Monitor deployment in Vercel dashboard
- [ ] Check deployment logs for errors
- [ ] Verify deployment is successful

### 2. Database Migration

- [ ] Backup production database
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Verify migrations completed successfully
- [ ] Check database schema matches expected state

### 3. Cron Jobs

- [ ] Verify cron jobs are configured in Vercel
- [ ] Test fuel sync endpoint manually
- [ ] Test alert run endpoint manually
- [ ] Monitor first automatic execution

### 4. Mobile App Deployment

- [ ] Build iOS app: `eas build --platform ios --profile production`
- [ ] Build Android app: `eas build --platform android --profile production`
- [ ] Download and test builds
- [ ] Submit to App Store (iOS)
- [ ] Submit to Google Play (Android)

---

## Post-Deployment Verification

### Backend API

- [ ] API is accessible at production URL
- [ ] Health check endpoint responds (if implemented)
- [ ] Search endpoint returns results
- [ ] Authentication works (Clerk)
- [ ] Stripe checkout creates sessions
- [ ] Webhook endpoint receives Stripe events
- [ ] No errors in Vercel function logs
- [ ] No errors in Sentry

### Database

- [ ] Database is accessible
- [ ] Tables exist and have correct schema
- [ ] Indexes are created
- [ ] Sample queries execute successfully
- [ ] Connection pooling is working

### Cron Jobs

- [ ] Fuel sync job runs on schedule
- [ ] Alert run job runs on schedule
- [ ] Check `IngestionRun` table for recent successful runs
- [ ] Check `AlertRun` table for recent successful runs
- [ ] Verify fuel price data is being updated
- [ ] Verify alerts are being sent (if any rules exist)

### Mobile App

- [ ] App installs successfully
- [ ] Login/signup works
- [ ] Search returns results
- [ ] Station details display correctly
- [ ] Preferences save successfully
- [ ] Stripe checkout opens in browser
- [ ] Push notifications are received
- [ ] Alert rules can be created (Pro users)
- [ ] No crashes or errors

### Monitoring

- [ ] Vercel Analytics is collecting data
- [ ] Sentry is receiving error reports
- [ ] Database monitoring is active
- [ ] Cron job monitoring is active
- [ ] Set up alerts for:
  - High error rates
  - Failed cron jobs
  - Database connection issues
  - Slow API responses

---

## First 24 Hours Monitoring

### Hour 1

- [ ] Check Vercel deployment status
- [ ] Verify no critical errors in Sentry
- [ ] Check first cron job executions
- [ ] Monitor database connections
- [ ] Test core user flows manually

### Hour 6

- [ ] Review error logs in Sentry
- [ ] Check cron job success rates
- [ ] Verify fuel price data is updating
- [ ] Monitor API response times
- [ ] Check database performance

### Hour 24

- [ ] Review all error logs
- [ ] Analyze cron job execution patterns
- [ ] Check database size and growth
- [ ] Review API usage patterns
- [ ] Verify push notifications are working
- [ ] Check Stripe webhook events
- [ ] Monitor user signups and activity

---

## Common Issues and Solutions

### Issue: Cron jobs not running

**Check:**
- [ ] `vercel.json` is in project root
- [ ] Cron syntax is correct
- [ ] `CRON_SECRET` is set in Vercel environment variables
- [ ] Function logs in Vercel dashboard

**Solution:**
- Verify cron configuration in Vercel dashboard
- Test endpoints manually with correct secret
- Check function execution logs

### Issue: Database connection errors

**Check:**
- [ ] `DATABASE_URL` is correct
- [ ] Database is accessible from Vercel
- [ ] SSL is enabled (`?sslmode=require`)
- [ ] Connection pool limits

**Solution:**
- Verify connection string format
- Check database firewall rules
- Increase connection pool size if needed
- Use Neon's pooled connection string

### Issue: Stripe webhooks not working

**Check:**
- [ ] Webhook endpoint is configured in Stripe
- [ ] `STRIPE_WEBHOOK_SECRET` is correct
- [ ] Webhook events are selected
- [ ] Endpoint is accessible

**Solution:**
- Test webhook endpoint manually
- Check Stripe webhook logs
- Verify signature verification logic
- Ensure endpoint returns 200 OK

### Issue: Push notifications not received

**Check:**
- [ ] `EXPO_ACCESS_TOKEN` is set
- [ ] Push tokens are registered
- [ ] Alert rules are enabled
- [ ] Alert job is running

**Solution:**
- Verify Expo access token permissions
- Check push token registration
- Test push notification manually
- Check Expo Push Service status

### Issue: Mobile app can't connect to API

**Check:**
- [ ] `EXPO_PUBLIC_API_URL` is correct
- [ ] API is deployed and accessible
- [ ] Clerk authentication is working
- [ ] Network connectivity

**Solution:**
- Verify API URL in mobile app
- Test API endpoints directly
- Check Clerk configuration
- Review network logs

---

## Rollback Plan

If critical issues are discovered:

### Backend Rollback

1. [ ] Go to Vercel dashboard → Deployments
2. [ ] Find last known good deployment
3. [ ] Click **⋯** → **Promote to Production**
4. [ ] Verify rollback is successful
5. [ ] Communicate with users about the issue

### Database Rollback

1. [ ] Stop all cron jobs temporarily
2. [ ] Restore from backup: `psql "DATABASE_URL" < backup.sql`
3. [ ] Verify data integrity
4. [ ] Restart cron jobs
5. [ ] Monitor for issues

### Mobile App

1. [ ] Submit hotfix build with previous version
2. [ ] Expedite app store review (if possible)
3. [ ] Communicate with users via in-app message or email
4. [ ] Monitor crash reports

---

## Ongoing Maintenance

### Daily

- [ ] Check Sentry for new errors
- [ ] Verify cron jobs are running
- [ ] Monitor API response times

### Weekly

- [ ] Review error trends in Sentry
- [ ] Check cron job success rates
- [ ] Review database performance
- [ ] Check API usage patterns
- [ ] Monitor user feedback

### Monthly

- [ ] Update dependencies (`npm update`)
- [ ] Review and optimize database queries
- [ ] Check database size and growth
- [ ] Review and update documentation
- [ ] Analyze user behavior and usage patterns

### Quarterly

- [ ] Rotate secrets (CRON_SECRET, ADMIN_SECRET)
- [ ] Review security practices
- [ ] Update external service credentials
- [ ] Performance audit and optimization
- [ ] Review and update monitoring alerts

---

## Emergency Contacts

Document key contacts for production issues:

- **Vercel Support:** [vercel.com/support](https://vercel.com/support)
- **Neon Support:** [neon.tech/docs/introduction/support](https://neon.tech/docs/introduction/support)
- **Clerk Support:** [clerk.com/support](https://clerk.com/support)
- **Stripe Support:** [support.stripe.com](https://support.stripe.com/)
- **Expo Support:** [expo.dev/support](https://expo.dev/support)
- **Team Lead:** [Your contact info]
- **On-Call Engineer:** [Your contact info]

---

## Success Criteria

Deployment is considered successful when:

- [ ] All services are running without errors
- [ ] Cron jobs execute successfully on schedule
- [ ] Users can sign up, login, and search for fuel stations
- [ ] Pro users can create alerts and receive notifications
- [ ] Stripe payments process successfully
- [ ] No critical errors in Sentry
- [ ] API response times are acceptable (<500ms for most endpoints)
- [ ] Mobile app is stable with no crashes
- [ ] Database performance is good
- [ ] All monitoring and alerting is active

---

## Notes

Use this section to document any deployment-specific notes, issues encountered, or lessons learned:

```
Date: _______________
Deployed by: _______________
Notes:




```
