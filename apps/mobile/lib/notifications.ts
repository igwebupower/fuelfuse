import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from './api';
import type { NotificationPermissionResult } from '../types';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type { NotificationPermissionResult };

/**
 * Request notification permissions from the user
 * Returns whether permission was granted
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    // Check if running on physical device
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return false;
    }

    // Get current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get the Expo push token for this device
 * Returns the token string or null if unavailable
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    // Check if running on physical device
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (error) {
    console.error('Error getting Expo push token:', error);
    return null;
  }
}

/**
 * Register the push token with the backend
 * Returns whether registration was successful
 */
export async function registerPushToken(token: string): Promise<boolean> {
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    const response = await apiClient.post('/api/push/register', {
      expoPushToken: token,
      platform,
    });

    if (response.status === 200) {
      console.log('Push token registered successfully');
      return true;
    }

    console.error('Failed to register push token:', response.status);
    return false;
  } catch (error) {
    console.error('Error registering push token:', error);
    return false;
  }
}

/**
 * Complete notification setup flow:
 * 1. Request permissions
 * 2. Get push token
 * 3. Register with backend
 * 
 * Returns result with granted status, token, and any error
 */
export async function setupNotifications(): Promise<NotificationPermissionResult> {
  try {
    // Step 1: Request permissions
    const permissionGranted = await requestNotificationPermissions();
    
    if (!permissionGranted) {
      return {
        granted: false,
        error: 'Notification permission denied',
      };
    }

    // Step 2: Get push token
    const token = await getExpoPushToken();
    
    if (!token) {
      return {
        granted: true,
        error: 'Failed to get push token',
      };
    }

    // Step 3: Register with backend
    const registered = await registerPushToken(token);
    
    if (!registered) {
      return {
        granted: true,
        token,
        error: 'Failed to register push token with backend',
      };
    }

    return {
      granted: true,
      token,
    };
  } catch (error) {
    console.error('Error setting up notifications:', error);
    return {
      granted: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Set up notification response listener
 * This handles when a user taps on a notification
 * 
 * @param onNotificationTap - Callback function that receives the stationId
 * @returns Subscription object that can be used to remove the listener
 */
export function setupNotificationResponseListener(
  onNotificationTap: (stationId: string) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      // Extract stationId from notification data
      const data = response.notification.request.content.data;
      
      if (data && typeof data.stationId === 'string') {
        console.log('Notification tapped, navigating to station:', data.stationId);
        onNotificationTap(data.stationId);
      } else {
        console.warn('Notification data missing stationId:', data);
      }
    } catch (error) {
      console.error('Error handling notification response:', error);
    }
  });
}
