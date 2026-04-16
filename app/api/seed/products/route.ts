/**
 * Seed Sample Products API
 * POST /api/seed/products
 *
 * Creates sample products for E2E testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Only ADMIN can seed products
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized: ADMIN role required' } },
        { status: 403 }
      );
    }
    console.log('🌱 Seeding sample products...\n');

    // Find or create a test center
    let center = await prisma.center.findFirst({
      where: { isActive: true },
    });

    if (!center) {
      console.log('📦 Creating test center...');
      center = await prisma.center.create({
        data: {
          code: '01-1234',
          name: '테스트 센터',
          regionCode: '01',
          regionName: '서울',
          address: '서울특별시 강남구 테헤란로 123',
          representative: '테스트 매니저',
          representativePhone: '02-1234-5678',
          isActive: true,
        },
      });
      console.log(`✅ Test center created: ${center.name}\n`);
    }

    // CENTER type products
    const centerProducts = [
      {
        code: 'CENTER-001',
        name: '삼성 갤럭시 충전기',
        barcode: '8801234567890',
        sellPrice: 25000,
        supplyPrice: 18000,
        stockMujin: 50,
        stock1: 20,
        stock2: 15,
        stock3: 15,
        productType: 'CENTER' as const,
        managedBy: center.id,
        onewmsCode: null,
      },
      {
        code: 'CENTER-002',
        name: 'LG 스마트폰 케이스',
        barcode: '8801234567891',
        sellPrice: 15000,
        supplyPrice: 10000,
        stockMujin: 100,
        stock1: 40,
        stock2: 30,
        stock3: 30,
        productType: 'CENTER' as const,
        managedBy: center.id,
        onewmsCode: null,
      },
      {
        code: 'CENTER-003',
        name: '무선 이어폰 Pro',
        barcode: '8801234567892',
        sellPrice: 89000,
        supplyPrice: 65000,
        stockMujin: 30,
        stock1: 10,
        stock2: 10,
        stock3: 10,
        productType: 'CENTER' as const,
        managedBy: center.id,
        onewmsCode: null,
      },
      {
        code: 'CENTER-004',
        name: '스마트워치 밴드',
        barcode: '8801234567893',
        sellPrice: 35000,
        supplyPrice: 25000,
        stockMujin: 80,
        stock1: 30,
        stock2: 25,
        stock3: 25,
        productType: 'CENTER' as const,
        managedBy: center.id,
        onewmsCode: null,
      },
      {
        code: 'CENTER-005',
        name: 'USB-C 케이블 3m',
        barcode: '8801234567894',
        sellPrice: 12000,
        supplyPrice: 8000,
        stockMujin: 150,
        stock1: 50,
        stock2: 50,
        stock3: 50,
        productType: 'CENTER' as const,
        managedBy: center.id,
        onewmsCode: null,
      },
    ];

    const createdCenter = [];
    for (const product of centerProducts) {
      const existing = await prisma.product.findFirst({
        where: { barcode: product.barcode },
      });

      if (!existing) {
        await prisma.product.create({ data: product });
        createdCenter.push(product.name);
      }
    }

    // HEADQUARTERS type products
    const headquartersProducts = [
      {
        code: 'HQ-001',
        name: '[본사] 프리미엄 헤드폰',
        barcode: '8809876543210',
        sellPrice: 120000,
        supplyPrice: 90000,
        stockMujin: 25,
        stock1: 0,
        stock2: 0,
        stock3: 0,
        productType: 'HEADQUARTERS' as const,
        managedBy: null,
        onewmsCode: 'WMS-PRD-001',
      },
      {
        code: 'HQ-002',
        name: '[본사] 무선 키보드',
        barcode: '8809876543211',
        sellPrice: 55000,
        supplyPrice: 40000,
        stockMujin: 40,
        stock1: 0,
        stock2: 0,
        stock3: 0,
        productType: 'HEADQUARTERS' as const,
        managedBy: null,
        onewmsCode: 'WMS-PRD-002',
      },
      {
        code: 'HQ-003',
        name: '[본사] 게이밍 마우스',
        barcode: '8809876543212',
        sellPrice: 75000,
        supplyPrice: 55000,
        stockMujin: 35,
        stock1: 0,
        stock2: 0,
        stock3: 0,
        productType: 'HEADQUARTERS' as const,
        managedBy: null,
        onewmsCode: 'WMS-PRD-003',
      },
    ];

    const createdHQ = [];
    for (const product of headquartersProducts) {
      const existing = await prisma.product.findFirst({
        where: { barcode: product.barcode },
      });

      if (!existing) {
        await prisma.product.create({ data: product });
        createdHQ.push(product.name);
      }
    }

    // Summary
    const totalProducts = await prisma.product.count();
    const centerCount = await prisma.product.count({
      where: { productType: 'CENTER' },
    });
    const hqCount = await prisma.product.count({
      where: { productType: 'HEADQUARTERS' },
    });

    return NextResponse.json({
      success: true,
      message: 'Sample products seeded successfully',
      data: {
        created: {
          center: createdCenter,
          headquarters: createdHQ,
        },
        totals: {
          all: totalProducts,
          center: centerCount,
          headquarters: hqCount,
        },
        testBarcodes: {
          center: '8801234567890',
          headquarters: '8809876543210',
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Error seeding products:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to seed products',
          details: error.message,
        },
      },
      { status: 500 }
    );
  }
}
