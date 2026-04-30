/**
 * Broadcast eligibility check for products.
 * Products must have valid pricing to be used in broadcasts/orders.
 */

interface ProductForBroadcastCheck {
  isActive?: boolean;
  sellPrice: number;
  supplyPrice: number;
}

/**
 * Check if a product can be used in a broadcast (order creation).
 * Requires: isActive, sellPrice > 0, supplyPrice > 0
 */
export function canProductBeBroadcast(product: ProductForBroadcastCheck): boolean {
  return (
    product.isActive !== false &&
    product.sellPrice > 0 &&
    product.supplyPrice > 0
  );
}

/**
 * Validate an array of products for broadcast eligibility.
 * Returns list of ineligible products with reasons.
 */
export function validateProductsForBroadcast(
  products: Array<ProductForBroadcastCheck & { id: string; name: string; barcode: string }>
): { valid: boolean; ineligible: Array<{ name: string; barcode: string; reason: string }> } {
  const ineligible: Array<{ name: string; barcode: string; reason: string }> = [];

  for (const product of products) {
    if (product.isActive === false) {
      ineligible.push({ name: product.name, barcode: product.barcode, reason: "비활성 상품" });
    } else if (product.sellPrice <= 0 && product.supplyPrice <= 0) {
      ineligible.push({ name: product.name, barcode: product.barcode, reason: "판매가/공급가 미설정" });
    } else if (product.sellPrice <= 0) {
      ineligible.push({ name: product.name, barcode: product.barcode, reason: "판매가 미설정" });
    } else if (product.supplyPrice <= 0) {
      ineligible.push({ name: product.name, barcode: product.barcode, reason: "공급가 미설정" });
    }
  }

  return { valid: ineligible.length === 0, ineligible };
}
