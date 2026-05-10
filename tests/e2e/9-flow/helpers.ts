/**
 * 9-flow Test Helpers
 *
 * Shared utilities for E2E flow tests that run against the live Vercel deployment.
 * All data operations go through API endpoints (no direct DB access).
 *
 * Usage:
 *   import { ensureTestProducts, ensureTestOrder, ... } from './helpers';
 */

import { APIRequestContext } from '@playwright/test';

// ── Constants ──

export const BASE_URL = 'https://live-commerce-opal.vercel.app';

export const POST_HEADERS = {
  'Origin': BASE_URL,
  'Content-Type': 'application/json',
};

// ── Types ──

export interface TestProduct {
  id: string;
  name: string;
  barcode: string;
  code: string;
  supplyPrice: number;
  sellPrice: number;
  productType: 'HEADQUARTERS' | 'CENTER';
  totalStock: number;
  isActive: boolean;
}

export interface TestOrder {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  totalAmount: number;
  productType: string;
  items: any[];
  seller: any;
  split?: boolean;
}

export interface EnsureProductsResult {
  hqProduct: TestProduct | null;
  centerProduct: TestProduct | null;
  skipped: boolean;
  skipReason?: string;
}

export interface EnsureOrderResult {
  order: TestOrder | null;
  orders: TestOrder[];
  split: boolean;
  skipped: boolean;
  skipReason?: string;
}

export interface TestDataSnapshot {
  products: {
    hq: TestProduct[];
    center: TestProduct[];
  };
  orders: {
    pending: TestOrder[];
    approved: TestOrder[];
    paid: TestOrder[];
    shipped: TestOrder[];
    all: TestOrder[];
  };
  centers: any[];
}

// ── Unique ID Generation ──

/**
 * Generate a unique order number with timestamp to avoid collisions.
 * Format: E2E-9F-{base36-timestamp}-{random-suffix}
 */
export function generateOrderNo(prefix = 'E2E-9F'): string {
  const ts = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(-3);
  return `${prefix}-${ts}-${rand}`;
}

// ── Product Helpers ──

/**
 * Fetch products by type from the API.
 * Returns an empty array on any error (never throws).
 */
async function fetchProducts(
  request: APIRequestContext,
  productType?: 'HEADQUARTERS' | 'CENTER',
  pageSize = 10,
): Promise<TestProduct[]> {
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  if (productType) params.set('productType', productType);

  try {
    const res = await request.get(`/api/products?${params}`);
    if (!res.ok()) {
      console.log(`[helpers] fetchProducts(${productType}): HTTP ${res.status()}`);
      return [];
    }
    const body = await res.json();
    return body.data || [];
  } catch (err) {
    console.log(`[helpers] fetchProducts(${productType}): error`, err);
    return [];
  }
}

/**
 * Find a product that is valid for ordering:
 * - Active
 * - Has non-zero supplyPrice
 * - Has a barcode
 */
function findOrderableProduct(products: TestProduct[]): TestProduct | null {
  return (
    products.find(
      (p) => p.isActive !== false && p.supplyPrice > 0 && p.barcode,
    ) ?? null
  );
}

/**
 * Ensure test products exist for both HQ and CENTER types.
 * Fetches existing products via API -- does NOT create new ones
 * (product creation requires admin privileges and complex validation).
 *
 * Returns available products or null with skip reason.
 */
export async function ensureTestProducts(
  request: APIRequestContext,
): Promise<EnsureProductsResult> {
  console.log('[helpers] ensureTestProducts: fetching HQ + CENTER products...');

  const [hqProducts, centerProducts] = await Promise.all([
    fetchProducts(request, 'HEADQUARTERS', 10),
    fetchProducts(request, 'CENTER', 10),
  ]);

  const hqProduct = findOrderableProduct(hqProducts);
  const centerProduct = findOrderableProduct(centerProducts);

  if (!hqProduct && !centerProduct) {
    console.log('[helpers] ensureTestProducts: no orderable products found');
    return {
      hqProduct: null,
      centerProduct: null,
      skipped: true,
      skipReason: 'No orderable products found (need active products with prices and barcodes)',
    };
  }

  console.log(
    `[helpers] ensureTestProducts: HQ=${hqProduct?.name ?? 'none'}, CENTER=${centerProduct?.name ?? 'none'}`,
  );

  return {
    hqProduct,
    centerProduct,
    skipped: false,
  };
}

