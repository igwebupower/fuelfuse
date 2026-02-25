// POST /api/admin/ingest-csv - CSV fallback ingestion endpoint
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { parseAndValidateCSV } from '@/lib/csv-parser';
import { upsertStationsAndPrices } from '@/lib/ingestion';
import { prisma } from '@/lib/prisma';
import type { IngestionResult } from '@fuelfuse/shared/types';

/**
 * Verify admin secret from request headers
 */
function verifyAdminSecret(request: NextRequest): boolean {
  const adminSecret = request.headers.get('x-admin-secret');
  const expectedSecret = process.env.ADMIN_SECRET;

  if (!expectedSecret) {
    console.error('ADMIN_SECRET environment variable not configured');
    return false;
  }

  return adminSecret === expectedSecret;
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
      errorSummary: result.errors.length > 0 ? { errors: result.errors } : Prisma.JsonNull,
    },
  });
}

/**
 * POST /api/admin/ingest-csv
 * Ingests fuel price data from CSV format
 * Requires x-admin-secret header for authentication
 * Requirements: 7.2, 7.3
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin secret
    if (!verifyAdminSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startedAt = new Date();
    let status: 'success' | 'partial' | 'failed' = 'success';
    let stationsProcessed = 0;
    let pricesUpdated = 0;
    const errors: string[] = [];

    // Get CSV data from request body
    const csvData = await request.text();

    if (!csvData || csvData.trim() === '') {
      return NextResponse.json(
        { error: 'CSV data is required in request body' },
        { status: 400 }
      );
    }

    // Parse and validate CSV
    let stations;
    try {
      stations = parseAndValidateCSV(csvData);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'CSV validation failed',
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 400 }
      );
    }

    if (stations.length === 0) {
      return NextResponse.json(
        { error: 'No valid stations found in CSV' },
        { status: 400 }
      );
    }

    // Upsert stations using same logic as API ingestion
    try {
      const result = await upsertStationsAndPrices(stations);
      stationsProcessed = result.processed;
      pricesUpdated = result.processed; // Each station has prices

      if (result.errors.length > 0) {
        errors.push(...result.errors);
        status = result.processed > 0 ? 'partial' : 'failed';
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Ingestion failed: ${errorMsg}`);
      status = 'failed';
      console.error('CSV ingestion error:', error);
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

    // Return result with appropriate status code
    const statusCode = status === 'success' ? 200 : status === 'partial' ? 207 : 500;

    return NextResponse.json(ingestionResult, { status: statusCode });
  } catch (error) {
    console.error('CSV ingestion endpoint error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
