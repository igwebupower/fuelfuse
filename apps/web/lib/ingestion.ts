// Fuel price ingestion service
import { prisma } from './prisma';
import { getOAuthToken } from './oauth';
import { fuelFinderStationSchema } from '@fuelfuse/shared/schemas';
import type { FuelFinderStation, IngestionResult } from '@fuelfuse/shared/types';
import { z } from 'zod';

const FUEL_FINDER_API_URL = process.env.FUEL_FINDER_API_URL || 'https://api.fuelprices.gov.uk';
const FUEL_FINDER_STATIONS_ENDPOINT = `${FUEL_FINDER_API_URL}/v1/stations`;

// API response schema with pagination
const fuelFinderApiResponseSchema = z.object({
  data: z.array(fuelFinderStationSchema),
  pagination: z.object({
    cursor: z.string().optional(),
    hasMore: z.boolean(),
  }).optional(),
});

interface FuelFinderApiResponse {
  data: FuelFinderStation[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (429 or 5xx)
 */
function isRetryableError(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Fetch stations from Fuel Finder API with retry logic
 */
async function fetchStationsFromAPI(token: string, cursor?: string): Promise<FuelFinderApiResponse> {
  const url = new URL(FUEL_FINDER_STATIONS_ENDPOINT);
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check if error is retryable
        if (isRetryableError(response.status) && attempt < maxRetries) {
          // Calculate exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `Fuel Finder API request failed with ${response.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(delayMs);
          continue;
        }
        
        throw new Error(
          `Fuel Finder API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const jsonData = await response.json();
      
      // Validate response with Zod
      const validatedData = fuelFinderApiResponseSchema.parse(jsonData);
      
      return validatedData;
    } catch (error) {
      lastError = error as Error;
      
      // If it's a validation error, don't retry
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid API response format: ${error.message}`);
      }
      
      // If it's a network error and we have retries left, retry with backoff
      if (attempt < maxRetries && !(error instanceof Error && error.message.includes('Fuel Finder API request failed'))) {
        const delayMs = Math.pow(2, attempt) * 1000;
        console.warn(
          `Fuel Finder API request error: ${error}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(delayMs);
        continue;
      }
      
      throw error;
    }
  }

  throw lastError || new Error('Fuel Finder API request failed after retries');
}

/**
 * Fetch all stations from Fuel Finder API, handling pagination
 */
async function fetchAllStations(token: string): Promise<FuelFinderStation[]> {
  const allStations: FuelFinderStation[] = [];
  let cursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchStationsFromAPI(token, cursor);
    allStations.push(...response.data);
    
    if (response.pagination) {
      cursor = response.pagination.cursor;
      hasMore = response.pagination.hasMore;
    } else {
      hasMore = false;
    }
  }

  return allStations;
}

/**
 * Upsert a single station and its prices in a transaction
 */
async function upsertStation(station: FuelFinderStation): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Upsert station by stationId
    const upsertedStation = await tx.station.upsert({
      where: { stationId: station.stationId },
      create: {
        stationId: station.stationId,
        brand: station.brand,
        name: station.name,
        address: station.address,
        postcode: station.postcode,
        lat: station.lat,
        lng: station.lng,
        amenities: station.amenities || null,
        openingHours: station.openingHours || null,
        updatedAtSource: station.updatedAt,
      },
      update: {
        brand: station.brand,
        name: station.name,
        address: station.address,
        postcode: station.postcode,
        lat: station.lat,
        lng: station.lng,
        amenities: station.amenities || null,
        openingHours: station.openingHours || null,
        updatedAtSource: station.updatedAt,
      },
    });

    // Convert prices from pounds to pence if needed (assuming API returns pence)
    const petrolPpl = station.petrolPrice !== null ? Math.round(station.petrolPrice) : null;
    const dieselPpl = station.dieselPrice !== null ? Math.round(station.dieselPrice) : null;

    // Upsert station_prices_latest
    await tx.stationPriceLatest.upsert({
      where: { stationId: upsertedStation.id },
      create: {
        stationId: upsertedStation.id,
        petrolPpl,
        dieselPpl,
        updatedAtSource: station.updatedAt,
      },
      update: {
        petrolPpl,
        dieselPpl,
        updatedAtSource: station.updatedAt,
      },
    });

    // Insert into station_prices_history only if not already exists
    // Check for existing entry to prevent unique constraint violations
    const existingHistory = await tx.stationPriceHistory.findFirst({
      where: {
        stationId: upsertedStation.id,
        updatedAtSource: station.updatedAt,
      },
    });

    if (!existingHistory) {
      await tx.stationPriceHistory.create({
        data: {
          stationId: upsertedStation.id,
          petrolPpl,
          dieselPpl,
          updatedAtSource: station.updatedAt,
        },
      });
    }
  });
}

/**
 * Upsert multiple stations with their prices
 */
async function upsertStations(stations: FuelFinderStation[]): Promise<{ processed: number; errors: string[] }> {
  let processed = 0;
  const errors: string[] = [];

  for (const station of stations) {
    try {
      await upsertStation(station);
      processed++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to upsert station ${station.stationId}: ${errorMsg}`);
      console.error(`Error upserting station ${station.stationId}:`, error);
    }
  }

  return { processed, errors };
}

/**
 * Record ingestion run metadata in the database
 */
async function recordIngestionRun(result: IngestionResult): Promise<void> {
  await prisma.ingestionRun.create({
    data: {
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      status: result.status,
      counts: {
        stationsProcessed: result.stationsProcessed,
        pricesUpdated: result.pricesUpdated,
        errorsCount: result.errors.length,
      },
      errorSummary: result.errors.length > 0 ? { errors: result.errors } : null,
    },
  });
}

/**
 * Run the fuel price ingestion job
 * Fetches stations from Fuel Finder API and upserts them into the database
 */
export async function runFuelSync(): Promise<IngestionResult> {
  const startedAt = new Date();
  let status: 'success' | 'partial' | 'failed' = 'success';
  let stationsProcessed = 0;
  let pricesUpdated = 0;
  const errors: string[] = [];

  try {
    // Get OAuth token
    const token = await getOAuthToken();

    // Fetch all stations from API
    const stations = await fetchAllStations(token);

    if (stations.length === 0) {
      console.warn('No stations returned from Fuel Finder API');
      status = 'partial';
      errors.push('No stations returned from API');
    } else {
      // Upsert stations
      const result = await upsertStations(stations);
      stationsProcessed = result.processed;
      pricesUpdated = result.processed; // Each station has prices
      
      if (result.errors.length > 0) {
        errors.push(...result.errors);
        status = result.processed > 0 ? 'partial' : 'failed';
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(`Ingestion failed: ${errorMsg}`);
    status = 'failed';
    console.error('Fuel sync error:', error);
  }

  const finishedAt = new Date();
  const ingestionResult: IngestionResult = {
    status,
    stationsProcessed,
    pricesUpdated,
    errors,
    startedAt,
    finishedAt,
  };

  // Record the ingestion run
  try {
    await recordIngestionRun(ingestionResult);
  } catch (error) {
    console.error('Failed to record ingestion run:', error);
    // Don't fail the entire ingestion if recording fails
  }

  return ingestionResult;
}
