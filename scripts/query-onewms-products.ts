import { prisma } from '@/lib/db/prisma';

async function main() {
  try {
    console.log('Querying products with onewmsCode...');

    const products = await prisma.product.findMany({
      where: {
        onewmsCode: { not: null },
      },
      select: {
        id: true,
        code: true,
        name: true,
        barcode: true,
        onewmsCode: true,
        productType: true,
        managedBy: true,
      },
      take: 5,
    });

    console.log('Products with onewmsCode (first 5):');
    console.log(JSON.stringify(products, null, 2));

    // Also check total count
    const count = await prisma.product.count({
      where: { onewmsCode: { not: null } },
    });
    console.log('\nTotal products with onewmsCode:', count);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
