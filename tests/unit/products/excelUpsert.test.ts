/**
 * Unit tests for Excel Bulk Upload — Option 2: Upsert by Barcode
 *
 * Tests parseAndValidateExcel logic (mirrored from lib/services/products/excelUpsert.ts):
 * - Valid rows parsing
 * - Missing barcode/name detection
 * - Negative price detection
 * - Duplicate barcode detection
 * - Edge cases (zero values, empty strings)
 *
 * Note: Following project convention (see stockSync.test.ts), pure logic is inlined
 * to avoid importing modules with DB dependencies.
 */

import { describe, it, expect } from 'vitest';

// ─── Mirrored Types ───

interface ExcelProductRow {
  row: number;
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  originalPrice: number;
  category: string;
  stock: number;
  notes: string;
}

/**
 * Mirrors parseAndValidateExcel from lib/services/products/excelUpsert.ts
 * Validates Excel rows and extracts structured product data.
 */
function parseAndValidateExcel(
  rows: Array<Record<string, unknown>>
): { valid: ExcelProductRow[]; errors: Array<{ row: number; barcode: string; error: string }> } {
  const valid: ExcelProductRow[] = [];
  const errors: Array<{ row: number; barcode: string; error: string }> = [];
  const seenBarcodes = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2; // Excel row (header = row 1)

    const name = String(raw["상품명"] ?? "").trim();
    const barcode = String(raw["바코드"] ?? "").trim();
    const sellPrice = parseInt(String(raw["판매가"] ?? "0")) || 0;
    const supplyPrice = parseInt(String(raw["공급가"] ?? "0")) || 0;
    const originalPrice = parseInt(String(raw["원가"] ?? "0")) || 0;
    const category = String(raw["카테고리"] ?? "").trim();
    const stock = parseInt(String(raw["재고"] ?? "0")) || 0;
    const notes = String(raw["메모"] ?? "").trim();

    if (!barcode) {
      errors.push({ row: rowNum, barcode: "", error: "바코드 누락 (필수)" });
      continue;
    }

    if (!name) {
      errors.push({ row: rowNum, barcode, error: "상품명 누락" });
      continue;
    }

    if (sellPrice < 0) {
      errors.push({ row: rowNum, barcode, error: "판매가 음수" });
      continue;
    }

    if (supplyPrice < 0) {
      errors.push({ row: rowNum, barcode, error: "공급가 음수" });
      continue;
    }

    if (originalPrice < 0) {
      errors.push({ row: rowNum, barcode, error: "원가 음수" });
      continue;
    }

    if (seenBarcodes.has(barcode)) {
      errors.push({ row: rowNum, barcode, error: "엑셀 내 바코드 중복" });
      continue;
    }

    seenBarcodes.add(barcode);
    valid.push({ row: rowNum, name, barcode, sellPrice, supplyPrice, originalPrice, category, stock, notes });
  }

  return { valid, errors };
}

// ─── Upsert Classification Logic (mirrors buildUpsertPlan's categorization) ───

interface ExistingProduct {
  barcode: string;
  name: string;
  sellPrice: number;
  supplyPrice: number;
  isActive: boolean;
}

interface UpsertClassification {
  updates: string[];
  reactivations: string[];
  creates: string[];
  deactivations: string[];
  priceChanges: Array<{ barcode: string; field: string; oldValue: number; newValue: number }>;
}

/**
 * Mirrors the classification logic from buildUpsertPlan.
 * Given existing products and Excel rows, classifies each as UPDATE/REACTIVATE/CREATE/DEACTIVATE.
 */
function classifyUpsert(
  existingProducts: ExistingProduct[],
  excelRows: Array<{ barcode: string; name: string; sellPrice: number; supplyPrice: number }>
): UpsertClassification {
  const existingByBarcode = new Map(existingProducts.map((p) => [p.barcode, p]));
  const uploadedBarcodes = new Set(excelRows.map((r) => r.barcode));

  const updates: string[] = [];
  const reactivations: string[] = [];
  const creates: string[] = [];
  const priceChanges: UpsertClassification["priceChanges"] = [];

  for (const row of excelRows) {
    const existing = existingByBarcode.get(row.barcode);

    if (existing) {
      if (existing.isActive) {
        updates.push(row.barcode);
      } else {
        reactivations.push(row.barcode);
      }

      if (existing.sellPrice !== row.sellPrice) {
        priceChanges.push({
          barcode: row.barcode, field: "판매가",
          oldValue: existing.sellPrice, newValue: row.sellPrice,
        });
      }
      if (existing.supplyPrice !== row.supplyPrice) {
        priceChanges.push({
          barcode: row.barcode, field: "공급가",
          oldValue: existing.supplyPrice, newValue: row.supplyPrice,
        });
      }
    } else {
      creates.push(row.barcode);
    }
  }

  // Deactivation: active products NOT in the Excel
  const deactivations = existingProducts
    .filter((p) => p.isActive && !uploadedBarcodes.has(p.barcode))
    .map((p) => p.barcode);

  return { updates, reactivations, creates, deactivations, priceChanges };
}

