/**
 * ONEWMS Auto-Register Service
 *
 * 바코드 스캔 시 DB에 없는 상품을 ONEWMS에서 검색하여 자동 등록.
 * 크론에서도 신규 상품 자동 임포트에 사용.
 *
 * Flow:
 * 1. getStockInfo('barcode', barcode) → 재고 + product_id 확인
 * 2. getProductList() 캐시에서 product_id로 상품 상세 조회
 * 3. DB에 Product 생성 (autoCreated=true)
 * 4. 감사 로그 + 알림 발송
 */

import { prisma } from '@/lib/db/prisma';
import { createOnewmsClient } from '@/lib/onewms';
import type { ProductInfo } from '@/lib/onewms/types';
import { logAudit } from '@/lib/services/audit';
import { sendNotification } from '@/lib/services/notifications';

// ─── ONEWMS Product List Cache (1시간 TTL) ───

let productListCache: Map<string, ProductInfo> | null = null;
let productListCacheAt = 0;
const PRODUCT_LIST_CACHE_TTL = 60 * 60 * 1000; // 1시간

/**
 * ONEWMS 전체 상품 목록을 메모리 캐시로 로드.
 * product_id → ProductInfo 맵 반환.
 */
export async function getOnewmsProductMap(): Promise<Map<string, ProductInfo>> {
  if (productListCache && Date.now() - productListCacheAt < PRODUCT_LIST_CACHE_TTL) {
    return productListCache;
  }

  const client = createOnewmsClient();
  const map = new Map<string, ProductInfo>();

  for (let page = 1; page <= 20; page++) {
    const { data: products, total } = await client.getProductList(page, 100);
    for (const p of products) {
      if (p.product_id) map.set(p.product_id, p);
    }
    if (page * 100 >= total) break;
  }

  productListCache = map;
  productListCacheAt = Date.now();
  console.log(`[AUTO-REGISTER] Product list cache loaded: ${map.size} products`);
  return map;
}

/** 캐시 강제 초기화 (테스트 또는 크론 갱신용) */
export function clearProductListCache(): void {
  productListCache = null;
  productListCacheAt = 0;
}

// ─── Core Functions ───

interface AutoRegisterResult {
  product: {
    id: string;
    name: string;
    code: string;
    barcode: string;
    sellPrice: number;
    supplyPrice: number;
    onewmsCode: string;
    totalStock: number;
  };
  stockSource: 'onewms';
  stockFetchedAt: string;
}

/**
 * 바코드로 ONEWMS에서 상품을 검색하여 자동 등록.
 *
 * @returns 등록된 상품 정보 또는 null (ONEWMS에도 없는 경우)
 */
