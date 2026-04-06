import { Card } from "@/components/ui/card";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  trend?: number;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, trend, icon }: StatCardProps) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <h3 className="text-2xl font-bold mt-2">{value}</h3>
          {trend !== undefined && (
            <div className="flex items-center mt-2 text-sm">
              {isPositive && (
                <>
                  <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-500">+{trend}%</span>
                </>
              )}
              {isNegative && (
                <>
                  <ArrowDownIcon className="h-4 w-4 text-red-500 mr-1" />
                  <span className="text-red-500">{trend}%</span>
                </>
              )}
              {!isPositive && !isNegative && (
                <span className="text-muted-foreground">변동 없음</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 text-muted-foreground opacity-50">{icon}</div>
        )}
      </div>
    </Card>
  );
}
