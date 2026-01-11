/**
 * Analytics Helper Functions - Unit Tests
 *
 * Tests the Zero-Any policy compliance helpers:
 * - safeParseFloat(): Handles NaN edge cases correctly
 * - toDate(): Converts polymorphic date types safely
 *
 * Test Strategy:
 * 1. Edge case coverage (undefined, null, NaN, invalid strings)
 * 2. Data loss verification
 * 3. Type conversion correctness
 * 4. Firestore Timestamp compatibility
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Safe parseFloat that handles NaN correctly.
 * parseFloat(undefined) returns NaN, and NaN ?? fallback returns NaN (not the fallback).
 * This function properly returns the fallback when the input cannot be parsed.
 */
function safeParseFloat(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely converts polymorphic date values (Firestore Timestamp, Date, string, number) to Date.
 * Falls back to current date if conversion fails.
 */
function toDate(value: unknown): Date {
  if (!value) {
    return new Date();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  return new Date();
}

describe('Analytics Helper Functions', () => {
  describe('safeParseFloat()', () => {
    describe('Valid Number Inputs', () => {
      it('should return the number when passed a valid number', () => {
        expect(safeParseFloat(42, 0)).toBe(42);
        expect(safeParseFloat(3.14159, 0)).toBe(3.14159);
        expect(safeParseFloat(-100, 0)).toBe(-100);
        expect(safeParseFloat(0, 99)).toBe(0);
      });

      it('should parse valid numeric strings', () => {
        expect(safeParseFloat('42', 0)).toBe(42);
        expect(safeParseFloat('3.14', 0)).toBe(3.14);
        expect(safeParseFloat('-100', 0)).toBe(-100);
        expect(safeParseFloat('0', 99)).toBe(0);
      });

      it('should handle scientific notation', () => {
        expect(safeParseFloat('1e3', 0)).toBe(1000);
        expect(safeParseFloat('1.5e2', 0)).toBe(150);
        expect(safeParseFloat(1e3, 0)).toBe(1000);
      });

      it('should handle partial numeric strings', () => {
        // parseFloat('123abc') returns 123
        expect(safeParseFloat('123abc', 0)).toBe(123);
        expect(safeParseFloat('45.67xyz', 0)).toBe(45.67);
      });
    });

    describe('Edge Cases - Null/Undefined', () => {
      it('should return fallback when value is undefined', () => {
        expect(safeParseFloat(undefined, 0)).toBe(0);
        expect(safeParseFloat(undefined, 100)).toBe(100);
        expect(safeParseFloat(undefined, -50)).toBe(-50);
      });

      it('should return fallback when value is null', () => {
        expect(safeParseFloat(null, 0)).toBe(0);
        expect(safeParseFloat(null, 100)).toBe(100);
        expect(safeParseFloat(null, -50)).toBe(-50);
      });

      it('should NOT lose data - fallback must be returned, not NaN', () => {
        const result1 = safeParseFloat(undefined, 0);
        expect(result1).toBe(0);
        expect(isNaN(result1)).toBe(false);

        const result2 = safeParseFloat(null, 0);
        expect(result2).toBe(0);
        expect(isNaN(result2)).toBe(false);
      });
    });

    describe('Edge Cases - Invalid Strings', () => {
      it('should return fallback when string is not numeric', () => {
        expect(safeParseFloat('invalid', 0)).toBe(0);
        expect(safeParseFloat('abc', 100)).toBe(100);
        expect(safeParseFloat('', 50)).toBe(50);
        expect(safeParseFloat('   ', 25)).toBe(25);
      });

      it('should return fallback when string is NaN', () => {
        expect(safeParseFloat('NaN', 0)).toBe(0);
        expect(safeParseFloat('not a number', 100)).toBe(100);
      });

      it('should NOT lose data - invalid strings must return fallback', () => {
        const result1 = safeParseFloat('invalid', 0);
        expect(result1).toBe(0);
        expect(isNaN(result1)).toBe(false);

        const result2 = safeParseFloat('', 0);
        expect(result2).toBe(0);
        expect(isNaN(result2)).toBe(false);
      });
    });

    describe('Edge Cases - Special Values', () => {
      it('should handle boolean values by converting to string first', () => {
        // Booleans are converted to string: String(true) = "true", String(false) = "false"
        // parseFloat("true") = NaN, parseFloat("false") = NaN
        expect(safeParseFloat(true, 0)).toBe(0); // NaN fallback
        expect(safeParseFloat(false, 0)).toBe(0); // NaN fallback
      });

      it('should handle objects', () => {
        expect(safeParseFloat({}, 0)).toBe(0);
        expect(safeParseFloat({ value: 42 }, 0)).toBe(0);
      });

      it('should handle arrays', () => {
        expect(safeParseFloat([], 0)).toBe(0);
        expect(safeParseFloat([42], 0)).toBe(42);
        expect(safeParseFloat([1, 2, 3], 0)).toBe(1);
      });

      it('should handle Infinity', () => {
        expect(safeParseFloat(Infinity, 0)).toBe(Infinity);
        expect(safeParseFloat(-Infinity, 0)).toBe(-Infinity);
        expect(safeParseFloat('Infinity', 0)).toBe(Infinity);
      });
    });

    describe('Data Loss Scenarios', () => {
      it('CRITICAL: safeParseFloat(undefined, 0) must return 0, not NaN', () => {
        const result = safeParseFloat(undefined, 0);
        expect(result).toBe(0);
        expect(typeof result).toBe('number');
        expect(isNaN(result)).toBe(false);
      });

      it('CRITICAL: safeParseFloat("invalid", 0) must return 0, not NaN', () => {
        const result = safeParseFloat('invalid', 0);
        expect(result).toBe(0);
        expect(typeof result).toBe('number');
        expect(isNaN(result)).toBe(false);
      });

      it('CRITICAL: NaN should never be returned when fallback is provided', () => {
        const testCases = [
          undefined,
          null,
          'invalid',
          '',
          '   ',
          'NaN',
          'not a number',
          {},
          { value: 42 },
        ];

        testCases.forEach((testCase) => {
          const result = safeParseFloat(testCase, 0);
          expect(isNaN(result)).toBe(false);
        });
      });

      it('should preserve fallback precision', () => {
        expect(safeParseFloat(undefined, 3.14159)).toBe(3.14159);
        expect(safeParseFloat(null, 0.00001)).toBe(0.00001);
        expect(safeParseFloat('invalid', -99.999)).toBe(-99.999);
      });
    });

    describe('Real-World Analytics Scenarios', () => {
      it('should handle Firestore string amounts', () => {
        expect(safeParseFloat('1500.50', 0)).toBe(1500.50);
        expect(safeParseFloat('0.00', 0)).toBe(0);
      });

      it('should handle missing deal values', () => {
        const dealValue = undefined;
        const totalValue = safeParseFloat(dealValue, 0);
        expect(totalValue).toBe(0);
      });

      it('should handle probability percentages', () => {
        expect(safeParseFloat('75', 0)).toBe(75);
        expect(safeParseFloat(0.75, 0)).toBe(0.75);
        expect(safeParseFloat(undefined, 50)).toBe(50);
      });
    });
  });

  describe('toDate()', () => {
    describe('Valid Date Inputs', () => {
      it('should return the Date when passed a valid Date object', () => {
        const now = new Date();
        const result = toDate(now);
        expect(result).toBe(now);
        expect(result instanceof Date).toBe(true);
      });

      it('should parse valid date strings', () => {
        const result1 = toDate('2024-01-15T00:00:00Z'); // Use ISO format with time to avoid timezone issues
        expect(result1 instanceof Date).toBe(true);
        expect(result1.getFullYear()).toBe(2024);
        expect(result1.getUTCMonth()).toBe(0); // January is 0 (use UTC to avoid timezone offset)
        expect(result1.getUTCDate()).toBe(15); // Use UTC date

        const result2 = toDate('2024-12-31T23:59:59Z');
        expect(result2 instanceof Date).toBe(true);
        expect(result2.getFullYear()).toBe(2024);
      });

      it('should parse numeric timestamps', () => {
        const timestamp = 1705334400000; // 2024-01-15 12:00:00 GMT
        const result = toDate(timestamp);
        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBe(timestamp);
      });
    });

    describe('Firestore Timestamp Compatibility', () => {
      it('should convert Firestore Timestamp objects', () => {
        const mockFirestoreTimestamp = {
          toDate: () => new Date('2024-01-15T12:00:00Z'),
        };

        const result = toDate(mockFirestoreTimestamp);
        expect(result instanceof Date).toBe(true);
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(15);
      });

      it('should handle Firestore Timestamp with additional properties', () => {
        const mockFirestoreTimestamp = {
          seconds: 1705334400,
          nanoseconds: 0,
          toDate: () => new Date('2024-01-15T12:00:00Z'),
        };

        const result = toDate(mockFirestoreTimestamp);
        expect(result instanceof Date).toBe(true);
        expect(result.getFullYear()).toBe(2024);
      });
    });

    describe('Edge Cases - Null/Undefined', () => {
      it('should return current date when value is null', () => {
        const before = Date.now();
        const result = toDate(null);
        const after = Date.now();

        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
      });

      it('should return current date when value is undefined', () => {
        const before = Date.now();
        const result = toDate(undefined);
        const after = Date.now();

        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
      });

      it('should return current date when value is empty string', () => {
        const before = Date.now();
        const result = toDate('');
        const after = Date.now();

        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
      });

      it('should return current date when value is 0', () => {
        const before = Date.now();
        const result = toDate(0);
        const after = Date.now();

        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
      });
    });

    describe('Edge Cases - Invalid Inputs', () => {
      it('should return current date when string is not a valid date', () => {
        const before = Date.now();
        const result = toDate('invalid-date');
        const after = Date.now();

        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
      });

      it('should return current date when passed object without toDate method', () => {
        const before = Date.now();
        const result = toDate({ value: '2024-01-15' });
        const after = Date.now();

        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
      });

      it('should return current date when passed array', () => {
        const before = Date.now();
        const result = toDate([2024, 1, 15]);
        const after = Date.now();

        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
      });

      it('should return current date when passed boolean', () => {
        const before = Date.now();
        const result1 = toDate(true);
        const result2 = toDate(false);
        const after = Date.now();

        expect(result1 instanceof Date).toBe(true);
        expect(result2 instanceof Date).toBe(true);
        expect(result1.getTime()).toBeGreaterThanOrEqual(before);
        expect(result2.getTime()).toBeLessThanOrEqual(after);
      });
    });

    describe('Data Loss Scenarios', () => {
      it('CRITICAL: toDate(null) must return valid Date, not Invalid Date', () => {
        const result = toDate(null);
        expect(result instanceof Date).toBe(true);
        expect(isNaN(result.getTime())).toBe(false);
      });

      it('CRITICAL: toDate("2024-01-15") must preserve the date', () => {
        const result = toDate('2024-01-15T00:00:00Z'); // Use ISO format to avoid timezone issues
        expect(result instanceof Date).toBe(true);
        expect(result.getFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(0); // Use UTC to avoid timezone offset
        expect(result.getUTCDate()).toBe(15); // Use UTC date
        expect(isNaN(result.getTime())).toBe(false);
      });

      it('CRITICAL: toDate(FirestoreTimestamp) must preserve the date', () => {
        const expectedDate = new Date('2024-01-15T12:00:00Z');
        const mockTimestamp = {
          toDate: () => expectedDate,
        };

        const result = toDate(mockTimestamp);
        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBe(expectedDate.getTime());
        expect(isNaN(result.getTime())).toBe(false);
      });

      it('CRITICAL: Invalid Date should never be returned', () => {
        const testCases = [
          null,
          undefined,
          'invalid',
          '',
          0,
          false,
          {},
          [],
          'not-a-date',
        ];

        testCases.forEach((testCase) => {
          const result = toDate(testCase);
          expect(result instanceof Date).toBe(true);
          expect(isNaN(result.getTime())).toBe(false);
        });
      });
    });

    describe('Real-World Analytics Scenarios', () => {
      it('should handle deal close dates from Firestore', () => {
        const mockCloseDate = {
          toDate: () => new Date('2024-03-01T00:00:00Z'),
        };

        const result = toDate(mockCloseDate);
        expect(result instanceof Date).toBe(true);
        expect(result.getUTCMonth()).toBe(2); // March (use UTC to avoid timezone offset)
      });

      it('should handle missing order dates', () => {
        const orderDate = undefined;
        const result = toDate(orderDate);

        expect(result instanceof Date).toBe(true);
        expect(isNaN(result.getTime())).toBe(false);
      });

      it('should handle string dates from external APIs', () => {
        const apiDate = '2024-01-15T14:30:00.000Z';
        const result = toDate(apiDate);

        expect(result instanceof Date).toBe(true);
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(15);
      });

      it('should handle epoch timestamps', () => {
        const epoch = 1705334400000;
        const result = toDate(epoch);

        expect(result instanceof Date).toBe(true);
        expect(result.getTime()).toBe(epoch);
      });
    });

    describe('Type Safety', () => {
      it('should always return Date type', () => {
        expect(toDate(null) instanceof Date).toBe(true);
        expect(toDate(undefined) instanceof Date).toBe(true);
        expect(toDate(new Date()) instanceof Date).toBe(true);
        expect(toDate('2024-01-15') instanceof Date).toBe(true);
        expect(toDate(1705334400000) instanceof Date).toBe(true);
      });

      it('should never return null or undefined', () => {
        expect(toDate(null)).not.toBeNull();
        expect(toDate(undefined)).not.toBeUndefined();
        expect(toDate('invalid')).not.toBeNull();
        expect(toDate({})).not.toBeUndefined();
      });
    });
  });

  describe('Integration: Using Both Helpers Together', () => {
    it('should safely process analytics record with mixed types', () => {
      const record = {
        value: undefined,
        probability: '75',
        closeDate: null,
      };

      const value = safeParseFloat(record.value, 0);
      const probability = safeParseFloat(record.probability, 50);
      const closeDate = toDate(record.closeDate);

      expect(value).toBe(0);
      expect(probability).toBe(75);
      expect(closeDate instanceof Date).toBe(true);
      expect(isNaN(closeDate.getTime())).toBe(false);
    });

    it('should handle Firestore record from forecast route', () => {
      const dealRecord = {
        value: '5000.50',
        probability: 80,
        expectedCloseDate: {
          toDate: () => new Date('2024-02-01T00:00:00Z'),
        },
      };

      const value = safeParseFloat(dealRecord.value, 0);
      const probability = safeParseFloat(dealRecord.probability, 0);
      const closeDate = toDate(dealRecord.expectedCloseDate);

      expect(value).toBe(5000.50);
      expect(probability).toBe(80);
      expect(closeDate.getUTCMonth()).toBe(1); // February (use UTC to avoid timezone offset)
    });

    it('should calculate weighted forecast value', () => {
      const deals = [
        { value: '10000', probability: 80, closeDate: new Date('2024-03-01') },
        { value: undefined, probability: undefined, closeDate: null },
        { value: '5000', probability: '50', closeDate: { toDate: () => new Date('2024-03-15') } },
      ];

      const forecast = deals.map(deal => ({
        value: safeParseFloat(deal.value, 0),
        probability: safeParseFloat(deal.probability, 0),
        closeDate: toDate(deal.closeDate),
      }));

      expect(forecast[0].value).toBe(10000);
      expect(forecast[0].probability).toBe(80);

      expect(forecast[1].value).toBe(0); // Not NaN
      expect(forecast[1].probability).toBe(0); // Not NaN

      expect(forecast[2].value).toBe(5000);
      expect(forecast[2].probability).toBe(50);
    });
  });
});
