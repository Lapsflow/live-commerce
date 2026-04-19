"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Clock, CreditCard, Truck, PackageCheck, XCircle } from "lucide-react";

interface OrderStats {
  pendingUnpaid: number;
  approvedPreparing: number;
  shipped: number;
  rejected: number;
  expiringSoon: number;
  total: number;
}

interface OrderPipelineCardsProps {
  onFilterChange?: (filter: string | null) => void;
  activeFilter?: string | null;
}

export default function OrderPipelineCards({
  onFilterChange,
  activeFilter,
}: OrderPipelineCardsProps) {
  const [stats, setStats] = useState<OrderStats | null>(null);

  useEffect(() => {
    fetch("/api/orders/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setStats(data.data);
      })
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const cards = [
    {
      key: "pendingUnpaid",
      label: "입금대기",
      count: stats.pendingUnpaid,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      extra: stats.expiringSoon > 0 ? `(만료임박 ${stats.expiringSoon}건)` : undefined,
      extraColor: "text-orange-500",
    },
    {
      key: "approvedPreparing",
      label: "입금완료",
      count: stats.approvedPreparing,
      icon: CreditCard,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      key: "shipped",
      label: "출고완료",
      count: stats.shipped,
      icon: PackageCheck,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      key: "rejected",
      label: "취소/만료",
      count: stats.rejected,
      icon: XCircle,
      color: "text-gray-500",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.key;
        return (
          <Card
            key={card.key}
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              isActive ? `${card.borderColor} border-2 shadow-md` : "border"
            }`}
            onClick={() =>
              onFilterChange?.(isActive ? null : card.key)
            }
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {card.count}
                  <span className="text-sm font-normal text-gray-400 ml-1">건</span>
                </p>
                {card.extra && (
                  <p className={`text-xs ${card.extraColor}`}>{card.extra}</p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
