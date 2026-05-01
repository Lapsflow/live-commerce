import { prisma } from "../lib/db/prisma";

async function main() {
  const subs = await prisma.user.findMany({
    where: { role: "SUB_MASTER" },
    select: { id: true, username: true, name: true, centerId: true, role: true },
  });
  console.log("SUB_MASTER:", JSON.stringify(subs, null, 2));

  const accounts = await prisma.user.findMany({
    where: { username: { in: ["master", "admin1", "seller1"] } },
    select: { username: true, role: true, centerId: true, name: true },
  });
  console.log("Test accounts:", JSON.stringify(accounts, null, 2));

  const centers = await prisma.center.findMany({
    select: { id: true, name: true, code: true, centerNumber: true },
    take: 5,
  });
  console.log("Centers:", JSON.stringify(centers, null, 2));

  const cp = await prisma.product.count({ where: { productType: "CENTER" } });
  console.log("CENTER products:", cp);

  const zeroPrice = await prisma.product.findFirst({
    where: { productType: "HEADQUARTERS", sellPrice: 0, isActive: true },
    select: { barcode: true, name: true },
  });
  console.log("Zero price product:", JSON.stringify(zeroPrice));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
