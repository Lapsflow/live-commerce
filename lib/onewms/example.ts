/**
 * ONEWMS API Client Usage Examples
 *
 * This file demonstrates how to use the ONEWMS API client library.
 * DO NOT run this file directly. Use the examples as reference in your application.
 */

import {
  createOnewmsClient,
  setOnewmsConfig,
  OrderStatus,
  CsStatus,
  HoldStatus,
  OnewmsApiError,
} from './index';

// ============================================
// Setup
// ============================================

function setupClient() {
  // Method 1: Set config manually
  setOnewmsConfig({
    partnerKey: '52bd55d7d931cb002c8569099fe9bda1',
    domainKey: 'eb731e190a51a6364185d7cf11641aa2',
  });

  // Method 2: Auto-load from environment variables
  // Requires: ONEWMS_PARTNER_KEY, ONEWMS_DOMAIN_KEY in .env

  return createOnewmsClient();
}

// ============================================
// Order Management Examples
// ============================================

async function orderExamples() {
  const client = setupClient();

  // 1. Create a new order
  try {
    await client.createOrder({
      shop_id: 'your_shop_id', // P0: 판매처코드 (필수)
      collect_date: '2026-04-09', // 발주일 (선택)
      rows: [
        {
          order_id: 'LC-2026-04-09-001',
          shop_product_id: 'PROD-001',
          qty: 2,
          recv_name: '홍길동',
          recv_mobile: '010-1234-5678',
          recv_address: '서울시 강남구 테헤란로 123',
          product_name: '테스트 상품 1',
        },
        {
          order_id: 'LC-2026-04-09-001',
          shop_product_id: 'PROD-002',
          qty: 1,
          recv_name: '홍길동',
          recv_mobile: '010-1234-5678',
          recv_address: '서울시 강남구 테헤란로 123',
          product_name: '테스트 상품 2',
        },
      ],
    });
    console.log('✅ Order created successfully');
  } catch (error) {
    if (error instanceof OnewmsApiError) {
      console.error(`❌ API Error [${error.errorCode}]: ${error.message}`);
    }
  }

  // 2. Get order information (requires date_type, start_date, end_date)
  try {
    const orders = await client.getOrderInfo({
      date_type: 'order_date',
      start_date: '2026-04-09',
      end_date: '2026-04-09',
      order_id: 'LC-2026-04-09-001', // ✅ Changed: order_no → order_id
    });
    console.log('📦 Orders:', orders);

    if (orders.length > 0) {
      const order = orders[0];
      const status = parseInt(String(order.status || '0'), 10);
      // Check order status
      if (status === OrderStatus.RECEIVED) {
        console.log('Order is received, waiting for processing');
      } else if (status === OrderStatus.SHIPPED) {
        console.log('Order has been shipped');
      }

      // Check CS status (order_cs field)
      const csStatus = parseInt(String(order.order_cs || '0'), 10);
      if (csStatus === CsStatus.NORMAL) {
        console.log('No CS issues');
      } else if (csStatus === CsStatus.PRE_DELIVERY_FULL_CANCEL) {
        console.log('Order is cancelled before delivery');
      }
    }
  } catch (error) {
    if (error instanceof OnewmsApiError) {
      console.error(`❌ Failed to get order: ${error.message}`);
    }
  }

  // 3. Set transport number
  await client.setTransportNumber({
    seq: '12345', // ✅ Changed: order_no → seq (관리번호)
    trans_no: '1234567890123',
    trans_corp: 'CU', // ✅ Added: 택배사 (필수)
  });

  // 4. Process shipping
  await client.setTransportPos({
    trans_no: '1234567890123', // ✅ Changed: order_no → trans_no
  });

  // 5. Get invoice image
  const invoiceUrl = await client.getTransportInvoice('1234567890123');
  console.log('📄 Invoice URL:', invoiceUrl);

  // 6. Cancel shipping (if needed)
  // await client.cancelTransportPos({ trans_no: '1234567890123' }); // ✅ Changed: order_no → trans_no

  // 7. Set order label
  await client.setOrderLabel({
    seq: '12345', // ✅ Changed: order_no → seq
    label_name: 'urgent', // ✅ Changed: label → label_name
  });
}

// ============================================
// Product Management Examples
// ============================================

async function productExamples() {
  const client = setupClient();

  // 1. Add a new product
  await client.addProduct({
    product_code: 'PROD-001',
    name: '라이브 커머스 인기 상품', // ✅ Changed: product_name → name (필수)
    product_name: '라이브 커머스 인기 상품',
    barcode: '8801234567890',
  });

  // 2. Get product list (paginated)
  const productResult = await client.getProductList(1, 10);
  console.log(`📦 Products (${productResult.total} total):`);
  productResult.data.forEach((p) => {
    console.log(`  ${p.product_id}: ${p.name} (barcode: ${p.barcode})`);
  });

  // 3. Get code matching
  const match = await client.getCodeMatch('INTERNAL-001');
  console.log('🔗 Code Match:', match);
}

