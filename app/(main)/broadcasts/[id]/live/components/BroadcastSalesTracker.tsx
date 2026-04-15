"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, TrendingUp, Package, DollarSign } from "lucide-react";

interface SalesStats {
  totalOrders: number;
  totalSales: number;
  totalQuantity: number;
  topProducts: Array<{
    name?: string;
    productName?: string;
    quantity: number;
    revenue: number;
  }>;
}

interface BroadcastSalesTrackerProps {
  broadcastId: string;
}

export function BroadcastSalesTracker({ broadcastId }: BroadcastSalesTrackerProps) {
  const [stats, setStats] = useState<SalesStats>({
    totalOrders: 0,
    totalSales: 0,
    totalQuantity: 0,
    topProducts: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch sales stats for this broadcast
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/broadcasts/${broadcastId}/stats`);
        const data = await response.json();

        if (data.data) {
          setStats(data.data);
        } else {
          // Fallback to empty stats if no data
          setStats({
            totalOrders: 0,
            totalSales: 0,
            totalQuantity: 0,
            topProducts: [],
          });
        }
      } catch (error) {
        console.error("Failed to fetch broadcast stats:", error);
        // On error, set empty stats
        setStats({
          totalOrders: 0,
          totalSales: 0,
          totalQuantity: 0,
          topProducts: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchStats, 10000);

    return () => clearInterval(interval);
  }, [broadcastId]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-muted rounded"></div>
        <div className="h-20 bg-muted rounded"></div>
        <div className="h-20 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total Orders */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-500/10 rounded-lg">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">총 주문 수</div>
          <div className="text-2xl font-bold">{stats.totalOrders}건</div>
        </div>
      </div>

      <Separator />

      {/* Total Revenue */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-green-500/10 rounded-lg">
          <DollarSign className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">총 매출액</div>
          <div className="text-2xl font-bold">
            {stats.totalSales.toLocaleString()}원
          </div>
        </div>
      </div>

      <Separator />

      {/* Total Items Sold */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-500/10 rounded-lg">
          <Package className="w-5 h-5 text-purple-600" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">판매 상품 수</div>
          <div className="text-2xl font-bold">{stats.totalQuantity}개</div>
        </div>
      </div>

      {/* Top Products */}
      {stats.topProducts.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold">인기 상품</h4>
            </div>
            <div className="space-y-2">
              {stats.topProducts.slice(0, 5).map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="shrink-0">
                      {index + 1}위
                    </Badge>
                    <span className="text-sm truncate">{product.name || product.productName}</span>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-sm font-semibold">
                      {product.quantity}개
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {product.revenue.toLocaleString()}원
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {stats.totalOrders === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">아직 판매 데이터가 없습니다</p>
          <p className="text-xs mt-1">방송 중 실시간으로 업데이트됩니다</p>
        </div>
      )}
    </div>
  );
}