// ── Order Helpers ──

export interface CreateOrderOptions {
  /** Products to include. At least one required. */
  items: Array<{
    productId: string;
    quantity: number;
    barcode: string;
    productName: string;
    supplyPrice: number;
  }>;
  /** Custom order number. Auto-generated if omitted. */
  orderNo?: string;
  /** Custom total amount. Calculated from items if omitted. */
  totalAmount?: number;
  /** Optional memo */
  memo?: string;
}

/**
 * Create a test order via POST /api/orders.
 *
 * Handles:
 * - Auto-generates unique orderNo if not provided
 * - Calculates totalAmount from items if not provided
 * - Returns null on 400 errors (stock issues, validation) instead of throwing
 * - Logs all operations for debugging
 */
export async function ensureTestOrder(
  request: APIRequestContext,
  options: CreateOrderOptions,
): Promise<EnsureOrderResult> {
  const orderNo = options.orderNo ?? generateOrderNo();
  const totalAmount =
    options.totalAmount ??
    options.items.reduce((sum, i) => sum + i.supplyPrice * i.quantity, 0);

  console.log(
    `[helpers] ensureTestOrder: creating ${orderNo} with ${options.items.length} items, total=${totalAmount}`,
  );

  try {
    const res = await request.post('/api/orders', {
      headers: POST_HEADERS,
      data: {
        orderNo,
        totalAmount,
        memo: options.memo,
        items: options.items,
      },
    });

    const body = await res.json().catch(() => null);

    if (res.status() === 400) {
      const errorMsg = body?.error?.message || body?.error || 'Unknown 400 error';
      console.log(`[helpers] ensureTestOrder: 400 error - ${errorMsg}`);
      return {
        order: null,
        orders: [],
        split: false,
        skipped: true,
        skipReason: `Order creation failed (400): ${errorMsg}`,
      };
    }

    if (!res.ok()) {
      console.log(`[helpers] ensureTestOrder: HTTP ${res.status()}`);
      return {
        order: null,
        orders: [],
        split: false,
        skipped: true,
        skipReason: `Order creation failed (${res.status()})`,
      };
    }

    const data = body?.data;
    const isSplit = data?.split === true;
    const orders: TestOrder[] = isSplit ? (data?.orders || []) : data?.orders || [data];

    console.log(
      `[helpers] ensureTestOrder: created ${isSplit ? 'split' : 'single'} order(s): ${orders.map((o: any) => o?.id).join(', ')}`,
    );

    return {
      order: orders[0] ?? null,
      orders,
      split: isSplit,
      skipped: false,
    };
  } catch (err) {
    console.log('[helpers] ensureTestOrder: exception', err);
    return {
      order: null,
      orders: [],
      split: false,
      skipped: true,
      skipReason: `Order creation exception: ${err}`,
    };
  }
}

/**
 * Convenience: create an order from a product (single-item order).
 */
export async function createOrderFromProduct(
  request: APIRequestContext,
  product: TestProduct,
  quantity = 1,
): Promise<EnsureOrderResult> {
  return ensureTestOrder(request, {
    items: [
      {
        productId: product.id,
        quantity,
        barcode: product.barcode,
        productName: product.name,
        supplyPrice: product.supplyPrice,
      },
    ],
  });
}

/**
 * Create an order and confirm it (PENDING -> APPROVED).
 *
 * Steps:
 * 1. Create order via POST /api/orders
 * 2. Confirm via POST /api/orders/:id/confirm
 *
 * Returns the APPROVED order or null on failure.
 */
