/**
 * Data Backfill Script: Migrate to Center-Based System
 *
 * This script performs the data migration from denormalized stock1/2/3
 * to normalized ProductCenterStock model.
 *
 * Steps:
 * 1. Verify centers exist (Seoul, Gyeonggi, Incheon)
 * 2. Migrate stock1/2/3 → ProductCenterStock
 * 3. Assign users to centers based on role
 * 4. Delete test order data (as confirmed by user)
 */

import 'dotenv/config';
import { PrismaClient, Role } from '@/lib/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
const prisma = new PrismaClient({
  adapter,
} as unknown as ConstructorParameters<typeof PrismaClient>[0]);

interface MigrationStats {
  centersVerified: number;
  stocksMigrated: number;
  usersAssigned: number;
  ordersDeleted: number;
  errors: string[];
}

async function verifyCenters() {
  console.log('\n📋 Step 1: Verifying centers exist...');

  const requiredCenters = [
    { code: '01-4213', name: '서울센터' },
    { code: '02-5678', name: '경기센터' },
    { code: '03-9012', name: '인천센터' },
  ];

  const centers = await prisma.center.findMany({
    where: {
      code: { in: requiredCenters.map((c) => c.code) },
    },
  });

  if (centers.length !== 3) {
    throw new Error(
      `Expected 3 centers, found ${centers.length}. Run seed-centers.ts first.`
    );
  }

  console.log(`✅ Found ${centers.length} centers`);
  for (const center of centers) {
    console.log(`   - ${center.code}: ${center.name}`);
  }

  return centers;
}

async function migrateProductStocks(centers: any[]) {
  console.log('\n📦 Step 2: Migrating product stocks...');

  const seoulCenter = centers.find((c) => c.regionCode === '01')!;
  const gyeonggiCenter = centers.find((c) => c.regionCode === '02')!;
  const incheonCenter = centers.find((c) => c.regionCode === '03')!;

  // Get all products
  const products = await prisma.product.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      stock1: true,
      stock2: true,
      stock3: true,
    },
  });

  console.log(`📊 Found ${products.length} products to migrate`);

  let migratedCount = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      // Create ProductCenterStock entries for each center
      const stockMappings = [
        { centerId: seoulCenter.id, stock: product.stock1, centerName: '서울' },
        {
          centerId: gyeonggiCenter.id,
          stock: product.stock2,
          centerName: '경기',
        },
        {
          centerId: incheonCenter.id,
          stock: product.stock3,
          centerName: '인천',
        },
      ];

      for (const mapping of stockMappings) {
        // Check if already exists
        const existing = await prisma.productCenterStock.findUnique({
          where: {
            productId_centerId: {
              productId: product.id,
              centerId: mapping.centerId,
            },
          },
        });

        if (!existing) {
          await prisma.productCenterStock.create({
            data: {
              productId: product.id,
              centerId: mapping.centerId,
              stock: mapping.stock,
            },
          });
        }
      }

      migratedCount++;
      if (migratedCount % 50 === 0) {
        console.log(`   Processed ${migratedCount}/${products.length} products...`);
      }
    } catch (error) {
      const errorMsg = `Failed to migrate product ${product.code}: ${error}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  console.log(`✅ Migrated ${migratedCount} products to ProductCenterStock`);
  return { migratedCount, errors };
}

async function assignUsersToCenter(centers: any[]) {
  console.log('\n👥 Step 3: Assigning users to centers...');

  const seoulCenter = centers.find((c) => c.regionCode === '01')!;

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, centerId: true },
  });

  console.log(`📊 Found ${users.length} users to process`);

  let assignedCount = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      // Skip if already assigned
      if (user.centerId) {
        console.log(`   ⏭️  User ${user.email} already assigned to a center`);
        continue;
      }

      // MASTER has no center assignment
      if (user.role === Role.MASTER) {
        console.log(`   ⏭️  User ${user.email} is MASTER, no center assignment`);
        continue;
      }

      // Assign all other roles to Seoul center by default
      await prisma.user.update({
        where: { id: user.id },
        data: { centerId: seoulCenter.id },
      });

      console.log(
        `   ✅ Assigned user ${user.email} (${user.role}) to Seoul center`
      );
      assignedCount++;
    } catch (error) {
      const errorMsg = `Failed to assign user ${user.email}: ${error}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  console.log(`✅ Assigned ${assignedCount} users to centers`);
  return { assignedCount, errors };
}

async function deleteTestOrders() {
  console.log('\n🗑️  Step 4: Deleting test order data...');

  // Count orders first
  const orderCount = await prisma.order.count();

  if (orderCount === 0) {
    console.log('   ℹ️  No orders to delete');
    return { deletedCount: 0, errors: [] };
  }

  console.log(`📊 Found ${orderCount} orders`);

  try {
    // Delete all orders (cascade will delete related OrderItems)
    const result = await prisma.order.deleteMany({});

    console.log(`✅ Deleted ${result.count} test orders`);
    return { deletedCount: result.count, errors: [] };
  } catch (error) {
    const errorMsg = `Failed to delete orders: ${error}`;
    console.error(`❌ ${errorMsg}`);
    return { deletedCount: 0, errors: [errorMsg] };
  }
}

async function runBackfill(): Promise<MigrationStats> {
  console.log('🚀 Starting Center Data Backfill Migration');
  console.log('==========================================\n');

  const stats: MigrationStats = {
    centersVerified: 0,
    stocksMigrated: 0,
    usersAssigned: 0,
    ordersDeleted: 0,
    errors: [],
  };

  try {
    // Step 1: Verify centers
    const centers = await verifyCenters();
    stats.centersVerified = centers.length;

    // Step 2: Migrate product stocks
    const stockResult = await migrateProductStocks(centers);
    stats.stocksMigrated = stockResult.migratedCount;
    stats.errors.push(...stockResult.errors);

    // Step 3: Assign users to centers
    const userResult = await assignUsersToCenter(centers);
    stats.usersAssigned = userResult.assignedCount;
    stats.errors.push(...userResult.errors);

    // Step 4: Delete test orders
    const orderResult = await deleteTestOrders();
    stats.ordersDeleted = orderResult.deletedCount;
    stats.errors.push(...orderResult.errors);

    console.log('\n✅ Migration Complete!');
    console.log('==========================================');
    console.log(`📊 Summary:`);
    console.log(`   Centers verified: ${stats.centersVerified}`);
    console.log(`   Products migrated: ${stats.stocksMigrated}`);
    console.log(`   Users assigned: ${stats.usersAssigned}`);
    console.log(`   Orders deleted: ${stats.ordersDeleted}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }

    return stats;
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runBackfill()
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { runBackfill };
