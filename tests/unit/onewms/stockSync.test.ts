/**
 * Unit tests for ONEWMS Stock Value Conversion
 * Validates that stock values from ONEWMS API (string/number/null) are correctly
 * converted to numbers for DB storage.
 *
 * Root cause of SAEN22258 bug (2026-04-30):
 *   ONEWMS API returns stock as STRING "26925", not number.
 *   Old code: `total += (wh.stock || 0)` → string concatenation → "026925"
 *   Fixed:    `total += Number(wh.stock) || 0` → proper number addition → 26925
 */

import { describe, it, expect } from 'vitest';

/**
 * Helper that mirrors the fixed stock summation logic used in:
 * - lib/services/onewms/stockSync.ts:63
 * - lib/services/onewms/productImport.ts:221
 * - app/api/products/barcode/[code]/route.ts:63
 */
function sumStockFromWarehouses(
  stockData: Record<string, { stock?: string | number | null; [key: string]: unknown }>
): number {
  let total = 0;
  for (const wh of Object.values(stockData)) {
    total += Number(wh.stock) || 0;
  }
  return total;
}

describe('ONEWMS Stock Value Conversion', () => {
  describe('String stock values (actual API behavior)', () => {
    it('should convert string "26925" to number 26925', () => {
      const stockData = { '1': { warehouse_seq: '1', stock: '26925' } };
      expect(sumStockFromWarehouses(stockData)).toBe(26925);
    });

    it('should convert string "0" to number 0', () => {
      const stockData = { '1': { warehouse_seq: '1', stock: '0' } };
      expect(sumStockFromWarehouses(stockData)).toBe(0);
    });

    it('should sum multiple warehouse string stocks correctly', () => {
      const stockData = {
        '1': { warehouse_seq: '1', stock: '10000' },
        '2': { warehouse_seq: '2', stock: '5000' },
        '3': { warehouse_seq: '3', stock: '2500' },
      };
      expect(sumStockFromWarehouses(stockData)).toBe(17500);
    });
  });

  describe('Number stock values (type definition says number)', () => {
    it('should handle numeric 26925 correctly', () => {
      const stockData = { '1': { warehouse_seq: '1', stock: 26925 } };
      expect(sumStockFromWarehouses(stockData)).toBe(26925);
    });

    it('should handle numeric 0 correctly', () => {
      const stockData = { '1': { warehouse_seq: '1', stock: 0 } };
      expect(sumStockFromWarehouses(stockData)).toBe(0);
    });
  });

  describe('Null/undefined stock values', () => {
    it('should treat null stock as 0', () => {
      const stockData = { '1': { warehouse_seq: '1', stock: null } };
      expect(sumStockFromWarehouses(stockData)).toBe(0);
    });

    it('should treat undefined stock as 0', () => {
      const stockData = { '1': { warehouse_seq: '1' } };
      expect(sumStockFromWarehouses(stockData)).toBe(0);
    });

    it('should treat empty string as 0', () => {
      const stockData = { '1': { warehouse_seq: '1', stock: '' } };
      expect(sumStockFromWarehouses(stockData)).toBe(0);
    });
  });

  describe('Mixed type values (regression prevention)', () => {
    it('should handle mixed string and number across warehouses', () => {
      const stockData = {
        '1': { warehouse_seq: '1', stock: '15000' },
        '2': { warehouse_seq: '2', stock: 5000 },
        '3': { warehouse_seq: '3', stock: null },
      };
      expect(sumStockFromWarehouses(stockData)).toBe(20000);
    });

    it('should not produce string concatenation (the original bug)', () => {
      // The original bug: 0 + "26925" = "026925" (string concat)
      // Fixed: Number("26925") = 26925 (proper addition)
      const stockData = { '1': { warehouse_seq: '1', stock: '26925' } };
      const result = sumStockFromWarehouses(stockData);
      expect(typeof result).toBe('number');
      expect(result).not.toBe('026925');
      expect(result).toBe(26925);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty stock data', () => {
      expect(sumStockFromWarehouses({})).toBe(0);
    });

    it('should handle negative stock string', () => {
      const stockData = { '1': { warehouse_seq: '1', stock: '-5' } };
      expect(sumStockFromWarehouses(stockData)).toBe(-5);
    });

    it('should handle non-numeric string as 0', () => {
      const stockData = { '1': { warehouse_seq: '1', stock: 'abc' } };
      expect(sumStockFromWarehouses(stockData)).toBe(0);
    });
  });
});
