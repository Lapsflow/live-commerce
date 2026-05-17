import { prisma } from '@/lib/db/prisma';

async function main() {
  try {
    console.log('📊 Checking OnewmsOrderMapping table...\n');

    // Get latest order mappings
    const mappings = await prisma.onewmsOrderMapping.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        orderId: true,
        onewmsOrderNo: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (mappings.length === 0) {
      console.log('⚠️  No OnewmsOrderMapping records found');
      return;
    }

    console.log(`✅ Found ${mappings.length} recent order mappings:\n`);
    mappings.forEach((m, i) => {
      console.log(`${i + 1}. Order ID: ${m.orderId}`);
      console.log(`   ONEWMS Order No: ${m.onewmsOrderNo || '(not set)'}`);
      console.log(`   Status: ${m.status}`);
      console.log(`   Error: ${m.errorMessage || '(none)'}`);
      console.log(`   Created: ${m.createdAt.toISOString()}`);
      console.log('');
    });
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}

main();
