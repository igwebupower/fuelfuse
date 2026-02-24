import { ClerkProvider } from '@clerk/clerk-expo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { tokenCache } from '../lib/token-cache';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthProvider } from '../components/AuthProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { initSentry } from '../lib/sentry';

const clerkPublishableKey = Constants.expoConfig?.extra?.clerkPublishableKey;

if (!clerkPublishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables');
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize Sentry on app start
    initSentry();
  }, []);

  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
        <AuthProvider>
          <ProtectedRoute>
            <StatusBar style="auto" />
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)/sign-in" options={{ title: 'Sign In' }} />
              <Stack.Screen name="(auth)/sign-up" options={{ title: 'Sign Up' }} />
              <Stack.Screen name="(app)" options={{ headerShown: false }} />
            </Stack>
          </ProtectedRoute>
        </AuthProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}
