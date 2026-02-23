# Requirements Document

## Introduction

FuelFuse is a UK fuel-price mobile application that helps users find the cheapest petrol and diesel nearby and receive push alerts when prices drop. The system ingests fuel price data from the GOV.UK Fuel Finder API into a PostgreSQL database and serves this data through a mobile-first React Native application with Stripe-based subscription payments.

## Glossary

- **Mobile_App**: The React Native (Expo) mobile application for iOS and Android
- **Backend_API**: The Next.js 14 App Router API deployed on Vercel
- **Fuel_Finder_API**: The GOV.UK Fuel Finder external data source
- **Ingestion_Job**: The Vercel Cron job that fetches and stores fuel price data
- **Alert_Job**: The Vercel Cron job that evaluates alert rules and sends push notifications
- **Database**: PostgreSQL database with PostGIS for geospatial queries
- **Stripe_Checkout**: Hosted Stripe payment page for subscription upgrades
- **Push_Service**: Expo push notification service
- **Free_Tier**: Basic subscription tier with limited features
- **Pro_Tier**: Premium subscription tier with full features
- **Station**: A fuel station with location, brand, and pricing information
- **Alert_Rule**: User-defined criteria for receiving price drop notifications
- **Postcode_Geocoder**: Service that converts UK postcodes to latitude/longitude coordinates

## Requirements

### Requirement 1: Fuel Price Search

**User Story:** As a user, I want to search for the cheapest fuel stations near me, so that I can save money on petrol or diesel.

#### Acceptance Criteria

1. WHEN a user provides a UK postcode, radius, and fuel type, THEN THE Backend_API SHALL return the top 5-10 cheapest stations within the specified radius
2. WHEN a user provides latitude/longitude coordinates, radius, and fuel type, THEN THE Backend_API SHALL return the top 5-10 cheapest stations within the specified radius
3. WHEN displaying search results, THEN THE Mobile_App SHALL show station name, brand, price in pence per litre, distance, and last updated timestamp
4. WHEN calculating distance, THEN THE Backend_API SHALL use PostGIS geospatial queries or Haversine formula as fallback
5. THE Backend_API SHALL normalize postcodes to uppercase with standard spacing before processing
6. THE Backend_API SHALL cache geocoded postcode coordinates in the database to minimize external API calls
7. WHEN search results are returned, THEN THE Backend_API SHALL sort stations by price ascending with distance as secondary sort

### Requirement 2: Station Details

**User Story:** As a user, I want to view detailed information about a fuel station, so that I can make informed decisions about where to refuel.

#### Acceptance Criteria

1. WHEN a user selects a station, THEN THE Backend_API SHALL return station name, brand, address, postcode, petrol price, diesel price, last updated timestamp, amenities, and opening hours
2. WHEN amenities or opening hours are unavailable, THEN THE Backend_API SHALL return null values without error
3. THE Backend_API SHALL retrieve station details from the Database without querying Fuel_Finder_API in real-time

### Requirement 3: User Account Management

**User Story:** As a user, I want to create an account and save my preferences, so that I can have a personalized experience.

#### Acceptance Criteria

1. WHEN a user signs up, THEN THE Backend_API SHALL create a user record with Clerk user ID and email
2. WHEN a user saves preferences, THEN THE Backend_API SHALL store home postcode, default radius, and default fuel type
3. WHEN a user retrieves preferences, THEN THE Backend_API SHALL return saved home postcode, default radius, and default fuel type
4. THE Backend_API SHALL validate all user inputs using Zod schemas before database operations

### Requirement 4: Push Notification Alerts

**User Story:** As a Pro tier user, I want to receive push notifications when fuel prices drop, so that I can refuel at the best time.

#### Acceptance Criteria

1. WHEN a user registers a push token, THEN THE Backend_API SHALL store the Expo push token with user ID and platform
2. WHEN a user creates an alert rule, THEN THE Backend_API SHALL store center location (postcode or lat/lng), radius, fuel type, trigger type, and threshold in pence per litre
3. WHEN Alert_Job runs, THEN THE Backend_API SHALL evaluate all enabled alert rules and identify price drops meeting threshold criteria
4. WHEN an alert rule triggers, THEN THE Backend_API SHALL send a push notification via Push_Service with station name, new price, and price drop amount
5. WHEN an alert rule triggers, THEN THE Backend_API SHALL update last_triggered_at timestamp to prevent duplicate alerts within 24 hours
6. THE Backend_API SHALL enforce a maximum of 2 alerts per day per user to prevent spam
7. WHEN a user disables an alert rule, THEN THE Alert_Job SHALL skip evaluation for that rule
8. THE Alert_Job SHALL run every 60 minutes via Vercel Cron

### Requirement 5: Subscription and Payment Management

