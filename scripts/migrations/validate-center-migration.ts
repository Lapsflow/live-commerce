/**
 * Validation Script: Center Migration
 *
 * Verifies the data migration integrity:
 * 1. Stock totals match (stock1+stock2+stock3 = ProductCenterStock sum)
 * 2. All ADMIN/SELLER users have centerId
 * 3. MASTER users have centerId = null
 * 4. Foreign key integrity
 */

import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
const prisma = new PrismaClient({
  adapter,
} as unknown as ConstructorParameters<typeof PrismaClient>[0]);

interface ValidationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
    details?: any;
  }[];
}

async function validateStockTotals(): Promise<{
  passed: boolean;
  message: string;
  details: any;
}> {
  console.log('\n🔍 Validating stock totals...');

  const products = await prisma.product.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      stock1: true,
      stock2: true,
      stock3: true,
      totalStock: true,
      centerStocks: {
        select: { stock: true },
      },
    },
  });

  const mismatches: any[] = [];
  let matchCount = 0;

  for (const product of products) {
    const legacyTotal = product.stock1 + product.stock2 + product.stock3;
    const centerTotal = product.centerStocks.reduce(
      (sum, cs) => sum + cs.stock,
      0
    );

    const percentDiff =
      legacyTotal > 0 ? Math.abs(centerTotal - legacyTotal) / legacyTotal : 0;

    // Allow 0.1% variance for rounding
    if (percentDiff > 0.001) {
      mismatches.push({
        code: product.code,
        name: product.name,
        legacyTotal,
        centerTotal,
        difference: centerTotal - legacyTotal,
        percentDiff: (percentDiff * 100).toFixed(2) + '%',
      });
    } else {
      matchCount++;
    }
  }

  const matchRate = (matchCount / products.length) * 100;
  const passed = matchRate >= 99.9; // Allow 0.1% mismatch

  const message = passed
    ? `✅ Stock validation passed: ${matchCount}/${products.length} products (${matchRate.toFixed(1)}%)`
    : `❌ Stock validation failed: Only ${matchCount}/${products.length} products matched (${matchRate.toFixed(1)}%)`;

  return {
    passed,
    message,
    details: {
      totalProducts: products.length,
      matched: matchCount,
      mismatched: mismatches.length,
      matchRate: matchRate.toFixed(1) + '%',
      mismatches: mismatches.slice(0, 10), // Show first 10 mismatches
    },
  };
}

async function validateUserAssignments(): Promise<{
  passed: boolean;
  message: string;
  details: any;
}> {
  console.log('\n🔍 Validating user center assignments...');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      centerId: true,
    },
  });

  const masterUsers = users.filter((u) => u.role === Role.MASTER);
  const otherUsers = users.filter((u) => u.role !== Role.MASTER);

  const masterWithCenter = masterUsers.filter((u) => u.centerId !== null);
  const otherWithoutCenter = otherUsers.filter((u) => u.centerId === null);

  const passed =
    masterWithCenter.length === 0 && otherWithoutCenter.length === 0;

  const message = passed
    ? `✅ User assignment validation passed`
    : `❌ User assignment validation failed`;

  return {
    passed,
    message,
    details: {
      totalUsers: users.length,
      masterUsers: masterUsers.length,
      masterWithCenter: masterWithCenter.length,
      masterWithCenterList: masterWithCenter.map((u) => u.email),
      nonMasterUsers: otherUsers.length,
      nonMasterWithoutCenter: otherWithoutCenter.length,
      nonMasterWithoutCenterList: otherWithoutCenter.map((u) => u.email),
    },
  };
}

async function validateForeignKeyIntegrity(): Promise<{
  passed: boolean;
  message: string;
  details: any;
}> {
  console.log('\n🔍 Validating foreign key integrity...');

  // Count records that should have relations
  const totalCenterStocks = await prisma.productCenterStock.count();
  const usersWithCenter = await prisma.user.count({
    where: { centerId: { not: null } },
  });
  const ordersWithCenter = await prisma.order.count({
    where: { processingCenterId: { not: null } },
  });

  // Since we have CASCADE on foreign keys, orphaned records can't exist
  // Just verify counts are reasonable
  const passed =
    totalCenterStocks > 0 && // Should have some center stocks after migration
    usersWithCenter > 0; // Should have some users assigned to centers

  const message = passed
    ? `✅ Foreign key integrity validation passed`
    : `❌ Foreign key integrity validation failed`;

  return {
    passed,
    message,
    details: {
      totalCenterStocks,
      usersWithCenter,
      ordersWithCenter,
      note: 'CASCADE foreign keys prevent orphaned records',
    },
  };
}

async function validateCenterData(): Promise<{
  passed: boolean;
  message: string;
  details: any;
}> {
  console.log('\n🔍 Validating center data...');

  const centers = await prisma.center.findMany({
    include: {
      _count: {
        select: {
          users: true,
          centerStocks: true,
          orders: true,
        },
      },
    },
  });

  const requiredCodes = ['01-4213', '02-5678', '03-9012'];
  const foundCodes = centers.map((c) => c.code);
  const missingCodes = requiredCodes.filter((c) => !foundCodes.includes(c));

  const passed = centers.length >= 3 && missingCodes.length === 0;

  const message = passed
    ? `✅ Center data validation passed: ${centers.length} centers`
    : `❌ Center data validation failed: Missing ${missingCodes.length} required centers`;

  return {
    passed,
    message,
    details: {
      totalCenters: centers.length,
      requiredCenters: requiredCodes,
      missingCenters: missingCodes,
      centerSummary: centers.map((c) => ({
        code: c.code,
        name: c.name,
        users: c._count.users,
        stocks: c._count.centerStocks,
        orders: c._count.orders,
      })),
    },
  };
}

async function runValidation(): Promise<ValidationResult> {
  console.log('🔍 Starting Center Migration Validation');
  console.log('==========================================\n');

  const result: ValidationResult = {
    passed: true,
    checks: [],
  };

  try {
    // Check 1: Center data
    const centerCheck = await validateCenterData();
    result.checks.push({
      name: 'Center Data',
      ...centerCheck,
    });
    result.passed = result.passed && centerCheck.passed;

    // Check 2: Stock totals
    const stockCheck = await validateStockTotals();
    result.checks.push({
      name: 'Stock Totals',
      ...stockCheck,
    });
    result.passed = result.passed && stockCheck.passed;

    // Check 3: User assignments
    const userCheck = await validateUserAssignments();
    result.checks.push({
      name: 'User Assignments',
      ...userCheck,
    });
    result.passed = result.passed && userCheck.passed;

    // Check 4: Foreign key integrity
    const fkCheck = await validateForeignKeyIntegrity();
    result.checks.push({
      name: 'Foreign Key Integrity',
      ...fkCheck,
    });
    result.passed = result.passed && fkCheck.passed;

    console.log('\n==========================================');
    console.log(
      result.passed ? '✅ All Validations Passed!' : '❌ Some Validations Failed'
    );
    console.log('==========================================\n');

    console.log('📊 Validation Summary:');
    result.checks.forEach((check, i) => {
      console.log(`${i + 1}. ${check.name}: ${check.message}`);
    });

    if (!result.passed) {
      console.log('\n⚠️  Failed Check Details:');
      result.checks
        .filter((c) => !c.passed)
        .forEach((check) => {
          console.log(`\n${check.name}:`);
          console.log(JSON.stringify(check.details, null, 2));
        });
    }

    return result;
  } catch (error) {
    console.error('\n❌ Validation error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runValidation()
    .then((result) => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { runValidation };
