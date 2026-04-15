import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
const prisma = new PrismaClient({
  adapter,
} as unknown as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Users (MASTER 1명, ADMIN 2명, SELLER 5명)
  const masterPassword = await bcrypt.hash("master1234", 10);
  const adminPassword = await bcrypt.hash("admin1234", 10);
  const sellerPassword = await bcrypt.hash("seller1234", 10);

  const master = await prisma.user.upsert({
    where: { email: "master@live-commerce.com" },
    update: {
      passwordHash: masterPassword,
      contractStatus: "APPROVED",
    },
    create: {
      email: "master@live-commerce.com",
      name: "Master Admin",
      phone: "010-1234-5678",
      role: "MASTER",
      passwordHash: masterPassword,
      contractStatus: "APPROVED",
    },
  });

  const admin1 = await prisma.user.upsert({
    where: { email: "admin1@live-commerce.com" },
    update: {
      passwordHash: adminPassword,
      contractStatus: "APPROVED",
    },
    create: {
      email: "admin1@live-commerce.com",
      name: "Admin 1",
      phone: "010-2345-6789",
      role: "ADMIN",
      passwordHash: adminPassword,
      contractStatus: "APPROVED",
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { email: "admin2@live-commerce.com" },
    update: {
      passwordHash: adminPassword,
      contractStatus: "APPROVED",
    },
    create: {
      email: "admin2@live-commerce.com",
      name: "Admin 2",
      phone: "010-3456-7890",
      role: "ADMIN",
      passwordHash: adminPassword,
      contractStatus: "APPROVED",
    },
  });

  const sellers = await Promise.all([
    prisma.user.upsert({
      where: { email: "seller1@live-commerce.com" },
      update: {
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
      create: {
        email: "seller1@live-commerce.com",
        name: "Seller 1",
        phone: "010-4567-8901",
        role: "SELLER",
        adminId: admin1.id,
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
    }),
    prisma.user.upsert({
      where: { email: "seller2@live-commerce.com" },
      update: {
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
      create: {
        email: "seller2@live-commerce.com",
        name: "Seller 2",
        phone: "010-5678-9012",
        role: "SELLER",
        adminId: admin1.id,
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
    }),
    prisma.user.upsert({
      where: { email: "seller3@live-commerce.com" },
      update: {
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
      create: {
        email: "seller3@live-commerce.com",
        name: "Seller 3",
        phone: "010-6789-0123",
        role: "SELLER",
        adminId: admin2.id,
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
    }),
    prisma.user.upsert({
      where: { email: "seller4@live-commerce.com" },
      update: {
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
      create: {
        email: "seller4@live-commerce.com",
        name: "Seller 4",
        phone: "010-7890-1234",
        role: "SELLER",
        adminId: admin2.id,
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
    }),
    prisma.user.upsert({
      where: { email: "seller5@live-commerce.com" },
      update: {
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
      create: {
        email: "seller5@live-commerce.com",
        name: "Seller 5",
        phone: "010-8901-2345",
        role: "SELLER",
        passwordHash: sellerPassword,
        contractStatus: "APPROVED",
      },
    }),
  ]);

  console.log(`✅ Created ${1 + 2 + sellers.length} users`);

  // 2. Products (20개 샘플)
  const products = await Promise.all(
    Array.from({ length: 20 }, (_, i) => {
      const num = i + 1;
      return prisma.product.upsert({
        where: { code: `P${num.toString().padStart(3, "0")}` },
        update: {},
        create: {
          code: `P${num.toString().padStart(3, "0")}`,
          name: `상품 ${num}`,
          barcode: `88${num.toString().padStart(11, "0")}`,
          sellPrice: 10000 + num * 1000,
          supplyPrice: 7000 + num * 700,
          totalStock: 100 + num * 10,
          stockMujin: 50 + num * 5,
          stock1: 20 + num * 2,
          stock2: 20 + num * 2,
          stock3: 10 + num,
        },
      });
    })
  );

  console.log(`✅ Created ${products.length} products`);

  // 3. Centers (3개 샘플 - 서울, 경기, 부산)
  const centers = await Promise.all([
    prisma.center.upsert({
      where: { code: "01-4213" },
      update: {},
      create: {
        code: "01-4213",
        name: "서울 강남센터",
        regionCode: "01",
        regionName: "서울",
        representative: "김서울",
        representativePhone: "010-1234-4213",
        address: "서울특별시 강남구 테헤란로 123",
        addressDetail: "ABC빌딩 3층",
        businessNo: "123-45-67890",
      },
    }),
    prisma.center.upsert({
      where: { code: "02-5678" },
      update: {},
      create: {
        code: "02-5678",
        name: "경기 수원센터",
        regionCode: "02",
        regionName: "경기",
        representative: "박경기",
        representativePhone: "010-2345-5678",
        address: "경기도 수원시 영통구 광교로 456",
        addressDetail: "DEF타워 5층",
      },
    }),
    prisma.center.upsert({
      where: { code: "06-9012" },
      update: {},
      create: {
        code: "06-9012",
        name: "부산 해운대센터",
        regionCode: "06",
        regionName: "부산",
        representative: "최부산",
        representativePhone: "010-3456-9012",
        address: "부산광역시 해운대구 해운대로 789",
      },
    }),
  ]);

  console.log(`✅ Created ${centers.length} centers`);

  // 4. ProductCenterStock (각 상품을 3개 센터에 재고 분산)
  const productCenterStocks = await Promise.all(
    products.flatMap((product, i) => {
      const num = i + 1;
      const totalStock = 100 + num * 10; // Product의 totalStock과 동일

      // 재고를 3개 센터에 분산 (예: 110개 → 50, 30, 30)
      const stock1 = Math.floor(totalStock * 0.45);
      const stock2 = Math.floor(totalStock * 0.27);
      const stock3 = totalStock - stock1 - stock2;

      return [
        prisma.productCenterStock.upsert({
          where: {
            productId_centerId: {
              productId: product.id,
              centerId: centers[0].id,
            },
          },
          update: {},
          create: {
            productId: product.id,
            centerId: centers[0].id,
            stock: stock1,
            location: "1층",
          },
        }),
        prisma.productCenterStock.upsert({
          where: {
            productId_centerId: {
              productId: product.id,
              centerId: centers[1].id,
            },
          },
          update: {},
          create: {
            productId: product.id,
            centerId: centers[1].id,
            stock: stock2,
            location: "2층",
          },
        }),
        prisma.productCenterStock.upsert({
          where: {
            productId_centerId: {
              productId: product.id,
              centerId: centers[2].id,
            },
          },
          update: {},
          create: {
            productId: product.id,
            centerId: centers[2].id,
            stock: stock3,
            location: "3층",
          },
        }),
      ];
    })
  );

  console.log(`✅ Created ${productCenterStocks.length} product-center stocks`);

  // 5. Orders (10개 샘플)
  const orders = await Promise.all(
    sellers.slice(0, 5).map(async (seller, i) => {
      const orderNo = `ORD${new Date().getFullYear()}${(i + 1).toString().padStart(4, "0")}`;
      return prisma.order.create({
        data: {
          orderNo,
          sellerId: seller.id,
          adminId: seller.adminId,
          status: i % 3 === 0 ? "APPROVED" : i % 3 === 1 ? "PENDING" : "REJECTED",
          totalAmount: 50000 + i * 10000,
          memo: i % 2 === 0 ? `발주 메모 ${i + 1}` : undefined,
          uploadedAt: new Date(Date.now() - i * 86400000), // i일 전
          approvedAt: i % 3 === 0 ? new Date() : undefined,
        },
      });
    })
  );

  console.log(`✅ Created ${orders.length} orders`);

  // 6. Broadcasts (5개 샘플)
  const broadcasts = await Promise.all(
    sellers.slice(0, 5).map((seller, i) => {
      const platforms: Array<"GRIP" | "CLME" | "YOUTUBE" | "TIKTOK" | "BAND"> = [
        "GRIP",
        "CLME",
        "YOUTUBE",
        "TIKTOK",
        "BAND",
      ];
      const statuses: Array<"SCHEDULED" | "LIVE" | "ENDED"> = [
        "SCHEDULED",
        "LIVE",
        "ENDED",
      ];
      const code = `BC${new Date().getFullYear()}${(i + 1).toString().padStart(4, "0")}`;

      return prisma.broadcast.upsert({
        where: { code },
        update: {},
        create: {
          code,
          sellerId: seller.id,
          platform: platforms[i % platforms.length],
          scheduledAt: new Date(Date.now() + (i - 2) * 86400000), // i-2일 후
          startedAt: i < 2 ? new Date(Date.now() - 3600000) : undefined, // 1시간 전
          endedAt: i === 0 ? new Date() : undefined,
          status: statuses[i % 3],
          memo: `방송 메모 ${i + 1}`,
        },
      });
    })
  );

  console.log(`✅ Created ${broadcasts.length} broadcasts`);

  // 7. Sales (15개 샘플)
  const sales = await Promise.all(
    Array.from({ length: 15 }, async (_, i) => {
      const seller = sellers[i % sellers.length];
      const product = products[i % products.length];
      const broadcast = i < broadcasts.length ? broadcasts[i] : null;

      return prisma.sale.create({
        data: {
          saleNo: `SALE${new Date().getFullYear()}${(i + 1).toString().padStart(5, "0")}`,
          sellerId: seller.id,
          productId: product.id,
          broadcastId: broadcast?.id,
          quantity: 1 + (i % 5),
          unitPrice: product.sellPrice,
          totalPrice: product.sellPrice * (1 + (i % 5)),
          saleDate: new Date(Date.now() - i * 43200000), // i*12시간 전
        },
      });
    })
  );

  console.log(`✅ Created ${sales.length} sales`);
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
