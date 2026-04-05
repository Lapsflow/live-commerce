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
    update: {},
    create: {
      email: "master@live-commerce.com",
      name: "Master Admin",
      phone: "010-1234-5678",
      role: "MASTER",
      passwordHash: masterPassword,
    },
  });

  const admin1 = await prisma.user.upsert({
    where: { email: "admin1@live-commerce.com" },
    update: {},
    create: {
      email: "admin1@live-commerce.com",
      name: "Admin 1",
      phone: "010-2345-6789",
      role: "ADMIN",
      passwordHash: adminPassword,
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { email: "admin2@live-commerce.com" },
    update: {},
    create: {
      email: "admin2@live-commerce.com",
      name: "Admin 2",
      phone: "010-3456-7890",
      role: "ADMIN",
      passwordHash: adminPassword,
    },
  });

  const sellers = await Promise.all([
    prisma.user.upsert({
      where: { email: "seller1@live-commerce.com" },
      update: {},
      create: {
        email: "seller1@live-commerce.com",
        name: "Seller 1",
        phone: "010-4567-8901",
        role: "SELLER",
        adminId: admin1.id,
        passwordHash: sellerPassword,
      },
    }),
    prisma.user.upsert({
      where: { email: "seller2@live-commerce.com" },
      update: {},
      create: {
        email: "seller2@live-commerce.com",
        name: "Seller 2",
        phone: "010-5678-9012",
        role: "SELLER",
        adminId: admin1.id,
        passwordHash: sellerPassword,
      },
    }),
    prisma.user.upsert({
      where: { email: "seller3@live-commerce.com" },
      update: {},
      create: {
        email: "seller3@live-commerce.com",
        name: "Seller 3",
        phone: "010-6789-0123",
        role: "SELLER",
        adminId: admin2.id,
        passwordHash: sellerPassword,
      },
    }),
    prisma.user.upsert({
      where: { email: "seller4@live-commerce.com" },
      update: {},
      create: {
        email: "seller4@live-commerce.com",
        name: "Seller 4",
        phone: "010-7890-1234",
        role: "SELLER",
        adminId: admin2.id,
        passwordHash: sellerPassword,
      },
    }),
    prisma.user.upsert({
      where: { email: "seller5@live-commerce.com" },
      update: {},
      create: {
        email: "seller5@live-commerce.com",
        name: "Seller 5",
        phone: "010-8901-2345",
        role: "SELLER",
        passwordHash: sellerPassword,
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

  // 3. Orders (10개 샘플)
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

  // 4. Broadcasts (5개 샘플)
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
      return prisma.broadcast.create({
        data: {
          code: `BC${new Date().getFullYear()}${(i + 1).toString().padStart(4, "0")}`,
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

  // 5. Sales (15개 샘플)
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
