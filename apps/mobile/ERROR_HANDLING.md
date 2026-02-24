# Error Handling and Logging - Mobile App

This document describes the error handling and logging infrastructure for the FuelFuse mobile app.

## Overview

The mobile app implements comprehensive error handling with:
- Error boundaries to catch React errors
- Sentry integration for error tracking
- Graceful error UI with retry functionality
- User context tracking

## Components

### 1. Error Boundary (`components/ErrorBoundary.tsx`)

React error boundary component that catches errors in the component tree.

**Features:**
- Catches React rendering errors
- Displays user-friendly error UI
- Integrates with Sentry
- Provides retry functionality
- Customizable fallback UI

**Usage:**

Wrap your app or specific components:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

Custom fallback UI:

```tsx
<ErrorBoundary
  fallback={(error, resetError) => (
    <View>
      <Text>Custom error message</Text>
      <Button onPress={resetError}>Try Again</Button>
    </View>
  )}
>
  <YourComponent />
</ErrorBoundary>
```

### 2. Sentry Integration (`lib/sentry.ts`)

Sentry configuration and utilities for error tracking.

**Features:**
- Automatic error capture
- Performance monitoring
- Session tracking
- PII redaction
- User context tracking

**Usage:**

Initialize Sentry (done automatically in `_layout.tsx`):

```typescript
import { initSentry } from '@/lib/sentry';

initSentry();
```

Log errors manually:

```typescript
import { logError, logMessage } from '@/lib/sentry';

try {
  // Your code
} catch (error) {
  logError(error as Error, { screen: 'SearchScreen', action: 'search' });
}
```

Set user context:

```typescript
import { setUserContext, clearUserContext } from '@/lib/sentry';

// After login
setUserContext(userId);

// After logout
clearUserContext();
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### App Config

Sentry DSN is configured in `app.config.js`:

```javascript
extra: {
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
}
```

## Error Handling Patterns

### Screen Components

```tsx
import { View, Text } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { logError } from '@/lib/sentry';

export default function MyScreen() {
  const handleAction = async () => {
    try {
      // Your code
    } catch (error) {
      logError(error as Error, { screen: 'MyScreen', action: 'handleAction' });
      // Show user-friendly error message
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  return (
    <ErrorBoundary>
      <View>
        {/* Your UI */}
      </View>
    </ErrorBoundary>
  );
}
```

### API Calls

```typescript
import { logError } from '@/lib/sentry';
import { api } from '@/lib/api';

export async function searchStations(params: SearchParams) {
  try {
    const response = await api.get('/search/cheapest', { params });
    return response.data;
  } catch (error) {
    logError(error as Error, { 
      operation: 'searchStations',
      params: JSON.stringify(params),
    });
    throw error;
  }
}
```

### Async Operations

```typescript
import { logError } from '@/lib/sentry';

export async function loadData() {
  try {
    const data = await fetchData();
    return data;
  } catch (error) {
    logError(error as Error, { operation: 'loadData' });
    // Return fallback data or rethrow
    return null;
  }
}
```

## User Experience

### Error UI

The default error boundary displays:
- User-friendly error message
- "Try Again" button to reset error state
- Clean, accessible design

### Error Messages

Use clear, actionable error messages:

```typescript
// Good
Alert.alert('Connection Error', 'Unable to connect to the server. Please check your internet connection and try again.');

// Bad
Alert.alert('Error', 'Network request failed');
```

### Retry Logic

Implement retry for transient failures:

```typescript
async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

## Testing

### Error Boundary Tests

```typescript
import { render } from '@testing-library/react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';

describe('ErrorBoundary', () => {
  it('should catch errors and display fallback UI', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByText(/something went wrong/i)).toBeTruthy();
  });
});
```

### Error Handling Tests

```typescript
import { logError } from '@/lib/sentry';

jest.mock('@/lib/sentry');

describe('Error handling', () => {
  it('should log errors to Sentry', async () => {
    const error = new Error('Test error');
    
    try {
      throw error;
    } catch (e) {
      logError(e as Error, { context: 'test' });
    }

    expect(logError).toHaveBeenCalledWith(error, { context: 'test' });
  });
});
```

## Monitoring

### Sentry Dashboard

Monitor errors in Sentry:
1. Error frequency and trends
2. Stack traces
3. Device and OS information
4. User impact
5. Session replays

### Key Metrics

Track these metrics:
- Error rate (errors per session)
- Crash-free sessions
- Most common errors
- Affected users
- Error resolution time

## Best Practices

1. **Wrap root component in ErrorBoundary** - Catch all React errors
2. **Log errors with context** - Include screen, action, and relevant data
3. **Show user-friendly messages** - Don't expose technical details
4. **Implement retry logic** - For network and transient failures
5. **Test error scenarios** - Ensure error handling works correctly
6. **Monitor Sentry regularly** - Fix issues proactively
7. **Redact PII** - Never log sensitive user data
8. **Set user context** - Track which users are affected

## Troubleshooting

### Sentry not capturing errors

1. Check `EXPO_PUBLIC_SENTRY_DSN` is set in `.env`
2. Verify Sentry is initialized (check console logs)
3. Test with a manual error: `throw new Error('Test')`
4. Check Sentry project settings

### Error boundary not catching errors

1. Ensure ErrorBoundary wraps the component
2. Check error is thrown during render (not in event handlers)
3. For event handler errors, use try-catch and logError

### Too many error reports

1. Implement error deduplication
2. Adjust sample rate in Sentry config
3. Filter out known/expected errors

## Common Error Scenarios

### Network Errors

```typescript
try {
  const response = await api.get('/endpoint');
} catch (error) {
  if (error.message.includes('Network')) {
    Alert.alert('Connection Error', 'Please check your internet connection.');
  } else {
    Alert.alert('Error', 'Something went wrong. Please try again.');
  }
  logError(error as Error, { operation: 'networkRequest' });
}
```

### Permission Errors

```typescript
try {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Denied', 'Location permission is required to find nearby stations.');
    return;
  }
} catch (error) {
  logError(error as Error, { operation: 'requestLocationPermission' });
  Alert.alert('Error', 'Unable to request location permission.');
}
```

### API Errors

```typescript
try {
  const response = await api.post('/endpoint', data);
} catch (error) {
  if (error.response?.status === 401) {
    // Handle authentication error
    Alert.alert('Session Expired', 'Please sign in again.');
  } else if (error.response?.status === 403) {
    // Handle authorization error
    Alert.alert('Upgrade Required', 'This feature requires a Pro subscription.');
  } else {
    Alert.alert('Error', 'Unable to complete request.');
  }
  logError(error as Error, { operation: 'apiRequest' });
}
```