**User Story:** As a user, I want to upgrade to Pro tier via Stripe, so that I can access premium features like alerts and extended radius.

#### Acceptance Criteria

1. WHEN a Free_Tier user requests upgrade, THEN THE Backend_API SHALL create a Stripe Checkout session and return the hosted page URL
2. WHEN a user completes Stripe Checkout, THEN THE Stripe webhook SHALL update the user's subscription status to Pro_Tier in the Database
3. WHEN a Stripe webhook event is received, THEN THE Backend_API SHALL verify the webhook signature and process the event idempotently using event ID
4. WHEN a Pro_Tier user accesses premium features, THEN THE Backend_API SHALL verify subscription status from the Database before allowing access
5. WHEN a Free_Tier user attempts to access Pro features, THEN THE Backend_API SHALL return an error indicating upgrade required
6. THE Free_Tier SHALL limit radius to maximum 5 miles and disable alert creation
7. THE Pro_Tier SHALL allow radius up to 25 miles and enable unlimited alert rules

### Requirement 6: Fuel Price Data Ingestion

**User Story:** As a system administrator, I want automated fuel price data ingestion from GOV.UK Fuel Finder, so that users have access to current pricing information.

#### Acceptance Criteria

1. WHEN Ingestion_Job runs, THEN THE Backend_API SHALL authenticate with Fuel_Finder_API using OAuth2 client credentials flow with scope fuelfinder.read
2. WHEN requesting OAuth token, THEN THE Backend_API SHALL cache the token until 5 minutes before expiry
3. WHEN Ingestion_Job fetches data, THEN THE Backend_API SHALL handle pagination and cursors if provided by Fuel_Finder_API
4. WHEN Ingestion_Job receives station data, THEN THE Backend_API SHALL validate the payload using Zod schemas
5. WHEN Ingestion_Job processes stations, THEN THE Backend_API SHALL upsert stations by source station_id in a database transaction
6. WHEN Ingestion_Job processes prices, THEN THE Backend_API SHALL upsert station_prices_latest and insert into station_prices_history with unique constraint on (station_id, updated_at_source)
7. WHEN Ingestion_Job completes, THEN THE Backend_API SHALL record ingestion statistics in ingestion_runs table with status, counts, and error summary
8. THE Ingestion_Job SHALL be idempotent such that processing the same payload twice produces no duplicate records
9. THE Ingestion_Job SHALL run every 10-15 minutes via Vercel Cron
10. WHEN Fuel_Finder_API returns 429 or 5xx errors, THEN THE Ingestion_Job SHALL implement exponential backoff retries
11. THE Ingestion_Job endpoint SHALL be secured by x-cron-secret header matching CRON_SECRET environment variable

### Requirement 7: Fallback Data Ingestion

**User Story:** As a system administrator, I want a fallback CSV ingestion mechanism, so that the system remains operational if the API is unavailable.

#### Acceptance Criteria

1. WHEN CSV fallback is triggered, THEN THE Backend_API SHALL parse and validate CSV data containing station and price information
2. WHEN CSV fallback processes data, THEN THE Backend_API SHALL follow the same upsert logic as API ingestion
3. THE CSV fallback endpoint SHALL be secured and accessible only to administrators

### Requirement 8: API Security and Reliability

**User Story:** As a system architect, I want robust security and reliability measures, so that the system is protected and resilient.

#### Acceptance Criteria

1. WHEN any API endpoint receives a request, THEN THE Backend_API SHALL validate all inputs using Zod schemas
2. WHEN search endpoints receive requests, THEN THE Backend_API SHALL enforce rate limiting using Vercel KV or similar mechanism
3. WHEN Stripe webhook receives an event, THEN THE Backend_API SHALL verify the webhook signature before processing
4. WHEN Stripe webhook processes an event, THEN THE Backend_API SHALL deduplicate using event ID to ensure idempotency
5. WHEN Cron endpoints receive requests, THEN THE Backend_API SHALL verify CRON_SECRET header before execution
6. THE Backend_API SHALL store all secrets in environment variables and never expose them to the Mobile_App
7. WHEN external API calls are made, THEN THE Backend_API SHALL implement timeouts and structured error logging

### Requirement 9: Mobile Application Core Features

**User Story:** As a mobile user, I want a fast and intuitive app experience, so that I can quickly find cheap fuel.

#### Acceptance Criteria

