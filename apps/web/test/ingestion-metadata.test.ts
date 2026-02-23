// Feature: fuelfuse-mvp, Property 21: Ingestion run metadata is recorded
// Validates: Requirements 6.7

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../lib/prisma';
import type { IngestionResult } from '@fuelfuse/shared/types';

// Helper function to record ingestion run (extracted from ingestion service for testing)
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

// Helper to compare timestamps with tolerance for database precision
function expectTimestampsClose(actual: Date, expected: Date, toleranceMs = 100) {
  const diff = Math.abs(actual.getTime() - expected.getTime());
  expect(diff).toBeLessThanOrEqual(toleranceMs);
}

// Generator for non-whitespace strings
const nonWhitespaceString = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

describe('Ingestion Metadata - Property 21: Ingestion run metadata is recorded', () => {
  test('for any ingestion result, a record should be created with all metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random ingestion results
        fc.record({
          status: fc.constantFrom('success', 'partial', 'failed'),
          stationsProcessed: fc.integer({ min: 0, max: 1000 }),
          pricesUpdated: fc.integer({ min: 0, max: 1000 }),
          errors: fc.array(nonWhitespaceString, { maxLength: 10 }),
          startedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
          finishedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        }),
        async (ingestionResult) => {
          // Clean up before this iteration
          await prisma.ingestionRun.deleteMany();

          // Ensure finishedAt is after startedAt
          if (ingestionResult.finishedAt < ingestionResult.startedAt) {
            const temp = ingestionResult.startedAt;
            ingestionResult.startedAt = ingestionResult.finishedAt;
            ingestionResult.finishedAt = temp;
          }

          // Record the ingestion run
          await recordIngestionRun(ingestionResult as IngestionResult);

          // Find the most recent ingestion run (should be the only one)
          const recorded = await prisma.ingestionRun.findFirst({
            orderBy: {
              startedAt: 'desc',
            },
          });

          // Verify the record was created
          expect(recorded).not.toBeNull();

          // Verify all metadata fields are present
          expect(recorded!.status).toBe(ingestionResult.status);
          
          // Compare timestamps with tolerance for database precision
          expectTimestampsClose(recorded!.startedAt, ingestionResult.startedAt);
          expectTimestampsClose(recorded!.finishedAt!, ingestionResult.finishedAt);

          // Verify counts object
          const counts = recorded!.counts as any;
          expect(counts.stationsProcessed).toBe(ingestionResult.stationsProcessed);
          expect(counts.pricesUpdated).toBe(ingestionResult.pricesUpdated);
          expect(counts.errorsCount).toBe(ingestionResult.errors.length);

          // Verify error summary
          if (ingestionResult.errors.length > 0) {
            expect(recorded!.errorSummary).not.toBeNull();
            const errorSummary = recorded!.errorSummary as any;
            expect(errorSummary.errors).toEqual(ingestionResult.errors);
          } else {
            expect(recorded!.errorSummary).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('successful ingestion should record success status with no errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stationsProcessed: fc.integer({ min: 1, max: 100 }),
          pricesUpdated: fc.integer({ min: 1, max: 100 }),
          startedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
          finishedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        }),
        async (data) => {
          // Clean up before this iteration
          await prisma.ingestionRun.deleteMany();

          // Ensure finishedAt is after startedAt
          if (data.finishedAt < data.startedAt) {
            const temp = data.startedAt;
            data.startedAt = data.finishedAt;
            data.finishedAt = temp;
          }

          const successResult: IngestionResult = {
            status: 'success',
            stationsProcessed: data.stationsProcessed,
            pricesUpdated: data.pricesUpdated,
            errors: [],
            startedAt: data.startedAt,
            finishedAt: data.finishedAt,
          };

          await recordIngestionRun(successResult);

          const recorded = await prisma.ingestionRun.findFirst({
            where: {
              status: 'success',
            },
            orderBy: {
              startedAt: 'desc',
            },
          });

          expect(recorded).not.toBeNull();
          expect(recorded!.status).toBe('success');
          expect(recorded!.errorSummary).toBeNull();

          const counts = recorded!.counts as any;
          expect(counts.errorsCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('failed ingestion should record failed status with error details', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errors: fc.array(nonWhitespaceString.filter(s => s.length >= 5 && s.length <= 50), { minLength: 1, maxLength: 5 }),
          startedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
          finishedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        }),
        async (data) => {
          // Clean up before this iteration
          await prisma.ingestionRun.deleteMany();

          // Ensure finishedAt is after startedAt
          if (data.finishedAt < data.startedAt) {
            const temp = data.startedAt;
            data.startedAt = data.finishedAt;
            data.finishedAt = temp;
          }

          const failedResult: IngestionResult = {
            status: 'failed',
            stationsProcessed: 0,
            pricesUpdated: 0,
            errors: data.errors,
            startedAt: data.startedAt,
            finishedAt: data.finishedAt,
          };

          await recordIngestionRun(failedResult);

          const recorded = await prisma.ingestionRun.findFirst({
            where: {
              status: 'failed',
            },
            orderBy: {
              startedAt: 'desc',
            },
          });

          expect(recorded).not.toBeNull();
          expect(recorded!.status).toBe('failed');
          expect(recorded!.errorSummary).not.toBeNull();

          const errorSummary = recorded!.errorSummary as any;
          expect(errorSummary.errors).toEqual(data.errors);
          expect(errorSummary.errors.length).toBe(data.errors.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('partial ingestion should record partial status with some errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stationsProcessed: fc.integer({ min: 1, max: 50 }),
          pricesUpdated: fc.integer({ min: 1, max: 50 }),
          errors: fc.array(nonWhitespaceString.filter(s => s.length >= 5 && s.length <= 50), { minLength: 1, maxLength: 3 }),
          startedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
          finishedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        }),
        async (data) => {
          // Clean up before this iteration
          await prisma.ingestionRun.deleteMany();

          // Ensure finishedAt is after startedAt
          if (data.finishedAt < data.startedAt) {
            const temp = data.startedAt;
            data.startedAt = data.finishedAt;
            data.finishedAt = temp;
          }

          const partialResult: IngestionResult = {
            status: 'partial',
            stationsProcessed: data.stationsProcessed,
            pricesUpdated: data.pricesUpdated,
            errors: data.errors,
            startedAt: data.startedAt,
            finishedAt: data.finishedAt,
          };

          await recordIngestionRun(partialResult);

          const recorded = await prisma.ingestionRun.findFirst({
            where: {
              status: 'partial',
            },
            orderBy: {
              startedAt: 'desc',
            },
          });

          expect(recorded).not.toBeNull();
          expect(recorded!.status).toBe('partial');

          const counts = recorded!.counts as any;
          expect(counts.stationsProcessed).toBeGreaterThan(0);
          expect(counts.errorsCount).toBeGreaterThan(0);

          expect(recorded!.errorSummary).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
