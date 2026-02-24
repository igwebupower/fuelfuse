# Push Notifications Setup

This document explains how push notifications are configured in the FuelFuse mobile app.

## Overview

The app uses Expo's push notification service to receive alerts about fuel price drops. The notification setup happens automatically when a user signs in.

## Implementation

### Components

1. **Notification Service** (`lib/notifications.ts`)
   - Handles permission requests
   - Retrieves Expo push tokens
   - Registers tokens with the backend

2. **AuthProvider** (`components/AuthProvider.tsx`)
   - Automatically sets up notifications when user signs in
   - Handles setup gracefully (doesn't block user experience if it fails)
   - Sets up notification response listener to handle notification taps
   - Navigates to station detail screen when notification is tapped

### Flow

1. User signs in via Clerk authentication
2. `AuthProvider` detects sign-in and calls `setupNotifications()`
3. `setupNotifications()` performs three steps:
   - Requests notification permissions from the user
   - Retrieves the Expo push token for the device
   - Registers the token with the backend via `POST /api/push/register`
4. `AuthProvider` sets up a notification response listener
5. When a user taps a notification:
   - The listener extracts the `stationId` from the notification data
   - The app navigates to the station detail screen for that station

### Permission Handling

- **Granted**: Token is registered with backend, user will receive push notifications
- **Denied**: Setup fails gracefully, app continues to work normally
- **Physical Device Required**: Push notifications only work on physical devices, not simulators

### Configuration

The app is configured in `app.config.js`:

```javascript
plugins: [
  [
    'expo-notifications',
    {
      icon: './assets/notification-icon.png',
      color: '#ffffff',
      sounds: [],
    },
  ],
]
```

Android permissions are automatically added:
- `POST_NOTIFICATIONS` (Android 13+)

iOS permissions are requested at runtime (no Info.plist entry needed for notifications).

## Testing

### Manual Testing

1. **Run on Physical Device**
   ```bash
   npm run dev
   # Then scan QR code with Expo Go app
   ```

2. **Sign In**
   - Create an account or sign in
   - Watch console logs for notification setup messages

3. **Check Permissions**
   - On iOS: Settings > FuelFuse > Notifications
   - On Android: Settings > Apps > FuelFuse > Notifications

4. **Verify Backend Registration**
   - Check backend logs for push token registration
   - Query database: `SELECT * FROM PushToken WHERE userId = 'your-user-id'`

### Testing Push Notifications

To test receiving notifications, you can use the Expo Push Notification Tool:

1. Get your Expo push token from the app logs
2. Visit: https://expo.dev/notifications
3. Enter your token and send a test notification with the following data structure:

```json
{
  "to": "ExponentPushToken[your-token-here]",
  "title": "Price Drop Alert",
  "body": "Shell Station - New price: 145.9p (dropped 3.0p)",
  "data": {
    "stationId": "your-station-id-here",
    "newPrice": 1459,
    "priceDrop": 30
  }
}
```

4. Tap the notification on your device
5. The app should navigate to the station detail screen for the specified station

### Common Issues

**"Push notifications only work on physical devices"**
- Solution: Run the app on a real iOS or Android device, not a simulator

**"Notification permission denied"**
- Solution: User must grant permission in device settings
- The app handles this gracefully and continues to work

**"Failed to register push token with backend"**
- Check that the backend API is running and accessible
- Verify the user is authenticated (Clerk token is valid)
- Check backend logs for errors

**"Notification doesn't navigate to station detail"**
- Verify the notification data includes a valid `stationId` field
- Check console logs for navigation errors
- Ensure the station exists in the database

## Backend Integration

The notification service calls `POST /api/push/register` with:

```typescript
{
  expoPushToken: string,  // Expo push token (e.g., "ExponentPushToken[...]")
  platform: "ios" | "android"
}
```

The backend stores this token in the `PushToken` table associated with the user's account.

When the backend sends a push notification, it includes the following data structure:

```typescript
{
  title: string,           // e.g., "Price Drop Alert"
  body: string,            // e.g., "Shell Station - New price: 145.9p (dropped 3.0p)"
  data: {
    stationId: string,     // Station ID for navigation
    newPrice: number,      // New price in pence per litre
    priceDrop: number      // Price drop amount in pence per litre
  }
}
```

When a user taps the notification, the app extracts the `stationId` from the data and navigates to the station detail screen.

## Future Enhancements

- Add a settings screen to allow users to enable/disable notifications
- Show notification permission status in the app
- Allow users to re-request permissions if initially denied
- Add notification categories for different alert types