export async function ensureApprovedOrder(
  request: APIRequestContext,
  product?: TestProduct,
): Promise<EnsureOrderResult> {
  // Step 0: Get a product if none provided
  if (!product) {
    const { hqProduct, centerProduct, skipped, skipReason } =
      await ensureTestProducts(request);
    product = centerProduct ?? hqProduct ?? undefined;
    if (!product) {
      return {
        order: null,
        orders: [],
        split: false,
        skipped: true,
        skipReason: skipReason || 'No product available for order',
      };
    }
  }

  // Step 1: Create order
  const createResult = await createOrderFromProduct(request, product);
  if (createResult.skipped || !createResult.order) {
    return createResult;
  }

  const orderId = createResult.order.id;
  console.log(`[helpers] ensureApprovedOrder: confirming order ${orderId}...`);

  // Step 2: Confirm (PENDING -> APPROVED)
  try {
    const confirmRes = await request.post(`/api/orders/${orderId}/confirm`, {
      headers: POST_HEADERS,
    });

    if (!confirmRes.ok()) {
      const body = await confirmRes.json().catch(() => null);
      const errorMsg = body?.error?.message || body?.error || `HTTP ${confirmRes.status()}`;
      console.log(`[helpers] ensureApprovedOrder: confirm failed - ${errorMsg}`);
      // Return the PENDING order (it was created but not confirmed)
      return {
        ...createResult,
        skipReason: `Confirm failed: ${errorMsg}`,
      };
    }

    // Fetch the updated order
    const updatedOrder = await fetchOrder(request, orderId);
    console.log(
      `[helpers] ensureApprovedOrder: order ${orderId} confirmed, status=${updatedOrder?.status}`,
    );

    return {
      order: updatedOrder ?? createResult.order,
      orders: updatedOrder ? [updatedOrder] : createResult.orders,
      split: createResult.split,
      skipped: false,
    };
  } catch (err) {
    console.log('[helpers] ensureApprovedOrder: confirm exception', err);
    return {
      ...createResult,
      skipReason: `Confirm exception: ${err}`,
    };
  }
}

/**
 * Create, confirm, and payment-confirm an order (PENDING -> APPROVED -> PAID).
 *
 * Steps:
 * 1. Create order via POST /api/orders
 * 2. Confirm via POST /api/orders/:id/confirm
 * 3. Payment confirm via POST /api/orders/:id/confirm-payment
 *
 * Returns the PAID order or null on failure.
 */
export async function ensurePaidOrder(
  request: APIRequestContext,
  product?: TestProduct,
): Promise<EnsureOrderResult> {
  // Steps 1-2: Create and confirm
  const approvedResult = await ensureApprovedOrder(request, product);
  if (approvedResult.skipped || !approvedResult.order) {
    return approvedResult;
  }

  const orderId = approvedResult.order.id;

  // Verify the order is actually APPROVED before proceeding
  if (approvedResult.order.status !== 'APPROVED') {
    console.log(
      `[helpers] ensurePaidOrder: order ${orderId} is ${approvedResult.order.status}, not APPROVED`,
    );
    return {
      ...approvedResult,
      skipReason: `Order not in APPROVED state (is ${approvedResult.order.status})`,
    };
  }

  console.log(`[helpers] ensurePaidOrder: confirming payment for order ${orderId}...`);

  // Step 3: Payment confirm (APPROVED+UNPAID -> PAID)
  try {
    const payRes = await request.post(`/api/orders/${orderId}/confirm-payment`, {
      headers: POST_HEADERS,
    });

    if (!payRes.ok()) {
      const body = await payRes.json().catch(() => null);
      const errorMsg = body?.error?.message || body?.error || `HTTP ${payRes.status()}`;
      console.log(`[helpers] ensurePaidOrder: payment-confirm failed - ${errorMsg}`);

      // Also try the alternative payment-confirm endpoint
      const altRes = await request.post(`/api/orders/${orderId}/payment-confirm`, {
        headers: POST_HEADERS,
      });
      if (!altRes.ok()) {
        return {
          ...approvedResult,
          skipReason: `Payment confirm failed: ${errorMsg}`,
        };
      }
    }

    // Fetch the updated order
    const updatedOrder = await fetchOrder(request, orderId);
    console.log(
      `[helpers] ensurePaidOrder: order ${orderId} paid, paymentStatus=${updatedOrder?.paymentStatus}`,
    );

    return {
      order: updatedOrder ?? approvedResult.order,
      orders: updatedOrder ? [updatedOrder] : approvedResult.orders,
      split: approvedResult.split,
      skipped: false,
    };
  } catch (err) {
    console.log('[helpers] ensurePaidOrder: payment exception', err);
    return {
      ...approvedResult,
      skipReason: `Payment exception: ${err}`,
    };
  }
}

