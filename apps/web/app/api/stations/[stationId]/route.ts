// GET /api/stations/:stationId - Get detailed station information
// Requirements: 2.1, 2.2
import { NextRequest, NextResponse } from 'next/server';
import { getStationDetail } from '@/lib/search';
import { rateLimit, SEARCH_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: { stationId: string } }
) {
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
    
    const { stationId } = params;
    
    // Validate stationId is provided
    if (!stationId || stationId.trim() === '') {
      return NextResponse.json(
        { error: 'Station ID is required' },
        { status: 400 }
      );
    }
    
    // Fetch station detail
    const stationDetail = await getStationDetail(stationId);
    
    // Return station detail with rate limit headers
    return NextResponse.json(
      stationDetail,
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
    console.error('Station detail error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Station not found')) {
        return NextResponse.json(
          { error: 'Station not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