// ─── Tests ───

describe('parseAndValidateExcel', () => {
  describe('valid rows', () => {
    it('should parse valid Excel rows correctly', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': 5000, '공급가': 3000, '원가': 2000, '카테고리': '식품', '재고': 100, '메모': '메모1' },
        { '상품명': '상품B', '바코드': 'BC002', '판매가': 8000, '공급가': 5000, '원가': 0, '카테고리': '', '재고': 50, '메모': '' },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(0);
      expect(valid).toHaveLength(2);
      expect(valid[0]).toEqual({
        row: 2,
        name: '상품A',
        barcode: 'BC001',
        sellPrice: 5000,
        supplyPrice: 3000,
        originalPrice: 2000,
        category: '식품',
        stock: 100,
        notes: '메모1',
      });
      expect(valid[1].row).toBe(3);
      expect(valid[1].barcode).toBe('BC002');
    });

    it('should handle string number values from Excel', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': '5000', '공급가': '3000', '원가': '2000', '카테고리': '식품', '재고': '100', '메모': '' },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(0);
      expect(valid).toHaveLength(1);
      expect(valid[0].sellPrice).toBe(5000);
      expect(valid[0].supplyPrice).toBe(3000);
      expect(valid[0].originalPrice).toBe(2000);
      expect(valid[0].stock).toBe(100);
    });

    it('should handle zero stock and zero price as valid', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': 0, '공급가': 0, '원가': 0, '카테고리': '', '재고': 0, '메모': '' },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(0);
      expect(valid).toHaveLength(1);
      expect(valid[0].sellPrice).toBe(0);
      expect(valid[0].stock).toBe(0);
    });

    it('should trim whitespace from string fields', () => {
      const rows = [
        { '상품명': '  상품A  ', '바코드': ' BC001 ', '판매가': 5000, '공급가': 3000, '원가': 0, '카테고리': ' 식품 ', '재고': 100, '메모': ' 메모 ' },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(0);
      expect(valid[0].name).toBe('상품A');
      expect(valid[0].barcode).toBe('BC001');
      expect(valid[0].category).toBe('식품');
      expect(valid[0].notes).toBe('메모');
    });
  });

  describe('error detection', () => {
    it('should reject rows with missing barcode', () => {
      const rows = [
        { '상품명': '상품A', '바코드': '', '판매가': 5000, '공급가': 3000, '재고': 100 },
        { '상품명': '상품B', '판매가': 5000, '공급가': 3000, '재고': 100 },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(2);
      expect(errors[0].error).toContain('바코드 누락');
      expect(errors[1].error).toContain('바코드 누락');
      expect(valid).toHaveLength(0);
    });

    it('should reject rows with missing product name', () => {
      const rows = [
        { '상품명': '', '바코드': 'BC001', '판매가': 5000, '공급가': 3000, '재고': 100 },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('상품명 누락');
      expect(errors[0].barcode).toBe('BC001');
    });

    it('should reject rows with negative sellPrice', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': -1000, '공급가': 3000, '재고': 100 },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('판매가 음수');
    });

    it('should reject rows with negative supplyPrice', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': 5000, '공급가': -500, '재고': 100 },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('공급가 음수');
    });

    it('should reject rows with negative originalPrice', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': 5000, '공급가': 3000, '원가': -100, '재고': 100 },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('원가 음수');
    });

    it('should reject duplicate barcodes within Excel', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': 5000, '공급가': 3000, '재고': 100 },
        { '상품명': '상품B', '바코드': 'BC001', '판매가': 8000, '공급가': 5000, '재고': 50 },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(valid).toHaveLength(1);
      expect(valid[0].name).toBe('상품A');
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('바코드 중복');
      expect(errors[0].row).toBe(3);
    });
  });

  describe('mixed valid and invalid rows', () => {
    it('should collect valid rows and skip invalid ones', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': 5000, '공급가': 3000, '재고': 100 },
        { '상품명': '', '바코드': 'BC002', '판매가': 5000, '공급가': 3000, '재고': 50 },
        { '상품명': '상품C', '바코드': 'BC003', '판매가': 8000, '공급가': 5000, '재고': 30 },
        { '상품명': '상품D', '바코드': '', '판매가': 6000, '공급가': 4000, '재고': 80 },
        { '상품명': '상품E', '바코드': 'BC005', '판매가': -100, '공급가': 3000, '재고': 20 },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(valid).toHaveLength(2);
      expect(valid[0].barcode).toBe('BC001');
      expect(valid[1].barcode).toBe('BC003');
      expect(errors).toHaveLength(3);
    });

    it('should assign correct row numbers (Excel 1-based + header)', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': 5000, '공급가': 3000, '재고': 100 },
        { '상품명': '', '바코드': 'BC002', '판매가': 5000, '공급가': 3000, '재고': 50 },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(valid[0].row).toBe(2);
      expect(errors[0].row).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty rows array', () => {
      const { valid, errors } = parseAndValidateExcel([]);

      expect(valid).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('should handle missing optional fields gracefully', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': 5000, '공급가': 3000 },
      ];

      const { valid, errors } = parseAndValidateExcel(rows);

      expect(errors).toHaveLength(0);
      expect(valid).toHaveLength(1);
      expect(valid[0].originalPrice).toBe(0);
      expect(valid[0].category).toBe('');
      expect(valid[0].stock).toBe(0);
      expect(valid[0].notes).toBe('');
    });

    it('should handle undefined/null column values', () => {
      const rows = [
        { '상품명': '상품A', '바코드': 'BC001', '판매가': null, '공급가': undefined, '재고': null },
      ];

      const { valid, errors } = parseAndValidateExcel(rows as any);

      expect(errors).toHaveLength(0);
      expect(valid).toHaveLength(1);
      expect(valid[0].sellPrice).toBe(0);
      expect(valid[0].supplyPrice).toBe(0);
      expect(valid[0].stock).toBe(0);
    });
  });
});