1. WHEN Mobile_App launches, THEN THE Mobile_App SHALL authenticate users via Clerk
2. WHEN a user initiates search, THEN THE Mobile_App SHALL allow postcode entry or device location selection
3. WHEN a user selects device location, THEN THE Mobile_App SHALL request location permissions and retrieve latitude/longitude coordinates
4. WHEN Mobile_App displays search results, THEN THE Mobile_App SHALL show loading states during API requests
5. WHEN Mobile_App receives search results, THEN THE Mobile_App SHALL display stations in a scrollable list with price, distance, and last updated
6. WHEN a user taps a station, THEN THE Mobile_App SHALL navigate to station detail screen
7. WHEN a user upgrades to Pro, THEN THE Mobile_App SHALL open Stripe_Checkout in an in-app browser using expo-web-browser
8. THE Mobile_App SHALL never call Fuel_Finder_API directly
9. THE Mobile_App SHALL be built with React Native and Expo with TypeScript
10. THE Mobile_App SHALL be EAS build ready for iOS and Android deployment

### Requirement 10: Push Notification Infrastructure

**User Story:** As a mobile user, I want to receive timely push notifications, so that I am alerted to price drops.

#### Acceptance Criteria

1. WHEN Mobile_App requests notification permissions, THEN THE Mobile_App SHALL use expo-notifications to obtain user consent
2. WHEN notification permissions are granted, THEN THE Mobile_App SHALL retrieve Expo push token and register it with Backend_API
3. WHEN Push_Service sends a notification, THEN THE Mobile_App SHALL display the notification with station name and price information
4. WHEN a user taps a notification, THEN THE Mobile_App SHALL navigate to the relevant station detail screen

### Requirement 11: Database Schema and Indexing

**User Story:** As a system architect, I want a well-structured database schema with proper indexing, so that queries are performant and data integrity is maintained.

#### Acceptance Criteria

1. THE Database SHALL contain tables for users, subscriptions, user_preferences, push_tokens, alert_rules, stations, station_prices_latest, station_prices_history, postcode_geo_cache, ingestion_runs, and alert_runs
2. THE stations table SHALL have a geospatial index on latitude/longitude for efficient radius queries
3. THE station_prices_latest table SHALL have an index on updated_at_source for temporal queries
4. THE alert_rules table SHALL have a composite index on (user_id, enabled) for efficient alert processing
5. THE push_tokens table SHALL have a unique index on expo_push_token
6. THE station_prices_history table SHALL enforce unique constraint on (station_id, updated_at_source) to prevent duplicates
7. THE postcode_geo_cache table SHALL have a unique index on postcode_normalized
8. THE Database SHALL use Prisma ORM for schema management and migrations

### Requirement 12: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive automated tests, so that I can ensure system correctness and prevent regressions.

#### Acceptance Criteria

1. THE Backend_API SHALL include unit tests for postcode normalization logic
2. THE Backend_API SHALL include unit tests for distance calculation and radius filtering
3. THE Backend_API SHALL include integration tests verifying fuel-sync idempotency with duplicate payloads
4. THE Backend_API SHALL include integration tests verifying cheapest query returns correctly sorted results
5. THE Backend_API SHALL include integration tests verifying Stripe webhook idempotent handling
6. THE Mobile_App SHALL include smoke tests for key screens (search, results, detail, account)
7. THE Mobile_App SHALL include tests for push token registration flow with mocked API responses
8. WHEN tests run in CI, THEN all tests SHALL pass before deployment

### Requirement 13: Deployment and Operations

**User Story:** As a DevOps engineer, I want clear deployment procedures and operational monitoring, so that the system runs reliably in production.

#### Acceptance Criteria

1. THE Backend_API SHALL be deployed on Vercel with Next.js 14 App Router
2. THE Database SHALL be PostgreSQL hosted on Neon or similar managed service
3. THE Ingestion_Job and Alert_Job SHALL be configured as Vercel Cron jobs
4. THE system SHALL include a README with complete local setup instructions and environment variable definitions
5. THE system SHALL include a seed script to load minimal station data for development
6. THE system SHALL include a production checklist covering monitoring, data staleness detection, and backup procedures
7. WHEN errors occur, THEN THE system SHALL log structured error information to Sentry or similar observability platform

### Requirement 14: Postcode Geocoding Strategy

**User Story:** As a system architect, I want efficient postcode geocoding with caching, so that external API usage is minimized and performance is optimized.

#### Acceptance Criteria

1. WHEN a postcode is received, THEN THE Backend_API SHALL normalize it to uppercase with standard spacing
2. WHEN a normalized postcode is not in cache, THEN THE Backend_API SHALL query postcodes.io or similar service for coordinates
3. WHEN geocoding succeeds, THEN THE Backend_API SHALL store normalized postcode, latitude, longitude, and timestamps in postcode_geo_cache
4. WHEN a normalized postcode exists in cache, THEN THE Backend_API SHALL retrieve coordinates from Database without external API call
5. WHEN cached postcode is accessed, THEN THE Backend_API SHALL update last_used_at timestamp for cache management