export async function autoRegisterFromOnewms(
  barcode: string
): Promise<AutoRegisterResult | null> {
  const client = createOnewmsClient();

  // 1. ONEWMS에서 바코드로 재고 검색 → product_id 확인
  let stockData;
  try {
    stockData = await client.getStockInfo('barcode', barcode);
  } catch (err) {
    console.error(`[AUTO-REGISTER] getStockInfo failed for barcode ${barcode}:`, err);
    return null;
  }

  // stockData: { [product_id]: { product_id, link_id, barcode, stock: { ... } } }
  const entries = Object.values(stockData);
  if (entries.length === 0) {
    console.log(`[AUTO-REGISTER] Barcode ${barcode} not found in ONEWMS`);
    return null;
  }

  const stockEntry = entries[0] as {
    product_id: string;
    link_id?: string;
    barcode?: string;
    stock?: Record<string, { warehouse_seq?: string; stock: number | string }>;
  };
  const onewmsProductId = stockEntry.product_id;

  if (!onewmsProductId) {
    console.error(`[AUTO-REGISTER] No product_id in stock response for barcode ${barcode}`);
    return null;
  }

  // 총 재고 계산
  let totalStock = 0;
  if (stockEntry.stock) {
    for (const wh of Object.values(stockEntry.stock)) {
      totalStock += Number(wh.stock) || 0;
    }
  }

  // 2. 상품 상세 정보 조회 (캐시된 전체 목록에서)
  const productMap = await getOnewmsProductMap();
  const onewmsProduct = productMap.get(onewmsProductId);

  if (!onewmsProduct) {
    console.warn(
      `[AUTO-REGISTER] product_id ${onewmsProductId} found in stock but not in product list. Registering with limited info.`
    );
  }

  // 3. DB에 상품 생성
  const code = `WMS-${onewmsProductId}`;
  const productName = onewmsProduct?.name || `WMS Product ${onewmsProductId}`;
  const sellPrice = parseInt(String(onewmsProduct?.shop_price || '0'), 10) || 0;
  const supplyPrice = parseInt(String(onewmsProduct?.supply_price || '0'), 10) || 0;
  const originalPrice = parseInt(String(onewmsProduct?.org_price || '0'), 10) || 0;

  // 바코드 중복 체크
  const existingBarcode = await prisma.product.findUnique({
    where: { barcode },
    select: { id: true },
  });

  let dbBarcode = barcode;
  if (existingBarcode) {
    // 바코드 이미 다른 상품에 사용 중 → suffix 추가
    dbBarcode = `${barcode}-${onewmsProductId}`;
  }

  // onewmsCode 중복 체크 (이미 등록된 경우 → 업데이트만)
  const existingOnewms = await prisma.product.findUnique({
    where: { onewmsCode: onewmsProductId },
    select: { id: true, name: true, code: true, barcode: true, sellPrice: true, supplyPrice: true },
  });

  let product;
  if (existingOnewms) {
    // 이미 onewmsCode로 등록됨 → 재고만 업데이트
    product = await prisma.product.update({
      where: { onewmsCode: onewmsProductId },
      data: { totalStock },
    });
  } else {
    // code 중복 체크
    const existingCode = await prisma.product.findUnique({
      where: { code },
      select: { id: true },
    });

    const finalCode = existingCode ? `WMS-${onewmsProductId}-${Date.now().toString(36)}` : code;

    product = await prisma.product.create({
      data: {
        code: finalCode,
        name: productName,
        barcode: dbBarcode,
        sellPrice,
        supplyPrice,
        originalPrice,
        totalStock,
        onewmsCode: onewmsProductId,
        onewmsBarcode: barcode,
        productType: 'HEADQUARTERS',
        isWmsProduct: true,
        isActive: true,
        autoCreated: true,
        autoCreatedAt: new Date(),
      },
    });

    console.log(
      `[AUTO-REGISTER] Created product: ${product.name} (${product.code}, barcode: ${product.barcode})`
    );

    // 4. 감사 로그
    logAudit({
      userId: null,
      userRole: 'MASTER',
      userName: '시스템',
      action: 'CREATE',
      entityType: 'Product',
      entityId: product.id,
      entityName: product.name,
      after: {
        code: product.code,
        barcode: product.barcode,
        onewmsCode: onewmsProductId,
        sellPrice,
        supplyPrice,
        totalStock,
        autoCreated: true,
      },
      description: `[자동등록] ONEWMS 바코드 스캔으로 상품 자동 등록: ${product.name}`,
    });

    // 5. 마스터 알림 (비동기, 실패해도 무시)
    notifyMasterAutoCreated(product.name, product.barcode).catch(() => {});
  }

  return {
    product: {
      id: product.id,
      name: product.name,
      code: product.code,
      barcode: product.barcode,
      sellPrice: product.sellPrice,
      supplyPrice: product.supplyPrice,
      onewmsCode: onewmsProductId,
      totalStock,
    },
    stockSource: 'onewms',
    stockFetchedAt: new Date().toISOString(),
  };
}

/**
 * 마스터 역할 사용자에게 자동 등록 알림 발송
 */
async function notifyMasterAutoCreated(productName: string, barcode: string): Promise<void> {
  const masters = await prisma.user.findMany({
    where: { role: 'MASTER', isActive: true },
    select: { name: true, phone: true },
    take: 5,
  });

  for (const master of masters) {
    await sendNotification({
      type: 'PRODUCT_AUTO_CREATED',
      recipient: { name: master.name, phone: master.phone },
      variables: {
        productName,
        barcode,
        message: `[자동등록] ${productName} (바코드: ${barcode})가 ONEWMS에서 자동 등록되었습니다. 검토해주세요.`,
      },
    });
  }
}
