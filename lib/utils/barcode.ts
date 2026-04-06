/**
 * Barcode normalization utility
 * 
 * Normalizes barcode input for consistent searching and comparison
 */

/**
 * Normalize barcode string
 * - Removes whitespace
 * - Converts to uppercase
 * - Removes special characters (except alphanumeric and hyphens)
 * - Trims leading/trailing zeros for numeric barcodes
 * 
 * @param barcode - Raw barcode input
 * @returns Normalized barcode string
 */
export function normBarcode(barcode: string | null | undefined): string {
  if (!barcode) {
    return '';
  }

  // Remove all whitespace
  let normalized = barcode.trim().replace(/\s+/g, '');

  // Convert to uppercase
  normalized = normalized.toUpperCase();

  // Remove special characters except alphanumeric and hyphens
  normalized = normalized.replace(/[^A-Z0-9-]/g, '');

  // For numeric-only barcodes, trim leading zeros (but keep at least one digit)
  if (/^\d+$/.test(normalized)) {
    normalized = normalized.replace(/^0+/, '') || '0';
  }

  return normalized;
}

/**
 * Check if two barcodes match after normalization
 * 
 * @param barcode1 - First barcode
 * @param barcode2 - Second barcode
 * @returns True if barcodes match after normalization
 */
export function barcodesMatch(
  barcode1: string | null | undefined,
  barcode2: string | null | undefined
): boolean {
  return normBarcode(barcode1) === normBarcode(barcode2);
}

/**
 * Validate barcode format
 * 
 * @param barcode - Barcode to validate
 * @returns True if barcode is valid (non-empty after normalization)
 */
export function isValidBarcode(barcode: string | null | undefined): boolean {
  const normalized = normBarcode(barcode);
  return normalized.length > 0;
}
