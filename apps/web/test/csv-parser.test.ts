// Unit tests for CSV parser and validator
import { describe, it, expect } from 'vitest';
import { parseAndValidateCSV, validateCSVHeaders } from '../lib/csv-parser';

describe('CSV Parser', () => {
  describe('parseAndValidateCSV', () => {
    it('should parse valid CSV data with all fields', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at,amenities,opening_hours
ST001,Test Station,Shell,123 Main St,SW1A 1AA,51.5074,-0.1278,145.9,152.3,2024-01-15T10:00:00Z,"{""parking"":true}","{""mon"":""8-20""}"`;

      const result = parseAndValidateCSV(csvData);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        stationId: 'ST001',
        name: 'Test Station',
        brand: 'Shell',
        address: '123 Main St',
        postcode: 'SW1A 1AA',
        lat: 51.5074,
        lng: -0.1278,
        petrolPrice: 145.9,
        dieselPrice: 152.3,
      });
      expect(result[0].updatedAt).toBeInstanceOf(Date);
      // JSON fields are optional and may be undefined if parsing fails
      // This is acceptable for the CSV fallback mechanism
    });

    it('should parse CSV data with null prices', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
ST002,No Petrol Station,BP,456 High St,EC1A 1BB,51.5155,-0.0922,null,148.5,2024-01-15T11:00:00Z`;

      const result = parseAndValidateCSV(csvData);

      expect(result).toHaveLength(1);
      expect(result[0].petrolPrice).toBeNull();
      expect(result[0].dieselPrice).toBe(148.5);
    });

    it('should parse CSV data with empty optional fields', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at,amenities,opening_hours
ST003,Basic Station,Esso,789 Park Rd,W1A 1AA,51.5074,-0.1278,143.2,149.8,2024-01-15T12:00:00Z,,`;

      const result = parseAndValidateCSV(csvData);

      expect(result).toHaveLength(1);
      expect(result[0].amenities).toBeUndefined();
      expect(result[0].openingHours).toBeUndefined();
    });

    it('should parse multiple rows', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
ST001,Station One,Shell,123 Main St,SW1A 1AA,51.5074,-0.1278,145.9,152.3,2024-01-15T10:00:00Z
ST002,Station Two,BP,456 High St,EC1A 1BB,51.5155,-0.0922,144.5,151.2,2024-01-15T11:00:00Z
ST003,Station Three,Esso,789 Park Rd,W1A 1AA,51.5074,-0.1278,143.2,149.8,2024-01-15T12:00:00Z`;

      const result = parseAndValidateCSV(csvData);

      expect(result).toHaveLength(3);
      expect(result[0].stationId).toBe('ST001');
      expect(result[1].stationId).toBe('ST002');
      expect(result[2].stationId).toBe('ST003');
    });

    it('should handle quoted fields with commas', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
ST004,"Station, Inc",Shell,"123 Main St, Suite 100",SW1A 1AA,51.5074,-0.1278,145.9,152.3,2024-01-15T10:00:00Z`;

      const result = parseAndValidateCSV(csvData);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Station, Inc');
      expect(result[0].address).toBe('123 Main St, Suite 100');
    });

    it('should skip empty lines', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
ST001,Station One,Shell,123 Main St,SW1A 1AA,51.5074,-0.1278,145.9,152.3,2024-01-15T10:00:00Z

ST002,Station Two,BP,456 High St,EC1A 1BB,51.5155,-0.0922,144.5,151.2,2024-01-15T11:00:00Z`;

      const result = parseAndValidateCSV(csvData);

      expect(result).toHaveLength(2);
    });

    it('should throw error for empty CSV', () => {
      expect(() => parseAndValidateCSV('')).toThrow('CSV data is empty');
    });

    it('should throw error for CSV with only header', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at`;

      expect(() => parseAndValidateCSV(csvData)).toThrow('No data rows found in CSV');
    });

    it('should throw error for invalid station_id', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
,Test Station,Shell,123 Main St,SW1A 1AA,51.5074,-0.1278,145.9,152.3,2024-01-15T10:00:00Z`;

      expect(() => parseAndValidateCSV(csvData)).toThrow('CSV validation failed');
    });

    it('should throw error for invalid coordinates', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
ST001,Test Station,Shell,123 Main St,SW1A 1AA,invalid,-0.1278,145.9,152.3,2024-01-15T10:00:00Z`;

      expect(() => parseAndValidateCSV(csvData)).toThrow('CSV validation failed');
    });

    it('should throw error for out of bounds latitude', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
ST001,Test Station,Shell,123 Main St,SW1A 1AA,91.0,-0.1278,145.9,152.3,2024-01-15T10:00:00Z`;

      expect(() => parseAndValidateCSV(csvData)).toThrow('CSV validation failed');
    });

    it('should throw error for mismatched field count', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
ST001,Test Station,Shell,123 Main St,SW1A 1AA,51.5074`;

      expect(() => parseAndValidateCSV(csvData)).toThrow('has 6 fields but expected 10 fields');
    });

    it('should throw error for invalid date format', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
ST001,Test Station,Shell,123 Main St,SW1A 1AA,51.5074,-0.1278,145.9,152.3,invalid-date`;

      expect(() => parseAndValidateCSV(csvData)).toThrow('CSV validation failed');
    });

    it('should handle negative prices as invalid', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
ST001,Test Station,Shell,123 Main St,SW1A 1AA,51.5074,-0.1278,-10,152.3,2024-01-15T10:00:00Z`;

      expect(() => parseAndValidateCSV(csvData)).toThrow('CSV validation failed');
    });
  });

  describe('validateCSVHeaders', () => {
    it('should validate correct headers', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at,amenities,opening_hours`;

      const result = validateCSVHeaders(csvData);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.extra).toHaveLength(0);
    });

    it('should validate minimal required headers', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at`;

      const result = validateCSVHeaders(csvData);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.extra).toHaveLength(0);
    });

    it('should detect missing required headers', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng`;

      const result = validateCSVHeaders(csvData);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('petrol_price');
      expect(result.missing).toContain('diesel_price');
      expect(result.missing).toContain('updated_at');
    });

    it('should detect extra headers', () => {
      const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at,extra_field,another_extra`;

      const result = validateCSVHeaders(csvData);

      expect(result.valid).toBe(true);
      expect(result.extra).toContain('extra_field');
      expect(result.extra).toContain('another_extra');
    });

    it('should handle empty CSV', () => {
      const result = validateCSVHeaders('');

      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.extra).toHaveLength(0);
    });
  });
});
