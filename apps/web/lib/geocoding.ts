// Geocoding service for postcode normalization and coordinate lookup
import { prisma } from './prisma';
import { Coordinates } from '@fuelfuse/shared';

/**
 * Normalizes a UK postcode to uppercase with standard spacing
 * Requirements: 1.5, 14.1
 * 
 * @param postcode - Raw postcode string (any case, any spacing)
 * @returns Normalized postcode in uppercase with standard spacing
 * 
 * @example
 * normalizePostcode('sw1a 1aa') => 'SW1A 1AA'
 * normalizePostcode('SW1A1AA') => 'SW1A 1AA'
 * normalizePostcode('  sw1a  1aa  ') => 'SW1A 1AA'
 */
export function normalizePostcode(postcode: string): string {
  // Remove all whitespace and convert to uppercase
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase();
  
  // UK postcodes have format: outward code + inward code
  // Inward code is always 3 characters (digit + 2 letters)
  // Insert space before the last 3 characters
  if (cleaned.length < 5) {
    // Too short to be valid, but normalize anyway
    return cleaned;
  }
  
  const inwardCode = cleaned.slice(-3);
  const outwardCode = cleaned.slice(0, -3);
  
  return `${outwardCode} ${inwardCode}`;
}

/**
 * Retrieves cached coordinates for a normalized postcode
 * Requirements: 1.6, 14.4
 * 
 * @param normalizedPostcode - Normalized postcode string
 * @returns Coordinates if found in cache, null otherwise
 */
export async function getCachedCoordinates(
  normalizedPostcode: string
): Promise<Coordinates | null> {
  const cached = await prisma.postcodeGeoCache.findUnique({
    where: { postcodeNormalized: normalizedPostcode },
  });

  if (!cached) {
    return null;
  }

  // Update last_used_at timestamp
  await prisma.postcodeGeoCache.update({
    where: { postcodeNormalized: normalizedPostcode },
    data: { lastUsedAt: new Date() },
  });

  return {
    lat: cached.lat,
    lng: cached.lng,
  };
}

/**
 * Caches coordinates for a normalized postcode
 * Requirements: 14.3
 * 
 * @param normalizedPostcode - Normalized postcode string
 * @param coords - Coordinates to cache
 */
export async function cacheCoordinates(
  normalizedPostcode: string,
  coords: Coordinates
): Promise<void> {
  await prisma.postcodeGeoCache.upsert({
    where: { postcodeNormalized: normalizedPostcode },
    create: {
      postcodeNormalized: normalizedPostcode,
      lat: coords.lat,
      lng: coords.lng,
      lastUsedAt: new Date(),
    },
    update: {
      lat: coords.lat,
      lng: coords.lng,
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Fetches coordinates from postcodes.io API
 * Requirements: 14.2
 * 
 * @param normalizedPostcode - Normalized postcode string
 * @returns Coordinates from external API
 * @throws Error if API request fails or postcode not found
 */
export async function fetchCoordinatesFromAPI(
  normalizedPostcode: string
): Promise<Coordinates> {
  const response = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(normalizedPostcode)}`,
    { signal: AbortSignal.timeout(10000) } // 10 second timeout
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Postcode not found: ${normalizedPostcode}`);
    }
    throw new Error(`Postcodes.io API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.result || !data.result.latitude || !data.result.longitude) {
    throw new Error(`Invalid response from postcodes.io for: ${normalizedPostcode}`);
  }

  return {
    lat: data.result.latitude,
    lng: data.result.longitude,
  };
}

/**
 * Geocodes a postcode to coordinates, using cache when available
 * Requirements: 1.6, 14.2, 14.3, 14.4, 14.5
 * 
 * @param postcode - Raw postcode string (any case, any spacing)
 * @returns Coordinates for the postcode
 * @throws Error if geocoding fails
 */
export async function geocodePostcode(postcode: string): Promise<Coordinates> {
  // Normalize the postcode
  const normalized = normalizePostcode(postcode);

  // Check cache first
  const cached = await getCachedCoordinates(normalized);
  if (cached) {
    return cached;
  }

  // Fetch from API
  const coords = await fetchCoordinatesFromAPI(normalized);

  // Cache the result
  await cacheCoordinates(normalized, coords);

  return coords;
}
