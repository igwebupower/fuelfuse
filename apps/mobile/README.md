# FuelFuse Mobile App

React Native mobile application built with Expo and TypeScript.

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- iOS Simulator (Mac only) or Android Emulator

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
   - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key
   - `EXPO_PUBLIC_API_URL`: Backend API URL (default: http://localhost:3000)
   - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key

## Development

Start the development server:
```bash
npm run dev
```

Run on specific platform:
```bash
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web browser
```

## Building with EAS

### Initial Setup

1. Login to EAS:
```bash
eas login
```

2. Configure the project:
```bash
eas build:configure
```

3. Update `app.json` with your EAS project ID

### Build Commands

Development build:
```bash
npm run build:android  # Android
npm run build:ios      # iOS
npm run build:all      # Both platforms
```

Production build:
```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Project Structure

```
apps/mobile/
├── app/                 # Expo Router screens
│   ├── _layout.tsx     # Root layout
│   └── index.tsx       # Home screen
├── components/         # React components
│   ├── AuthProvider.tsx    # Auth & notification setup
│   └── ProtectedRoute.tsx  # Route protection
├── lib/                # Utilities
│   ├── api.ts          # API client
│   └── notifications.ts # Push notification service
├── assets/             # Images and fonts
├── app.json            # Expo configuration
├── eas.json            # EAS Build configuration
├── package.json        # Dependencies
└── tsconfig.json       # TypeScript config
```

## Features

### Push Notifications

Push notifications are automatically set up when a user signs in. See [NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md) for details.

**Key Points:**
- Notifications only work on physical devices (not simulators)
- Permission is requested automatically on first sign-in
- Token is registered with the backend for price drop alerts
- Setup fails gracefully if permission is denied

## Dependencies

### Core
- **expo**: Expo SDK
- **expo-router**: File-based navigation
- **react-native**: React Native framework

### Authentication
- **@clerk/clerk-expo**: Clerk authentication SDK

### Notifications
- **expo-notifications**: Push notifications
- **expo-device**: Device information

### Payments
- **expo-web-browser**: In-app browser for Stripe checkout

### API
- **axios**: HTTP client

## Environment Variables

All environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the app.

## Notes

- Asset files (icon.png, splash.png, etc.) need to be added to the `assets/` directory
- Update the EAS project ID in `app.json` after running `eas build:configure`
- For iOS builds, you'll need an Apple Developer account
- For Android builds, you'll need to configure signing credentials
