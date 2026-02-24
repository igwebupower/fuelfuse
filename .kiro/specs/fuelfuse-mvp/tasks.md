# Implementation Plan: FuelFuse MVP

## Overview

This implementation plan breaks down the FuelFuse MVP into discrete coding tasks following the build order: backend database and API first, then data ingestion, mobile app, push notifications, payments, and finally testing and deployment. Each task builds incrementally on previous work to ensure continuous integration.

## Tasks

- [x] 1. Project setup and database schema
  - Initialize monorepo with apps/web (Next.js), apps/mobile (Expo), packages/shared
  - Set up Prisma with PostgreSQL connection
  - Create all Prisma models (User, Subscription, UserPreferences, PushToken, AlertRule, Station, StationPriceLatest, StationPriceHistory, PostcodeGeoCache, IngestionRun, AlertRun)
  - Add indexes and constraints as specified in design
  - Run initial migration
  - Create shared TypeScript types and Zod schemas in packages/shared
  - _Requirements: 11.1, 11.6, 11.8_

- [x] 1.1 Write property test for database constraints
  - **Property 20: Price history prevents duplicates**
  - **Validates: Requirements 6.6, 11.6**

- [x] 2. Implement geocoding service
  - [x] 2.1 Create postcode normalization function
    - Implement uppercase conversion and standard spacing
    - _Requirements: 1.5, 14.1_
  
  - [x] 2.2 Write property test for postcode normalization
    - **Property 3: Postcode normalization is consistent**
    - **Validates: Requirements 1.5, 14.1**
  
  - [x] 2.3 Implement geocoding cache service
    - Create functions for cache lookup, storage, and last_used_at updates
    - Integrate with postcodes.io API
    - _Requirements: 1.6, 14.2, 14.3, 14.4, 14.5_
  
  - [x] 2.4 Write property test for geocoding cache
    - **Property 4: Geocoding cache round-trip**
    - **Validates: Requirements 1.6, 14.2, 14.3, 14.4, 14.5**

- [x] 3. Implement OAuth2 client for Fuel Finder API
  - [x] 3.1 Create OAuth2 service with client credentials flow
    - Implement token request with scope fuelfinder.read
    - Add token caching with Vercel KV
    - Implement token refresh 5 minutes before expiry
    - _Requirements: 6.1, 6.2_
  
  - [x] 3.2 Write property test for OAuth token caching
    - **Property 18: OAuth token caching reduces API calls**
    - **Validates: Requirements 6.2**
  
  - [x] 3.3 Add retry logic with exponential backoff
    - Handle 429 and 5xx errors
    - _Requirements: 6.10_

- [x] 4. Implement fuel price ingestion service
  - [x] 4.1 Create ingestion service with API fetch logic
    - Fetch stations and prices from Fuel Finder API
    - Handle pagination/cursors
    - Validate payloads with Zod schemas
    - _Requirements: 6.3, 6.4_
  
  - [x] 4.2 Write property test for input validation
    - **Property 7: Invalid inputs are rejected**
    - **Validates: Requirements 3.4, 6.4, 8.1**
  
  - [x] 4.3 Implement station and price upsert logic
    - Upsert stations by station_id in transaction
    - Upsert station_prices_latest
    - Insert into station_prices_history with unique constraint
    - Record ingestion_runs metadata
    - _Requirements: 6.5, 6.6, 6.7_
  
  - [x] 4.4 Write property test for station upsert
    - **Property 19: Station upsert creates or updates by station ID**
    - **Validates: Requirements 6.5**
  
  - [x] 4.5 Write property test for ingestion idempotency
    - **Property 22: Ingestion is idempotent**
    - **Validates: Requirements 6.8**
  
  - [x] 4.6 Write property test for ingestion metadata
    - **Property 21: Ingestion run metadata is recorded**
    - **Validates: Requirements 6.7**

- [x] 5. Create fuel sync cron endpoint
  - Implement POST /api/cron/fuel-sync route handler
  - Add x-cron-secret authentication
  - Call ingestion service
  - Handle errors and logging
  - _Requirements: 6.11_

- [x] 5.1 Write property test for cron authentication
  - **Property 23: Cron endpoints require authentication**
  - **Validates: Requirements 6.11, 8.5**

- [x] 6. Implement search service
  - [x] 6.1 Create search by postcode function
    - Normalize postcode
    - Geocode with caching
    - Query stations within radius using PostGIS or Haversine
    - Sort by price ascending, distance secondary
    - Return top 5-10 results with all required fields
    - _Requirements: 1.1, 1.5, 1.6, 1.7_
  
  - [x] 6.2 Create search by coordinates function
    - Query stations within radius
    - Sort and return results
    - _Requirements: 1.2, 1.7_
  
  - [x] 6.3 Write property test for search correctness
    - **Property 1: Search results are within radius and sorted by price**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.7**
  
  - [x] 6.4 Create station detail function
    - Fetch station by ID with all fields
    - Handle null amenities/opening hours
    - _Requirements: 2.1, 2.2_
  
  - [x] 6.5 Write property test for station detail
    - **Property 2: Station detail contains all required fields**
    - **Validates: Requirements 2.1, 2.2**

