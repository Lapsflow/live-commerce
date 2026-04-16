import { PrismaClient } from '@/lib/generated/prisma/client';

const db = new PrismaClient();

/**
 * Warehouse Seed Script
 *
 * Creates the 6 warehouse records for multi-warehouse support:
 * 1. 한국무진 (OWNED) - Main warehouse, owns the official barcode master
 * 2. 쓰리백 (PARTNER)
 * 3-6. 거래처2-5 (EXTERNAL)
 */
async function seedWarehouses() {
  console.log('🏭 Seeding warehouses...');

  const warehouses = [
    {
      code: 'KOREA_MUJIN',
      name: '한국무진',
      type: 'OWNED',
      syncEnabled: true,
    },
    {
      code: 'THREEBACK',
      name: '쓰리백',
      type: 'PARTNER',
      syncEnabled: true,
    },
    {
      code: 'PARTNER_02',
      name: '거래처2',
      type: 'EXTERNAL',
      syncEnabled: true,
    },
    {
      code: 'PARTNER_03',
      name: '거래처3',
      type: 'EXTERNAL',
      syncEnabled: true,
    },
    {
      code: 'PARTNER_04',
      name: '거래처4',
      type: 'EXTERNAL',
      syncEnabled: true,
    },
    {
      code: 'PARTNER_05',
      name: '거래처5',
      type: 'EXTERNAL',
      syncEnabled: true,
    },
  ];

  for (const warehouse of warehouses) {
    const existing = await db.warehouse.findUnique({
      where: { code: warehouse.code },
    });

    if (existing) {
      console.log(`  ✓ ${warehouse.name} already exists`);
      continue;
    }

    await db.warehouse.create({
      data: warehouse,
    });

    console.log(`  ✅ Created: ${warehouse.name} (${warehouse.code})`);
  }

  console.log('✅ Warehouse seeding complete!\n');
}

async function main() {
  try {
    await seedWarehouses();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
