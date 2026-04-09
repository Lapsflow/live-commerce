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
      order_no: 'LC-2026-04-09-001',
      order_date: '2026-04-09',
      recipient_name: '홍길동',
      recipient_phone: '010-1234-5678',
      recipient_address: '서울시 강남구 테헤란로 123',
      products: [
        {
          product_code: 'PROD-001',
          quantity: 2,
        },
        {
          product_code: 'PROD-002',
          quantity: 1,
        },
      ],
    });
    console.log('✅ Order created successfully');
  } catch (error) {
    if (error instanceof OnewmsApiError) {
      console.error(`❌ API Error [${error.code}]: ${error.message}`);
    }
  }

  // 2. Get order information
  try {
    const order = await client.getOrderInfo('LC-2026-04-09-001');
    console.log('📦 Order:', order);

    // Check order status
    if (order.order_status === OrderStatus.RECEIVED) {
      console.log('Order is received, waiting for processing');
    } else if (order.order_status === OrderStatus.SHIPPED) {
      console.log('Order has been shipped');
    }

    // Check CS status
    if (order.cs_status === CsStatus.NORMAL) {
      console.log('No CS issues');
    } else if (order.cs_status === CsStatus.PRE_DELIVERY_FULL_CANCEL) {
      console.log('Order is cancelled before delivery');
    }
  } catch (error) {
    if (error instanceof OnewmsApiError) {
      console.error(`❌ Failed to get order: ${error.message}`);
    }
  }

  // 3. Set transport number
  await client.setTransportNumber({
    order_no: 'LC-2026-04-09-001',
    trans_no: '1234567890123',
  });

  // 4. Process shipping
  await client.setTransportPos({
    order_no: 'LC-2026-04-09-001',
  });

  // 5. Get invoice image
  const invoiceUrl = await client.getTransportInvoice('1234567890123');
  console.log('📄 Invoice URL:', invoiceUrl);

  // 6. Cancel shipping (if needed)
  // await client.cancelTransportPos({ order_no: 'LC-2026-04-09-001' });

  // 7. Set order label
  await client.setOrderLabel({
    order_no: 'LC-2026-04-09-001',
    label: 'urgent',
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
    product_name: '라이브 커머스 인기 상품',
    barcode: '8801234567890',
  });

  // 2. Get product information
  const product = await client.getProductInfo('PROD-001');
  console.log('📦 Product:', product);
  console.log(`  Name: ${product.product_name}`);
  console.log(`  Barcode: ${product.barcode}`);

  // 3. Get code matching
  const match = await client.getCodeMatch('INTERNAL-001');
  console.log('🔗 Code Match:', match);
}

// ============================================
// Stock Management Examples
// ============================================

async function stockExamples() {
  const client = setupClient();

  // 1. Check current stock
  const stock = await client.getStockInfo('PROD-001');
  console.log('📊 Stock Information:');
  console.log(`  Available: ${stock.available_qty}`);
  console.log(`  Total: ${stock.total_qty}`);

  // Alert if low stock
  if (stock.available_qty && stock.available_qty < 10) {
    console.warn('⚠️  Low stock alert!');
  }

  // 2. Get stock transactions (last 7 days)
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const transactions = await client.getStockTxInfo(
    'PROD-001',
    lastWeek.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  );

  console.log('📈 Recent Transactions:', transactions.length);
  transactions.forEach((tx) => {
    console.log(
      `  ${tx.trans_date}: ${tx.trans_type} ${tx.trans_qty} units`
    );
  });

  // 3. Get detailed stock history
  const details = await client.getStockTxDetailInfo(
    'PROD-001',
    lastWeek.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  );

  details.forEach((detail) => {
    console.log(
      `  ${detail.trans_date}: ${detail.before_qty} → ${detail.after_qty}`
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
    sheet_type: 'INBOUND',
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
  const sheets = await client.getSheetList('2026-04-01', '2026-04-09');
  console.log('📋 Sheets:', sheets.length);
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
      for (const product of order.products) {
        const stock = await client.getStockInfo(product.product_code);
        if (!stock.available_qty || stock.available_qty < product.quantity) {
          console.error(
            `❌ Insufficient stock for ${product.product_code}`
          );
          continue;
        }
      }

      // Create order in ONEWMS
      await client.createOrder({
        order_no: order.order_no,
        order_date: new Date().toISOString().split('T')[0],
        recipient_name: order.customer_name,
        recipient_phone: order.phone,
        recipient_address: order.address,
        products: order.products,
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