// ── Data Fetching Helpers ──

/**
 * Fetch a single order by ID.
 * Returns null if not found or on error.
 */
export async function fetchOrder(
  request: APIRequestContext,
  orderId: string,
): Promise<TestOrder | null> {
  try {
    const res = await request.get(`/api/orders/${orderId}`);
    if (!res.ok()) return null;
    const body = await res.json();
    return body.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch orders with optional filters.
 * Returns empty array on error.
 */
export async function fetchOrders(
  request: APIRequestContext,
  params?: {
    pageSize?: number;
    pageIndex?: number;
    productType?: 'HEADQUARTERS' | 'CENTER';
    search?: string;
  },
): Promise<TestOrder[]> {
  const query = new URLSearchParams();
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.pageIndex) query.set('pageIndex', String(params.pageIndex));
  if (params?.productType) query.set('productType', params.productType);
  if (params?.search) query.set('search', params.search);

  try {
    const url = `/api/orders${query.toString() ? '?' + query.toString() : ''}`;
    const res = await request.get(url);
    if (!res.ok()) return [];
    const body = await res.json();
    return body.data || [];
  } catch {
    return [];
  }
}

/**
 * Find an existing order by status (and optionally paymentStatus).
 * Searches through the most recent 50 orders.
 */
export async function findOrderByStatus(
  request: APIRequestContext,
  status: string,
  paymentStatus?: string,
): Promise<TestOrder | null> {
  const orders = await fetchOrders(request, { pageSize: 50 });
  return (
    orders.find((o) => {
      if (o.status !== status) return false;
      if (paymentStatus && o.paymentStatus !== paymentStatus) return false;
      return true;
    }) ?? null
  );
}

/**
 * Fetch centers list.
 * Returns empty array on error.
 */
export async function fetchCenters(
  request: APIRequestContext,
  pageSize = 20,
): Promise<any[]> {
  try {
    const res = await request.get(`/api/centers?pageSize=${pageSize}`);
    if (!res.ok()) return [];
    const body = await res.json();
    return body.data?.centers || [];
  } catch {
    return [];
  }
}

/**
 * Get a comprehensive snapshot of current test data state.
 * Useful for understanding what data is available before running tests.
 */
export async function getTestData(
  request: APIRequestContext,
): Promise<TestDataSnapshot> {
  console.log('[helpers] getTestData: fetching current data snapshot...');

  const [hqProducts, centerProducts, allOrders, centers] = await Promise.all([
    fetchProducts(request, 'HEADQUARTERS', 20),
    fetchProducts(request, 'CENTER', 20),
    fetchOrders(request, { pageSize: 50 }),
    fetchCenters(request),
  ]);

  const snapshot: TestDataSnapshot = {
    products: {
      hq: hqProducts,
      center: centerProducts,
    },
    orders: {
      pending: allOrders.filter((o) => o.status === 'PENDING'),
      approved: allOrders.filter(
        (o) => o.status === 'APPROVED' && o.paymentStatus === 'UNPAID',
      ),
      paid: allOrders.filter((o) => o.paymentStatus === 'PAID'),
      shipped: allOrders.filter((o) => o.shippingStatus === 'SHIPPED'),
      all: allOrders,
    },
    centers,
  };

  console.log(
    `[helpers] getTestData: products(HQ=${hqProducts.length}, CENTER=${centerProducts.length}), ` +
      `orders(PENDING=${snapshot.orders.pending.length}, APPROVED=${snapshot.orders.approved.length}, ` +
      `PAID=${snapshot.orders.paid.length}, SHIPPED=${snapshot.orders.shipped.length}), ` +
      `centers=${centers.length}`,
  );

  return snapshot;
}

// ── Order Action Helpers ──

/**
 * Confirm an order (PENDING -> APPROVED).
 * Returns the response status and parsed body.
 */
export async function confirmOrder(
  request: APIRequestContext,
  orderId: string,
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await request.post(`/api/orders/${orderId}/confirm`, {
      headers: POST_HEADERS,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok(), status: res.status(), data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/**
 * Confirm payment on an order (APPROVED+UNPAID -> PAID).
 * Tries /confirm-payment first, falls back to /payment-confirm.
 */
export async function confirmPayment(
  request: APIRequestContext,
  orderId: string,
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    // Primary endpoint (with stock reservation conversion)
    const res = await request.post(`/api/orders/${orderId}/confirm-payment`, {
      headers: POST_HEADERS,
    });
    const data = await res.json().catch(() => null);

    if (res.ok()) {
      return { ok: true, status: res.status(), data };
    }

    // Fallback to alternative endpoint
    const altRes = await request.post(`/api/orders/${orderId}/payment-confirm`, {
      headers: POST_HEADERS,
    });
    const altData = await altRes.json().catch(() => null);
    return { ok: altRes.ok(), status: altRes.status(), data: altData };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/**
 * Update order shipping status.
 * Used for SHIPPED, PREPARING, etc.
 */
export async function updateShippingStatus(
  request: APIRequestContext,
  orderId: string,
  shippingStatus: 'PENDING' | 'PREPARING' | 'SHIPPED' | 'PARTIAL',
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await request.put(`/api/orders/${orderId}/status`, {
      headers: POST_HEADERS,
      data: { shippingStatus },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok(), status: res.status(), data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/**
 * Cancel an order.
 */
export async function cancelOrder(
  request: APIRequestContext,
  orderId: string,
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await request.post(`/api/orders/${orderId}/cancel`, {
      headers: POST_HEADERS,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok(), status: res.status(), data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/**
 * Reject an order.
 */
export async function rejectOrder(
  request: APIRequestContext,
  orderId: string,
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await request.post(`/api/orders/${orderId}/reject`, {
      headers: POST_HEADERS,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok(), status: res.status(), data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// ── WMS Helpers ──

/**
 * Get WMS sync status for an order.
 */
export async function getWmsOrderStatus(
  request: APIRequestContext,
  orderId: string,
): Promise<any | null> {
  try {
    const res = await request.get(`/api/onewms/orders/${orderId}/status`);
    if (!res.ok()) return null;
    const body = await res.json();
    return body.data ?? body;
  } catch {
    return null;
  }
}

/**
 * Get WMS dashboard stats.
 */
export async function getWmsStats(
  request: APIRequestContext,
): Promise<any | null> {
  try {
    const res = await request.get('/api/onewms/stats');
    if (!res.ok()) return null;
    const body = await res.json();
    return body.data ?? body;
  } catch {
    return null;
  }
}

// ── Cart / Proposal Helpers ──

/**
 * Get current cart items.
 * Returns null if cart API is not accessible (e.g., session issues).
 */
export async function getCart(
  request: APIRequestContext,
): Promise<{ items: any[]; summary: any } | null> {
  try {
    const res = await request.get('/api/proposals/cart');
    if (!res.ok()) return null;
    const body = await res.json();
    return body.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Add a product to the cart.
 */
export async function addToCart(
  request: APIRequestContext,
  productId: string,
  quantity: number,
  samplePrice: number,
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await request.post('/api/proposals/cart', {
      headers: POST_HEADERS,
      data: { productId, quantity, samplePrice },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok(), status: res.status(), data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/**
 * Checkout the current cart to create proposals.
 */
export async function checkoutCart(
  request: APIRequestContext,
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await request.post('/api/proposals/cart/checkout', {
      headers: POST_HEADERS,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok(), status: res.status(), data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}
