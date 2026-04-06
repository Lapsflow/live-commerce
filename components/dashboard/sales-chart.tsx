"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SalesChartProps {
  data: Array<{ date: string; totalSales: number; count: number }>;
}

export function SalesChart({ data }: SalesChartProps) {
  // 날짜 포맷팅 (YYYY-MM-DD -> MM/DD)
  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          className="text-xs"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
          formatter={(value) => [
            `${(value as number).toLocaleString()}원`,
            "매출",
          ]}
        />
        <Line
          type="monotone"
          dataKey="totalSales"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--primary))", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
