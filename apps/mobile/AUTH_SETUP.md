# Clerk Authentication Setup

This document describes the Clerk authentication implementation for the FuelFuse mobile app.

## Overview

The mobile app uses Clerk for authentication with the following features:
- Email/password sign-up with email verification
- Email/password sign-in
- Secure token caching with expo-secure-store
- Protected route wrapper for authenticated screens
- Automatic routing based on authentication state

## Architecture

### Token Caching
- **File**: `lib/token-cache.ts`
- Uses `expo-secure-store` to securely store Clerk JWT tokens on device
- Implements Clerk's `TokenCache` interface

### Authentication Screens
- **Sign In**: `app/(auth)/sign-in.tsx`
  - Email and password input
  - Error handling with alerts
  - Navigation to sign-up screen
  
- **Sign Up**: `app/(auth)/sign-up.tsx`
  - Email and password registration
  - Email verification with code
  - Two-step process: registration → verification

### Protected Routes
- **Component**: `components/ProtectedRoute.tsx`
- Wraps the entire app to handle authentication routing
- Redirects unauthenticated users to sign-in
- Redirects authenticated users away from auth screens

### App Structure
```
app/
├── _layout.tsx              # Root layout with ClerkProvider
├── index.tsx                # Initial routing screen
├── (auth)/
│   ├── sign-in.tsx         # Sign in screen
│   └── sign-up.tsx         # Sign up screen
└── (app)/
    ├── _layout.tsx         # Authenticated app layout
    └── index.tsx           # Home screen (authenticated)
```

## Configuration

### Environment Variables
Add to `.env` file:
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

### Clerk Dashboard Setup
1. Create a Clerk application at https://clerk.com
2. Enable email/password authentication
3. Configure email verification settings
4. Copy the publishable key to your `.env` file

### App Config
The `app.config.js` exposes the Clerk key via `extra.clerkPublishableKey`

## User Flow

### First Time User
1. App loads → `index.tsx` checks auth state
2. Not signed in → Redirect to `(auth)/sign-in`
3. User taps "Sign up" → Navigate to `(auth)/sign-up`
4. User enters email/password → Clerk creates account
5. User receives verification code via email
6. User enters code → Account verified
7. Redirect to `(app)` → Home screen

### Returning User
1. App loads → `index.tsx` checks auth state
2. Token found in secure store → Auto sign-in
3. Redirect to `(app)` → Home screen

### Sign Out
1. User taps "Sign Out" on home screen
2. Clerk session cleared
3. Token removed from secure store
4. Redirect to `(auth)/sign-in`

## Security Features

- JWT tokens stored in expo-secure-store (encrypted on device)
- Tokens automatically refreshed by Clerk
- Email verification required for new accounts
- Password requirements enforced by Clerk
- Session management handled by Clerk

## Testing

To test authentication:
1. Install dependencies: `npm install` in `apps/mobile`
2. Set up `.env` with Clerk key
3. Run app: `npm run dev`
4. Test sign-up flow with a real email
5. Test sign-in flow
6. Test sign-out flow
7. Test protected route access

## Integration with Backend

When making API calls to the backend, include the Clerk JWT token:

```typescript
import { useAuth } from '@clerk/clerk-expo';

const { getToken } = useAuth();

const token = await getToken();
const response = await fetch(`${API_URL}/api/endpoint`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

The backend will verify the token using Clerk's server-side SDK.

## Troubleshooting

### "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"
- Ensure `.env` file exists with the correct key
- Restart the Expo dev server after adding env vars

### "Sign in failed"
- Check Clerk dashboard for authentication settings
- Verify email/password authentication is enabled
- Check network connectivity

### "Verification failed"
- Ensure email verification is configured in Clerk
- Check spam folder for verification email
- Request a new code if expired

## Next Steps

After authentication is set up, the following features will be added:
- User profile screen
- Preferences management
- Push notification token registration
- Subscription status display
