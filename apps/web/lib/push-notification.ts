// Push notification service for FuelFuse
// Sends push notifications via Expo Push API
// Requirements: 4.4, 8.7

import { AlertNotification } from '@fuelfuse/shared';
import { getTokensForUser } from './push-token';
import { fetchJSON, TIMEOUTS } from './external-api';
import { logger } from './logger';

export interface ExpoPushMessage {
  to: string;
  sound?: 'default';
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

export interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

/**
 * Send a push notification to a user via Expo Push API
 * Requirements: 4.4, 8.7
 * 
 * @param userId - User ID to send notification to
 * @param notification - Notification content with station details
 * @returns Array of push tickets from Expo
 */
export async function sendPushNotification(
  userId: string,
  notification: AlertNotification
): Promise<ExpoPushTicket[]> {
  const log = logger.child({ service: 'ExpoPush', operation: 'sendNotification', userId });

  // Get user's push tokens
  const tokens = await getTokensForUser(userId);

  if (tokens.length === 0) {
    log.warn('No push tokens found for user');
    throw new Error('No push tokens found for user');
  }

  // Build Expo push messages
  const messages: ExpoPushMessage[] = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data,
  }));

  log.debug('Sending push notifications', { tokenCount: tokens.length });

  // Send to Expo Push API with timeout
  try {
    const result: ExpoPushResponse = await fetchJSON(
      'https://exp.host/--/api/v2/push/send',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      },
      {
        timeout: TIMEOUTS.EXPO_PUSH,
        service: 'ExpoPush',
        retries: 2,
      }
    );

    log.info('Push notifications sent successfully', { ticketCount: result.data.length });
    return result.data;
  } catch (error) {
    log.error('Failed to send push notification', error);
    throw error;
  }
}

/**
 * Create an alert notification with station details
 * Requirements: 4.4
 * 
 * @param stationName - Name of the station
 * @param stationBrand - Brand of the station
 * @param newPrice - New price in pence per litre
 * @param priceDrop - Price drop amount in pence
 * @param stationId - Station ID for navigation
 * @returns Formatted alert notification
 */
export function createAlertNotification(
  stationName: string,
  stationBrand: string,
  newPrice: number,
  priceDrop: number,
  stationId: string
): AlertNotification {
  // Format price in pounds (e.g., 145 ppl -> £1.45)
  const priceInPounds = (newPrice / 100).toFixed(2);
  const dropInPence = Math.round(priceDrop);

  return {
    title: `Fuel Price Drop Alert! 🚗`,
    body: `${stationBrand} ${stationName} now at £${priceInPounds}/L (down ${dropInPence}p)`,
    data: {
      stationId,
      newPrice,
      priceDrop,
    },
  };
}
