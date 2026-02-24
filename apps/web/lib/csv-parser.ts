// CSV parser and validator for fuel price data fallback
import { fuelFinderStationSchema } from '@fuelfuse/shared/schemas';
import type { FuelFinderStation } from '@fuelfuse/shared/types';
import { z } from 'zod';

/**
 * CSV row schema for station and price data
 * Expected CSV format:
 * station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at,amenities,opening_hours
 */
const csvRowSchema = z.object({
  station_id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  address: z.string().min(1),
  postcode: z.string().min(1),
  lat: z.string().transform((val) => parseFloat(val)),
  lng: z.string().transform((val) => parseFloat(val)),
  petrol_price: z.string().transform((val) => val === '' || val === 'null' ? null : parseFloat(val)),
  diesel_price: z.string().transform((val) => val === '' || val === 'null' ? null : parseFloat(val)),
  updated_at: z.string().transform((val) => new Date(val)),
  amenities: z.string().optional().transform((val) => {
    if (!val || val === '' || val === 'null') return undefined;
    try {
      // Remove surrounding quotes if present
      const cleaned = val.replace(/^"(.*)"$/, '$1');
      return JSON.parse(cleaned);
    } catch {
      return undefined;
    }
  }),
  opening_hours: z.string().optional().transform((val) => {
    if (!val || val === '' || val === 'null') return undefined;
    try {
      // Remove surrounding quotes if present
      const cleaned = val.replace(/^"(.*)"$/, '$1');
      return JSON.parse(cleaned);
    } catch {
      return undefined;
    }
  }),
});

/**
 * Parse a single CSV line into fields, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Toggle quote state
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // End of field
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Add the last field
  fields.push(currentField.trim());

  return fields;
}

/**
 * Parse CSV data into an array of objects
 */
function parseCSV(csvData: string): Record<string, string>[] {
  const trimmed = csvData.trim();
  
  if (trimmed === '') {
    throw new Error('CSV data is empty');
  }

  const lines = trimmed.split('\n');

  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  if (headers.length === 0) {
    throw new Error('CSV header is empty');
  }

  // Parse data rows
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line === '') {
      continue;
    }

    const fields = parseCSVLine(line);
    
    if (fields.length !== headers.length) {
      throw new Error(
        `Row ${i + 1} has ${fields.length} fields but expected ${headers.length} fields`
      );
    }

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j];
    }
    
    rows.push(row);
  }

  return rows;
}

/**
 * Parse and validate CSV data containing station and price information
 * Returns an array of FuelFinderStation objects that can be used with the ingestion service
 */
export function parseAndValidateCSV(csvData: string): FuelFinderStation[] {
  // Parse CSV into raw objects
  const rawRows = parseCSV(csvData);

  if (rawRows.length === 0) {
    throw new Error('No data rows found in CSV');
  }

  const stations: FuelFinderStation[] = [];
  const errors: string[] = [];

  // Validate and transform each row
  for (let i = 0; i < rawRows.length; i++) {
    try {
      // Parse and validate CSV row
      const parsedRow = csvRowSchema.parse(rawRows[i]);

      // Transform to FuelFinderStation format
      const station: FuelFinderStation = {
        stationId: parsedRow.station_id,
        brand: parsedRow.brand,
        name: parsedRow.name,
        address: parsedRow.address,
        postcode: parsedRow.postcode,
        lat: parsedRow.lat,
        lng: parsedRow.lng,
        petrolPrice: parsedRow.petrol_price,
        dieselPrice: parsedRow.diesel_price,
        updatedAt: parsedRow.updated_at,
        amenities: parsedRow.amenities,
        openingHours: parsedRow.opening_hours,
      };

      // Validate against FuelFinderStation schema
      const validatedStation = fuelFinderStationSchema.parse(station);
      stations.push(validatedStation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(`Row ${i + 2}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      } else {
        errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // If there are validation errors, throw with details
  if (errors.length > 0) {
    throw new Error(`CSV validation failed:\n${errors.join('\n')}`);
  }

  return stations;
}

/**
 * Validate CSV headers to ensure all required fields are present
 */
export function validateCSVHeaders(csvData: string): { valid: boolean; missing: string[]; extra: string[] } {
  const trimmed = csvData.trim();
  
  if (trimmed === '') {
    const requiredHeaders = [
      'station_id',
      'name',
      'brand',
      'address',
      'postcode',
      'lat',
      'lng',
      'petrol_price',
      'diesel_price',
      'updated_at',
    ];
    return { valid: false, missing: requiredHeaders, extra: [] };
  }

  const lines = trimmed.split('\n');
  const headers = parseCSVLine(lines[0]);
  const requiredHeaders = [
    'station_id',
    'name',
    'brand',
    'address',
    'postcode',
    'lat',
    'lng',
    'petrol_price',
    'diesel_price',
    'updated_at',
  ];

  const optionalHeaders = ['amenities', 'opening_hours'];
  const allValidHeaders = [...requiredHeaders, ...optionalHeaders];

  const missing = requiredHeaders.filter(h => !headers.includes(h));
  const extra = headers.filter(h => !allValidHeaders.includes(h));

  return {
    valid: missing.length === 0,
    missing,
    extra,
  };
}