- [x] 7. Create search API endpoints
  - Implement GET /api/search/cheapest with postcode and lat/lng variants
  - Implement GET /api/stations/:stationId
  - Add Zod validation for all inputs
  - Add rate limiting with Vercel KV
  - _Requirements: 1.1, 1.2, 2.1, 8.2_

- [x] 8. Cmheckpoint - Ensure search functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement user account services
  - [x] 9.1 Create user creation service
    - Store Clerk user ID and email
    - _Requirements: 3.1_
  
  - [x] 9.2 Write property test for user creation
    - **Property 5: User creation stores Clerk ID and email**
    - **Validates: Requirements 3.1**
  
  - [x] 9.3 Create user preferences service
    - Implement save and retrieve preferences
    - _Requirements: 3.2, 3.3_
  
  - [x] 9.4 Write property test for preferences round-trip
    - **Property 6: User preferences round-trip**
    - **Validates: Requirements 3.2, 3.3**

- [x] 10. Create user account API endpoints
  - Implement GET/PUT /api/preferences
  - Add Clerk authentication middleware
  - _Requirements: 3.2, 3.3_

- [x] 11. Implement subscription service
  - [x] 11.1 Create Stripe checkout session service
    - Generate checkout session for Pro upgrade
    - Return session ID and URL
    - _Requirements: 5.1_
  
  - [x] 11.2 Write property test for checkout session creation
    - **Property 14: Checkout session creation returns valid URL**
    - **Validates: Requirements 5.1**
  
  - [x] 11.3 Create subscription status service
    - Check if user is Pro tier
    - Enforce tier limits (radius, alerts)
    - _Requirements: 5.4, 5.5, 5.6, 5.7_
  
  - [x] 11.4 Write property test for subscription tier authorization
    - **Property 17: Subscription tier authorization**
    - **Validates: Requirements 5.4, 5.5, 5.6, 5.7**

- [x] 12. Implement Stripe webhook handler
  - [x] 12.1 Create webhook endpoint POST /api/stripe/webhook
    - Verify webhook signature
    - Handle subscription events (checkout.session.completed, customer.subscription.updated, etc.)
    - Update subscription status in database
    - Implement idempotency with event ID deduplication
    - _Requirements: 5.2, 5.3, 8.3, 8.4_
  
  - [x] 12.2 Write property test for webhook idempotency
    - **Property 16: Webhook processing is idempotent**
    - **Validates: Requirements 5.3, 8.4**
  
  - [x] 12.3 Write property test for webhook signature verification
    - **Property 26: Webhook signature verification**
    - **Validates: Requirements 8.3**
  
  - [x] 12.4 Write property test for subscription update
    - **Property 15: Webhook updates subscription status**
    - **Validates: Requirements 5.2**

- [x] 13. Create billing API endpoints
  - Implement POST /api/billing/create-checkout-session
  - Implement GET /api/billing/status
  - Add authentication and tier checking
  - _Requirements: 5.1, 5.4_

- [x] 14. Checkpoint - Ensure subscription flow works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement push token service
  - [x] 15.1 Create push token registration service
    - Store Expo push token with user ID and platform
    - Handle token updates
    - _Requirements: 4.1_
  
  - [x] 15.2 Write property test for push token registration
    - **Property 8: Push token registration stores token and platform**
    - **Validates: Requirements 4.1**

- [x] 16. Implement alert rule service
  - [x] 16.1 Create alert rule CRUD operations
    - Create, read, update, delete alert rules
    - Store all required parameters
    - _Requirements: 4.2_
  
  - [x] 16.2 Write property test for alert rule creation
    - **Property 9: Alert rule creation stores all parameters**
    - **Validates: Requirements 4.2**

- [x] 17. Create push and alert API endpoints
  - Implement POST /api/push/register
  - Implement POST/GET/PUT/DELETE /api/alerts
  - Add authentication and Pro tier checking
  - _Requirements: 4.1, 4.2_

- [x] 18. Implement alert evaluation service
  - [x] 18.1 Create alert evaluation logic
    - Find cheapest station within alert rule radius
    - Compare to last notified price
    - Check threshold and 24-hour cooldown
    - Enforce 2 alerts per day limit
    - Skip disabled rules
    - _Requirements: 4.3, 4.5, 4.6, 4.7_
  
  - [x] 18.2 Write property test for alert evaluation
    - **Property 10: Alert evaluation identifies price drops meeting threshold**
    - **Validates: Requirements 4.3**
  
  - [x] 18.3 Write property test for alert rate limiting
    - **Property 12: Alert rate limiting prevents spam**
    - **Validates: Requirements 4.5, 4.6**
  
  - [x] 18.4 Write property test for disabled alerts
    - **Property 13: Disabled alerts are not evaluated**
    - **Validates: Requirements 4.7**
  
  - [x] 18.5 Create push notification service
    - Send notifications via Expo Push API
    - Include station name, new price, price drop
    - Handle errors and log failures
    - _Requirements: 4.4_
  
  - [x] 18.6 Write property test for notification content
    - **Property 11: Alert notifications contain required information**
    - **Validates: Requirements 4.4**

