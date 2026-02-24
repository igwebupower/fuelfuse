// GET /api/search/cheapest - Search for cheapest fuel stations
// Requirements: 1.1, 1.2, 8.2, 8.7
import { NextRequest, NextResponse } from 'next/server';
import { searchParamsSchema } from '@fuelfuse/shared';
import { searchByPostcode, searchByCoordinates } from '@/lib/search';
import { rateLimit, SEARCH_RATE_LIMIT } from '@/lib/rate-limit';
import { buildErrorResponse, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const log = logger.child({ operation: 'search' });
  
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    // Apply rate limiting
    const rateLimitResult = await rateLimit(ip, SEARCH_RATE_LIMIT);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': SEARCH_RATE_LIMIT.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const postcode = searchParams.get('postcode');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radiusMiles = searchParams.get('radiusMiles');
    const fuelType = searchParams.get('fuelType');
    
    // Build params object for validation
    const params: any = {
      fuelType,
      radiusMiles: radiusMiles ? parseFloat(radiusMiles) : undefined,
    };
    
    if (postcode) {
      params.postcode = postcode;
    }
    
    if (lat && lng) {
      params.lat = parseFloat(lat);
      params.lng = parseFloat(lng);
    }
    
    // Validate with Zod
    const validationResult = searchParamsSchema.safeParse(params);
    
    if (!validationResult.success) {
      throw new ValidationError('Invalid search parameters', validationResult.error.errors);
    }
    
    const validatedParams = validationResult.data;
    
    // Execute search based on input type
    let results;
    if (validatedParams.postcode) {
      log.debug('Searching by postcode', { postcode: validatedParams.postcode });
      results = await searchByPostcode({
        postcode: validatedParams.postcode,
        radiusMiles: validatedParams.radiusMiles,
        fuelType: validatedParams.fuelType,
      });
    } else {
      log.debug('Searching by coordinates', { lat: validatedParams.lat, lng: validatedParams.lng });
      results = await searchByCoordinates({
        lat: validatedParams.lat!,
        lng: validatedParams.lng!,
        radiusMiles: validatedParams.radiusMiles,
        fuelType: validatedParams.fuelType,
      });
    }
    
    log.info('Search completed', { resultCount: results.length });
    
    // Return results with rate limit headers
    return NextResponse.json(
      { results },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': SEARCH_RATE_LIMIT.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      }
    );
  } catch (error) {
    return buildErrorResponse(error, { operation: 'search' });
  }
}
