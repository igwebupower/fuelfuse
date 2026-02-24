/**
 * Notification debugging utilities
 * Use these functions in development to test notification functionality
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { getExpoPushToken, requestNotificationPermissions } from './notifications';

/**
 * Get detailed notification permission status
 */
export async function getNotificationStatus() {
  const permissions = await Notifications.getPermissionsAsync();
  const isDevice = Device.isDevice;
  
  return {
    isPhysicalDevice: isDevice,
    deviceType: Device.deviceType,
    permissions: {
      status: permissions.status,
      canAskAgain: permissions.canAskAgain,
      granted: permissions.granted,
    },
  };
}

/**
 * Print notification status to console
 */
export async function logNotificationStatus() {
  const status = await getNotificationStatus();
  console.log('=== Notification Status ===');
  console.log('Physical Device:', status.isPhysicalDevice);
  console.log('Device Type:', status.deviceType);
  console.log('Permission Status:', status.permissions.status);
  console.log('Can Ask Again:', status.permissions.canAskAgain);
  console.log('Granted:', status.permissions.granted);
  
  if (status.isPhysicalDevice && status.permissions.granted) {
    try {
      const token = await getExpoPushToken();
      console.log('Push Token:', token);
    } catch (error) {
      console.log('Error getting token:', error);
    }
  }
  
  console.log('========================');
}

/**
 * Schedule a local test notification (for development)
 */
export async function scheduleTestNotification(delaySeconds: number = 5) {
  const hasPermission = await requestNotificationPermissions();
  
  if (!hasPermission) {
    console.log('Cannot schedule notification: permission not granted');
    return null;
  }
  
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification',
      body: 'This is a test notification from FuelFuse',
      data: { test: true },
    },
    trigger: {
      seconds: delaySeconds,
    },
  });
  
  console.log(`Test notification scheduled (ID: ${notificationId}) - will appear in ${delaySeconds}s`);
  return notificationId;
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('All scheduled notifications cancelled');
}
