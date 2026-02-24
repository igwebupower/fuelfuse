import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { setAuthToken } from '../lib/api';
import { setupNotifications, setupNotificationResponseListener } from '../lib/notifications';
import type { Subscription } from 'expo-notifications';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const notificationSetupAttempted = useRef(false);
  const notificationSubscription = useRef<Subscription | null>(null);

  useEffect(() => {
    const updateToken = async () => {
      if (isSignedIn) {
        try {
          const token = await getToken();
          setAuthToken(token);
        } catch (error) {
          console.error('Error getting auth token:', error);
          setAuthToken(null);
        }
      } else {
        setAuthToken(null);
      }
    };

    updateToken();
  }, [isSignedIn, getToken]);

  // Set up push notifications when user signs in
  useEffect(() => {
    const initializeNotifications = async () => {
      if (isSignedIn && !notificationSetupAttempted.current) {
        notificationSetupAttempted.current = true;
        
        try {
          const result = await setupNotifications();
          
          if (result.granted && result.token) {
            console.log('Notifications set up successfully');
          } else if (result.error) {
            console.log('Notification setup issue:', result.error);
            // Gracefully handle - don't block the user experience
          }
        } catch (error) {
          console.error('Error initializing notifications:', error);
          // Gracefully handle - don't block the user experience
        }
      }
      
      // Reset flag when user signs out
      if (!isSignedIn) {
        notificationSetupAttempted.current = false;
      }
    };

    initializeNotifications();
  }, [isSignedIn]);

  // Set up notification response listener (handles notification taps)
  useEffect(() => {
    // Set up the listener
    notificationSubscription.current = setupNotificationResponseListener((stationId) => {
      // Navigate to station detail screen when notification is tapped
      router.push({
        pathname: '/(app)/station-detail',
        params: { stationId },
      });
    });

    // Clean up the listener when component unmounts
    return () => {
      if (notificationSubscription.current) {
        notificationSubscription.current.remove();
      }
    };
  }, [router]);

  return <>{children}</>;
}
