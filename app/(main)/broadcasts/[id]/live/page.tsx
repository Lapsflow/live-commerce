import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Circle } from "lucide-react";
import { ProductListForBroadcast } from "./components/ProductListForBroadcast";
import { BroadcastSalesTracker } from "./components/BroadcastSalesTracker";

interface LiveBroadcastPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ centerId?: string }>;
}

export default async function LiveBroadcastPage({
  params,
  searchParams,
}: LiveBroadcastPageProps) {
  const { id } = await params;
  const { centerId } = await searchParams;

  // Get broadcast details
  const broadcast = await prisma.broadcast.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      center: {
        select: {
          id: true,
          code: true,
          name: true,
          regionName: true,
        },
      },
    },
  });

  if (!broadcast) {
    notFound();
  }

  // If no centerId provided and broadcast has no center, redirect to broadcasts list
  if (!centerId && !broadcast.centerId) {
    redirect("/broadcasts");
  }

  // Use centerId from searchParams or broadcast's centerId
  const activeCenterId = centerId || broadcast.centerId!;

  // Get center details if needed
  const center = centerId
    ? await prisma.center.findUnique({
        where: { id: centerId },
        select: {
          id: true,
          code: true,
          name: true,
          regionName: true,
        },
      })
    : broadcast.center;

  if (!center) {
    redirect("/broadcasts");
  }

  // Load center-specific products
  const centerProducts = await prisma.product.findMany({
    where: {
      centerStocks: {
        some: {
          centerId: activeCenterId,
        },
      },
    },
    include: {
      centerStocks: {
        where: {
          centerId: activeCenterId,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  // Load headquarters products (available to all centers)
  // TODO: Phase 4 - Add productType field to Product model
  const hqProducts = await prisma.product.findMany({
    where: {
      // All products are available for now
      // Will add productType: "HEADQUARTERS" filter in Phase 4
      // Note: Product model has no active/isActive field yet
    },
    include: {
      centerStocks: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Combine products and serialize dates for client components
  const allProducts = [...centerProducts, ...hqProducts].map((product) => ({
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    centerStocks: product.centerStocks.map((stock) => ({
      ...stock,
      createdAt: stock.createdAt.toISOString(),
      updatedAt: stock.updatedAt.toISOString(),
    })),
  }));

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{center.name} 라이브 방송</h1>
          <p className="text-muted-foreground mt-1">
            방송 코드: {broadcast.code} • 판매자: {broadcast.seller?.name}
          </p>
        </div>
        <Badge variant="destructive" className="animate-pulse text-lg px-4 py-2">
          <Circle className="w-3 h-3 fill-current mr-2" />
          LIVE
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product List (2 columns on large screens) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              상품 리스트 ({allProducts.length}개)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              센터 상품: {centerProducts.length}개 • 본사 상품: {hqProducts.length}개
            </p>
          </CardHeader>
          <CardContent>
            <ProductListForBroadcast products={allProducts} centerId={activeCenterId} />
          </CardContent>
        </Card>

        {/* Right: Sales Tracker */}
        <Card>
          <CardHeader>
            <CardTitle>판매 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <BroadcastSalesTracker broadcastId={id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
