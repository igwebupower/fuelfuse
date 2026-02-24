# FuelFuse Mobile App - Setup Guide

## Quick Start

### 1. Install Dependencies

From the root of the monorepo:
```bash
npm install
```

### 2. Configure Environment Variables

```bash
cd apps/mobile
cp .env.example .env
```

Edit `.env` and add your keys:
```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

### 3. Add Asset Files

Create the following image files in `apps/mobile/assets/`:
- `icon.png` (1024x1024) - App icon
- `splash.png` (1284x2778) - Splash screen
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `favicon.png` (48x48) - Web favicon
- `notification-icon.png` (96x96) - Notification icon

You can use placeholder images for development.

### 4. Start Development Server

From the root:
```bash
npm run dev:mobile
```

Or from the mobile directory:
```bash
cd apps/mobile
npm run dev
```

### 5. Run on Device/Simulator

- Press `i` for iOS Simulator (Mac only)
- Press `a` for Android Emulator
- Press `w` for Web browser
- Scan QR code with Expo Go app on physical device

## EAS Build Setup

### Initial Configuration

1. Install EAS CLI globally:
```bash
npm install -g eas-cli
```

2. Login to your Expo account:
```bash
eas login
```

3. Configure the project:
```bash
cd apps/mobile
eas build:configure
```

This will:
- Create an EAS project
- Generate a project ID
- Update your configuration

4. Update `app.config.js` with your EAS project ID:
```javascript
extra: {
  eas: {
    projectId: 'your-actual-project-id'
  }
}
```

### Building

Development build (for testing):
```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

Preview build (internal distribution):
```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

Production build:
```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

Or use npm scripts:
```bash
npm run build:ios
npm run build:android
npm run build:all
```

## Dependencies Installed

### Core Dependencies
- `expo` (~50.0.0) - Expo SDK
- `expo-router` (~3.4.0) - File-based navigation
- `react-native` (0.73.0) - React Native framework
- `react` (18.2.0) - React library

### Authentication
- `@clerk/clerk-expo` (^1.0.0) - Clerk authentication SDK
- `expo-secure-store` (~12.8.0) - Secure token storage

### Notifications
- `expo-notifications` (~0.27.0) - Push notifications
- `expo-device` (~5.9.0) - Device information

### Payments
- `expo-web-browser` (~12.8.0) - In-app browser for Stripe

### API & Utilities
- `axios` (^1.6.0) - HTTP client
- `expo-constants` (~15.4.0) - App constants
- `expo-status-bar` (~1.11.0) - Status bar component

### Navigation
- `react-native-safe-area-context` (4.8.2) - Safe area handling
- `react-native-screens` (~3.29.0) - Native screen components

## Project Structure

```
apps/mobile/
├── app/                    # Expo Router screens (file-based routing)
│   ├── _layout.tsx        # Root layout with navigation
│   └── index.tsx          # Home screen
├── lib/                   # Utilities and services
│   ├── api.ts            # Axios API client with interceptors
│   └── config.ts         # App configuration and validation
├── types/                # TypeScript type definitions
│   └── index.ts          # Shared and mobile-specific types
├── constants/            # App constants
│   └── index.ts          # Colors, spacing, defaults
├── assets/               # Images, fonts, etc.
│   └── .gitkeep         # Placeholder (add actual assets)
├── app.config.js         # Expo configuration (with env vars)
├── app.json              # Static Expo configuration
├── eas.json              # EAS Build configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules
├── README.md            # General documentation
└── SETUP.md             # This file
```

## Next Steps

After completing this setup, you're ready to implement:

1. **Authentication** (Task 22) ✅ COMPLETED
   - Clerk provider setup with token caching
   - Login/signup screens with email verification
   - Protected routes wrapper
   - See [AUTH_SETUP.md](./AUTH_SETUP.md) for details

2. **Search Flow** (Task 23)
   - Search screen with postcode/location input
   - Results list
   - Station detail screen

3. **Account Features** (Task 24)
   - Preferences screen
   - Subscription status
   - Stripe checkout integration

4. **Push Notifications** (Task 25)
   - Permission requests
   - Token registration
   - Notification handling

5. **Alerts Management** (Task 26)
   - Alert rules list
   - Create/edit alert forms
   - Pro tier gating

## Troubleshooting

### Metro bundler issues
```bash
# Clear cache and restart
npx expo start -c
```

### iOS Simulator not opening
```bash
# Open simulator manually
open -a Simulator
```

### Android Emulator issues
```bash
# List available emulators
emulator -list-avds

# Start specific emulator
emulator -avd <emulator-name>
```

### TypeScript errors
```bash
# Rebuild TypeScript
npm run build --workspace=packages/shared
```

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router Documentation](https://expo.github.io/router/docs/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Clerk Expo SDK](https://clerk.com/docs/quickstarts/expo)
- [React Native Documentation](https://reactnative.dev/)
