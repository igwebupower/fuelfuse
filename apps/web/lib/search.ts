// Search service for finding cheapest fuel stations
import { prisma } from './prisma';
import { geocodePostcode } from './geocoding';
import { StationResult, StationDetail, FuelType } from '@fuelfuse/shared';

/**
 * Calculates distance between two coordinates using Haversine formula
 * Returns distance in miles
 * 
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in miles
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Searches for cheapest fuel stations by postcode
 * Requirements: 1.1, 1.5, 1.6, 1.7
 * 
 * @param params - Search parameters with postcode
 * @returns Array of station results sorted by price, then distance
 */
export async function searchByPostcode(params: {
  postcode: string;
  radiusMiles: number;
  fuelType: FuelType;
}): Promise<StationResult[]> {
  // Geocode the postcode (with caching)
  const coords = await geocodePostcode(params.postcode);
  
  // Use the coordinates search
  return searchByCoordinates({
    lat: coords.lat,
    lng: coords.lng,
    radiusMiles: params.radiusMiles,
    fuelType: params.fuelType,
  });
}

/**
 * Searches for cheapest fuel stations by coordinates
 * Requirements: 1.2, 1.7
 * 
 * @param params - Search parameters with coordinates
 * @returns Array of station results sorted by price, then distance
 */
export async function searchByCoordinates(params: {
  lat: number;
  lng: number;
  radiusMiles: number;
  fuelType: FuelType;
}): Promise<StationResult[]> {
  const { lat, lng, radiusMiles, fuelType } = params;
  
  // Fetch all stations with prices
  // Note: In production with PostGIS, we would use ST_DWithin for efficient spatial queries
  // For now, we fetch all stations and filter in memory
  const stations = await prisma.station.findMany({
    include: {
      latestPrice: true,
    },
  });
  
  // Filter stations within radius and with valid price for fuel type
  const priceField = fuelType === 'petrol' ? 'petrolPpl' : 'dieselPpl';
  
  const stationsWithDistance = stations
    .map((station) => {
      const distance = calculateDistance(lat, lng, station.lat, station.lng);
      const price = station.latestPrice?.[priceField];
      
      return {
        station,
        distance,
        price,
      };
    })
    .filter((item) => {
      // Filter by radius and valid price
      return item.distance <= radiusMiles && item.price !== null && item.price !== undefined;
    });
  
  // Sort by price ascending, then distance ascending
  stationsWithDistance.sort((a, b) => {
    if (a.price !== b.price) {
      return (a.price as number) - (b.price as number);
    }
    return a.distance - b.distance;
  });
  
  // Take top 10 results
  const topResults = stationsWithDistance.slice(0, 10);
  
  // Map to StationResult format
  return topResults.map((item) => ({
    stationId: item.station.stationId,
    brand: item.station.brand,
    name: item.station.name,
    address: item.station.address,
    postcode: item.station.postcode,
    pricePerLitre: item.price as number,
    distanceMiles: Math.round(item.distance * 100) / 100, // Round to 2 decimal places
    lastUpdated: item.station.latestPrice!.updatedAtSource,
  }));
}

/**
 * Fetches detailed information for a specific station
 * Requirements: 2.1, 2.2
 * 
 * @param stationId - Source station ID from Fuel Finder
 * @returns Station detail with all fields
 * @throws Error if station not found
 */
export async function getStationDetail(stationId: string): Promise<StationDetail> {
  const station = await prisma.station.findUnique({
    where: { stationId },
    include: {
      latestPrice: true,
    },
  });
  
  if (!station) {
    throw new Error(`Station not found: ${stationId}`);
  }
  
  // For StationDetail, we need to determine which price to show as pricePerLitre
  // We'll use petrol price if available, otherwise diesel
  const pricePerLitre = station.latestPrice?.petrolPpl ?? station.latestPrice?.dieselPpl ?? 0;
  
  return {
    stationId: station.stationId,
    brand: station.brand,
    name: station.name,
    address: station.address,
    postcode: station.postcode,
    lat: station.lat,
    lng: station.lng,
    pricePerLitre,
    distanceMiles: 0, // Distance not applicable for detail view
    lastUpdated: station.latestPrice?.updatedAtSource ?? station.updatedAtSource,
    petrolPrice: station.latestPrice?.petrolPpl ?? null,
    dieselPrice: station.latestPrice?.dieselPpl ?? null,
    amenities: station.amenities as Record<string, any> | null,
    openingHours: station.openingHours as Record<string, any> | null,
  };
}