// ============================================
// Stock Management Examples
// ============================================

async function stockExamples() {
  const client = setupClient();

  // 1. Check current stock by product_id
  const stockData = await client.getStockInfo('product_id', '22197');
  console.log('📊 Stock Information:');
  for (const [productId, entry] of Object.entries(stockData)) {
    let totalStock = 0;
    if (entry.stock) {
      for (const wh of Object.values(entry.stock)) {
        totalStock += Number(wh.stock) || 0;
      }
    }
    console.log(`  ${productId} (barcode: ${entry.barcode}): stock=${totalStock}`);
    if (totalStock < 10) {
      console.warn(`  ⚠️  Low stock alert for ${productId}!`);
    }
  }

  // 2. Get stock transactions (paginated, nested structure)
  const txData = await client.getStockTxInfo(1, 10);
  console.log('📈 Stock Transactions (nested by product_id):');
  for (const [productId, warehouses] of Object.entries(txData)) {
    for (const [warehouseSeq, entries] of Object.entries(warehouses)) {
      console.log(`  Product ${productId}, Warehouse ${warehouseSeq}:`);
      entries.flat().forEach((e) => {
        console.log(`    ${e.job} (type=${e.job_type}): ${e.qty} units`);
      });
    }
  }

  // 3. Get detailed stock history (flat list)
  const details = await client.getStockTxDetailInfo(1, 10);

  details.forEach((detail) => {
    console.log(
      `  ${detail.crdate}: ${detail.job} ${detail.qty} units → stock: ${detail.stock}`
    );
  });
}

// ============================================
// Sheet Management Examples
// ============================================

async function sheetExamples() {
  const client = setupClient();

  // 1. Add inbound sheet
  await client.addSheet({
    sheet_type: 'STOCK_IN_SHEET', // ✅ Changed: 'INBOUND' → 'STOCK_IN_SHEET' (enum)
    sheet_date: '2026-04-09',
    products: [
      {
        product_code: 'PROD-001',
        quantity: 100,
      },
      {
        product_code: 'PROD-002',
        quantity: 50,
      },
    ],
  });

  // 2. Get recent sheets
  const sheetResult = await client.getSheetList({
    sheet_type: 'STOCK_IN_SHEET',
    date_type: 0, // 0=sheet_date
    start_date: '2026-04-01',
    end_date: '2026-04-09',
  });
  console.log(`📋 Sheets (${sheetResult.total} total):`, sheetResult.sheets.length);
}

// ============================================
// Integration with Live Commerce
// ============================================

async function liveCommerceIntegration() {
  const client = setupClient();

  // Scenario: Live commerce broadcast ended, process all orders
  const broadcastOrders = [
    {
      order_no: 'LIVE-001',
      customer_name: '김철수',
      phone: '010-1111-2222',
      address: '서울시 강남구',
      products: [{ product_code: 'PROD-001', quantity: 3 }],
    },
    {
      order_no: 'LIVE-002',
      customer_name: '이영희',
      phone: '010-3333-4444',
      address: '서울시 서초구',
      products: [{ product_code: 'PROD-002', quantity: 1 }],
    },
  ];

  // Process all orders
  for (const order of broadcastOrders) {
    try {
      // Check stock availability first
      // e.g. await client.getStockInfo('product_id', order.products[0].product_code)

      // Create order in ONEWMS
      await client.createOrder({
        shop_id: 'your_shop_id', // P0: 판매처코드
        collect_date: new Date().toISOString().split('T')[0],
        rows: order.products.map((product) => ({
          order_id: order.order_no,
          shop_product_id: product.product_code,
          qty: product.quantity,
          recv_name: order.customer_name,
          recv_mobile: order.phone,
          recv_address: order.address,
        })),
      });

      console.log(`✅ Order ${order.order_no} processed successfully`);
    } catch (error) {
      if (error instanceof OnewmsApiError) {
        console.error(
          `❌ Failed to process ${order.order_no}: ${error.message}`
        );
      }
    }
  }
}

// ============================================
// Export examples (for reference)
// ============================================

export const examples = {
  orderExamples,
  productExamples,
  stockExamples,
  sheetExamples,
  liveCommerceIntegration,
};

// Uncomment to run examples (for testing)
// (async () => {
//   await orderExamples();
//   await productExamples();
//   await stockExamples();
//   await sheetExamples();
//   await liveCommerceIntegration();
// })();