- [x] 19. Create alert cron endpoint
  - Implement POST /api/cron/alert-run route handler
  - Add x-cron-secret authentication
  - Call alert evaluation service for all enabled rules
  - Record alert_runs metadata
  - _Requirements: 4.3, 4.8_

- [x] 20. Checkpoint - Ensure alert system works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Initialize mobile app with Expo
  - Create Expo app with TypeScript
  - Set up Expo Router for navigation
  - Configure EAS build
  - Install dependencies (Clerk, expo-notifications, expo-web-browser, axios)
  - _Requirements: 9.9, 9.10_

- [x] 22. Implement mobile authentication
  - [x] 22.1 Set up Clerk authentication
    - Configure Clerk provider
    - Create login/signup screens
    - Implement protected route wrapper
    - _Requirements: 9.1_

- [x] 23. Implement mobile search flow
  - [x] 23.1 Create search screen
    - Postcode input field
    - Location button with permission request
    - Radius selector
    - Fuel type picker
    - _Requirements: 9.2, 9.3_
  
  - [x] 23.2 Create results list screen
    - Display stations with price, distance, last updated
    - Show loading states
    - Handle empty results
    - _Requirements: 9.5_
  
  - [x] 23.3 Create station detail screen
    - Display full station information
    - Show amenities and opening hours
    - _Requirements: 9.6_
  
  - [x] 23.4 Wire search flow with API
    - Call /api/search/cheapest endpoint
    - Handle errors and loading states
    - _Requirements: 1.1, 1.2_

- [x] 24. Implement mobile account features
  - [x] 24.1 Create preferences screen
    - Save home postcode, default radius, default fuel type
    - Call /api/preferences endpoint
    - _Requirements: 3.2, 3.3_
  
  - [x] 24.2 Create subscription status display
    - Show current tier (Free/Pro)
    - Display upgrade button for Free users
    - _Requirements: 5.4_
  
  - [x] 24.3 Implement Stripe checkout flow
    - Open checkout URL in expo-web-browser
    - Handle return from checkout
    - _Requirements: 9.7_

- [x] 25. Implement mobile push notifications
  - [x] 25.1 Set up expo-notifications
    - Request notification permissions
    - Retrieve Expo push token
    - Register token with backend
    - _Requirements: 10.1, 10.2_
  
  - [x] 25.2 Handle incoming notifications
    - Display notifications
    - Handle notification taps
    - Navigate to station detail
    - _Requirements: 10.3, 10.4_

- [x] 26. Implement mobile alerts management (Pro only)
  - Create alert rules list screen
  - Create alert rule form
  - Call /api/alerts endpoints
  - Show Pro upgrade prompt for Free users
  - _Requirements: 4.2, 5.6_

- [x] 27. Checkpoint - Ensure mobile app works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 28. Implement CSV fallback ingestion
  - [x] 28.1 Create CSV parser and validator
    - Parse CSV with station and price data
    - Validate with Zod schemas
    - _Requirements: 7.1_
  
  - [x] 28.2 Create CSV ingestion endpoint
    - Implement POST /api/admin/ingest-csv
    - Use same upsert logic as API ingestion
    - Add admin-only authentication
    - _Requirements: 7.2, 7.3_
  
  - [x] 28.3 Write property test for CSV/API equivalence
    - **Property 24: CSV and API ingestion produce equivalent results**
    - **Validates: Requirements 7.2**
  
  - [x] 28.4 Write property test for admin authorization
    - **Property 25: CSV fallback requires admin authorization**
    - **Validates: Requirements 7.3**

- [x] 29. Add error handling and logging
  - Implement structured error logging
  - Add Sentry integration
  - Configure timeouts for external APIs
  - Add error boundaries in mobile app
  - _Requirements: 8.7, 13.7_

- [x] 30. Create development seed script
  - Generate minimal test station data
  - Seed database for local development
  - _Requirements: 13.5_

- [x] 31. Write deployment documentation
  - Create README with setup instructions
  - Document all environment variables
  - Create Vercel cron configuration guide
  - Create production checklist
  - _Requirements: 13.4, 13.6_

- [x] 32. Configure CI/CD pipeline
  - Set up GitHub Actions or similar
  - Run all tests on PR
  - Require 100% test pass rate
  - Generate coverage reports
  - _Requirements: 12.8_

- [x] 33. Final checkpoint - Full system integration test
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The build order ensures each component can be tested as it's built
- Mobile app development starts after backend API is functional
