/**
 * Product response serializer with role-based field filtering.
 * - MASTER: sees all fields including originalPrice
 * - Others: originalPrice stripped from response
 */

type Role = 'MASTER' | 'SUB_MASTER' | 'ADMIN' | 'SELLER';

/**
 * Serialize a single product for API response based on viewer role.
 */
export function serializeProduct<T extends Record<string, unknown>>(
  product: T,
  viewerRole: Role | string
): T {
  if (viewerRole === 'MASTER') {
    return product;
  }

  // Strip originalPrice for non-MASTER roles
  const { originalPrice: _, ...rest } = product;
  return rest as T;
}

/**
 * Serialize an array of products for API response.
 */
export function serializeProducts<T extends Record<string, unknown>>(
  products: T[],
  viewerRole: Role | string
): T[] {
  if (viewerRole === 'MASTER') {
    return products;
  }

  return products.map((product) => {
    const { originalPrice: _, ...rest } = product;
    return rest as T;
  });
}
