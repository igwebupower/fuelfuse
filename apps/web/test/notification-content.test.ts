// Feature: fuelfuse-mvp, Property 11: Alert notifications contain required information
// Validates: Requirements 4.4

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { createAlertNotification } from '../lib/push-notification';

describe('Notification Content - Property 11: Alert notifications contain required information', () => {
  test('notification contains station name, new price, and price drop', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate station name
        fc.string({ minLength: 3, maxLength: 50 }),
        // Generate station brand
        fc.string({ minLength: 2, maxLength: 30 }),
        // Generate new price (in pence per litre)
        fc.integer({ min: 100, max: 200 }),
        // Generate price drop (in pence per litre)
        fc.integer({ min: 1, max: 50 }),
        // Generate station ID
        fc.string({ minLength: 5, maxLength: 30 }),
        async (stationName, stationBrand, newPrice, priceDrop, stationId) => {
          // Create alert notification
          const notification = createAlertNotification(
            stationName,
            stationBrand,
            newPrice,
            priceDrop,
            stationId
          );

          // Verify notification structure
          expect(notification).toHaveProperty('title');
          expect(notification).toHaveProperty('body');
          expect(notification).toHaveProperty('data');

          // Verify title is not empty
          expect(notification.title).toBeTruthy();
          expect(notification.title.length).toBeGreaterThan(0);

          // Verify body contains station name
          expect(notification.body).toContain(stationName);

          // Verify body contains price information (formatted as £X.XX or Xp)
          const priceInPounds = (newPrice / 100).toFixed(2);
          const priceDropInPence = Math.round(priceDrop);
          
          // Body should contain either the formatted price or price drop
          const bodyContainsPriceInfo = 
            notification.body.includes(priceInPounds) || 
            notification.body.includes(`${priceDropInPence}p`);
          expect(bodyContainsPriceInfo).toBe(true);

          // Verify data object contains required fields
          expect(notification.data).toHaveProperty('stationId');
          expect(notification.data).toHaveProperty('newPrice');
          expect(notification.data).toHaveProperty('priceDrop');

          // Verify data values match inputs
          expect(notification.data.stationId).toBe(stationId);
          expect(notification.data.newPrice).toBe(newPrice);
          expect(notification.data.priceDrop).toBe(priceDrop);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('notification format is consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate station name
        fc.string({ minLength: 3, maxLength: 50 }),
        // Generate station brand
        fc.string({ minLength: 2, maxLength: 30 }),
        // Generate new price
        fc.integer({ min: 100, max: 200 }),
        // Generate price drop
        fc.integer({ min: 1, max: 50 }),
        // Generate station ID
        fc.string({ minLength: 5, maxLength: 30 }),
        async (stationName, stationBrand, newPrice, priceDrop, stationId) => {
          // Create alert notification
          const notification = createAlertNotification(
            stationName,
            stationBrand,
            newPrice,
            priceDrop,
            stationId
          );

          // Verify title format
          expect(notification.title).toMatch(/alert/i); // Contains "alert" (case insensitive)

          // Verify body format includes price indicators
          expect(notification.body).toMatch(/p\/L|p/i); // Contains price unit indicator

          // Verify body format includes drop indicator
          expect(notification.body).toMatch(/down|drop/i); // Contains drop indicator
        }
      ),
      { numRuns: 20 }
    );
  });

  test('notification handles edge cases', async () => {
    // Test with minimum values
    const minNotification = createAlertNotification(
      'A', // Minimum station name
      'B', // Minimum brand
      100, // Minimum price
      1, // Minimum drop
      'id'
    );

    expect(minNotification.title).toBeTruthy();
    expect(minNotification.body).toContain('A');
    expect(minNotification.body).toContain('£1.00'); // Formatted price
    expect(minNotification.body).toContain('1p'); // Price drop in pence
    expect(minNotification.data.stationId).toBe('id');
    expect(minNotification.data.newPrice).toBe(100);
    expect(minNotification.data.priceDrop).toBe(1);

    // Test with maximum values
    const maxNotification = createAlertNotification(
      'Very Long Station Name With Many Words',
      'Brand',
      200,
      50,
      'very-long-station-id-12345'
    );

    expect(maxNotification.title).toBeTruthy();
    expect(maxNotification.body).toContain('Very Long Station Name With Many Words');
    expect(maxNotification.body).toContain('£2.00'); // Formatted price
    expect(maxNotification.body).toContain('50p'); // Price drop in pence
    expect(maxNotification.data.stationId).toBe('very-long-station-id-12345');
    expect(maxNotification.data.newPrice).toBe(200);
    expect(maxNotification.data.priceDrop).toBe(50);

    // Test with special characters in station name
    const specialNotification = createAlertNotification(
      "King's Road",
      'Shell',
      150,
      10,
      'station-123'
    );

    expect(specialNotification.title).toBeTruthy();
    expect(specialNotification.body).toContain("King's Road");
    expect(specialNotification.data.stationId).toBe('station-123');
  });

  test('notification data is JSON serializable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 50 }),
        fc.integer({ min: 100, max: 200 }),
        fc.integer({ min: 1, max: 50 }),
        fc.string({ minLength: 5, maxLength: 30 }),
        async (stationName, newPrice, priceDrop, stationId) => {
          const notification = createAlertNotification(
            stationName,
            newPrice,
            priceDrop,
            stationId
          );

          // Verify notification can be serialized to JSON
          const json = JSON.stringify(notification);
          expect(json).toBeTruthy();

          // Verify notification can be deserialized from JSON
          const parsed = JSON.parse(json);
          expect(parsed.title).toBe(notification.title);
          expect(parsed.body).toBe(notification.body);
          expect(parsed.data.stationId).toBe(notification.data.stationId);
          expect(parsed.data.newPrice).toBe(notification.data.newPrice);
          expect(parsed.data.priceDrop).toBe(notification.data.priceDrop);
        }
      ),
      { numRuns: 20 }
    );
  });
});