describe('classifyUpsert (buildUpsertPlan classification logic)', () => {
  const existingProducts: ExistingProduct[] = [
    { barcode: 'BC001', name: '상품1', sellPrice: 5000, supplyPrice: 3000, isActive: true },
    { barcode: 'BC002', name: '상품2', sellPrice: 8000, supplyPrice: 5000, isActive: true },
    { barcode: 'BC003', name: '상품3', sellPrice: 3000, supplyPrice: 2000, isActive: true },
    { barcode: 'BC004', name: '상품4 (비활성)', sellPrice: 6000, supplyPrice: 4000, isActive: false },
  ];

  it('should classify same barcode as UPDATE (active product)', () => {
    const excel = [
      { barcode: 'BC001', name: '상품1', sellPrice: 5000, supplyPrice: 3000 },
    ];

    const result = classifyUpsert(existingProducts, excel);

    expect(result.updates).toContain('BC001');
    expect(result.creates).toHaveLength(0);
  });

  it('should classify inactive product barcode as REACTIVATE', () => {
    const excel = [
      { barcode: 'BC004', name: '상품4 (비활성)', sellPrice: 6000, supplyPrice: 4000 },
    ];

    const result = classifyUpsert(existingProducts, excel);

    expect(result.reactivations).toContain('BC004');
    expect(result.updates).not.toContain('BC004');
  });

  it('should classify new barcode as CREATE', () => {
    const excel = [
      { barcode: 'BC999', name: '신상품', sellPrice: 9000, supplyPrice: 6000 },
    ];

    const result = classifyUpsert(existingProducts, excel);

    expect(result.creates).toContain('BC999');
  });

  it('should classify active products missing from Excel as DEACTIVATE', () => {
    const excel = [
      { barcode: 'BC001', name: '상품1', sellPrice: 5000, supplyPrice: 3000 },
      // BC002, BC003 missing → should be deactivated
    ];

    const result = classifyUpsert(existingProducts, excel);

    expect(result.deactivations).toContain('BC002');
    expect(result.deactivations).toContain('BC003');
    expect(result.deactivations).not.toContain('BC001');
    // BC004 already inactive → should NOT appear in deactivations
    expect(result.deactivations).not.toContain('BC004');
  });

  it('should track price changes correctly', () => {
    const excel = [
      { barcode: 'BC001', name: '상품1', sellPrice: 5000, supplyPrice: 3000 }, // no change
      { barcode: 'BC002', name: '상품2', sellPrice: 7500, supplyPrice: 5000 }, // 판매가 변동
      { barcode: 'BC003', name: '상품3', sellPrice: 3000, supplyPrice: 1500 }, // 공급가 변동
    ];

    const result = classifyUpsert(existingProducts, excel);

    expect(result.priceChanges).toHaveLength(2);
    expect(result.priceChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ barcode: 'BC002', field: '판매가', oldValue: 8000, newValue: 7500 }),
        expect.objectContaining({ barcode: 'BC003', field: '공급가', oldValue: 2000, newValue: 1500 }),
      ])
    );
  });

  it('should handle scenario C (daily upload flow)', () => {
    // Scenario: 5 products → second upload with changes
    const existing: ExistingProduct[] = [
      { barcode: '1001', name: '상품1', sellPrice: 5000, supplyPrice: 3000, isActive: true },
      { barcode: '1002', name: '상품2', sellPrice: 8000, supplyPrice: 5000, isActive: true },
      { barcode: '1003', name: '상품3', sellPrice: 3000, supplyPrice: 2000, isActive: true },
      { barcode: '1004', name: '상품4', sellPrice: 6000, supplyPrice: 4000, isActive: true },
      { barcode: '1005', name: '상품5', sellPrice: 12000, supplyPrice: 8000, isActive: true },
    ];

    // Second upload: 1003 missing (매진), 1002 price changed, 1006 new
    const excel = [
      { barcode: '1001', name: '상품1', sellPrice: 5000, supplyPrice: 3000 },
      { barcode: '1002', name: '상품2', sellPrice: 7500, supplyPrice: 5000 },  // 가격 인하
      { barcode: '1004', name: '상품4', sellPrice: 6000, supplyPrice: 4000 },
      { barcode: '1005', name: '상품5', sellPrice: 12000, supplyPrice: 8000 },
      { barcode: '1006', name: '신상품6', sellPrice: 9000, supplyPrice: 6000 }, // 신상품
    ];

    const result = classifyUpsert(existing, excel);

    expect(result.updates).toHaveLength(4); // 1001, 1002, 1004, 1005
    expect(result.creates).toEqual(['1006']);
    expect(result.deactivations).toEqual(['1003']); // 매진
    expect(result.reactivations).toHaveLength(0);
    expect(result.priceChanges).toHaveLength(1);
    expect(result.priceChanges[0]).toEqual({
      barcode: '1002', field: '판매가', oldValue: 8000, newValue: 7500,
    });
  });

  it('should not deactivate already-inactive products', () => {
    const existing: ExistingProduct[] = [
      { barcode: 'BC001', name: '활성', sellPrice: 5000, supplyPrice: 3000, isActive: true },
      { barcode: 'BC002', name: '비활성', sellPrice: 8000, supplyPrice: 5000, isActive: false },
    ];

    // Upload with neither BC001 nor BC002
    const excel = [
      { barcode: 'BC999', name: '신상품', sellPrice: 9000, supplyPrice: 6000 },
    ];

    const result = classifyUpsert(existing, excel);

    expect(result.deactivations).toEqual(['BC001']); // only active product
    expect(result.deactivations).not.toContain('BC002');
  });

  it('should handle empty Excel (deactivate all active)', () => {
    const result = classifyUpsert(existingProducts, []);

    expect(result.updates).toHaveLength(0);
    expect(result.creates).toHaveLength(0);
    expect(result.reactivations).toHaveLength(0);
    // 3 active products deactivated (BC004 already inactive)
    expect(result.deactivations).toHaveLength(3);
    expect(result.deactivations).toEqual(['BC001', 'BC002', 'BC003']);
  });

  it('should handle empty existing products (all creates)', () => {
    const excel = [
      { barcode: 'BC001', name: '상품1', sellPrice: 5000, supplyPrice: 3000 },
      { barcode: 'BC002', name: '상품2', sellPrice: 8000, supplyPrice: 5000 },
    ];

    const result = classifyUpsert([], excel);

    expect(result.creates).toEqual(['BC001', 'BC002']);
    expect(result.updates).toHaveLength(0);
    expect(result.deactivations).toHaveLength(0);
  });
});
