"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrophyIcon } from "lucide-react";

interface RankingData {
  sellerId: string;
  sellerName: string;
  totalSales: number;
  count: number;
}

interface RankingTableProps {
  data: RankingData[];
}

export function RankingTable({ data }: RankingTableProps) {
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <Badge className="bg-yellow-500 text-white">
          <TrophyIcon className="h-3 w-3 mr-1" />
          {rank}위
        </Badge>
      );
    }
    if (rank === 2) {
      return (
        <Badge className="bg-gray-400 text-white">
          <TrophyIcon className="h-3 w-3 mr-1" />
          {rank}위
        </Badge>
      );
    }
    if (rank === 3) {
      return (
        <Badge className="bg-orange-600 text-white">
          <TrophyIcon className="h-3 w-3 mr-1" />
          {rank}위
        </Badge>
      );
    }
    return <Badge variant="outline">{rank}위</Badge>;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">순위</TableHead>
          <TableHead>셀러명</TableHead>
          <TableHead className="text-right">판매건수</TableHead>
          <TableHead className="text-right">총 매출</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              데이터가 없습니다
            </TableCell>
          </TableRow>
        ) : (
          data.map((item, index) => (
            <TableRow key={item.sellerId}>
              <TableCell>{getRankBadge(index + 1)}</TableCell>
              <TableCell className="font-medium">{item.sellerName}</TableCell>
              <TableCell className="text-right">
                {item.count.toLocaleString()}건
              </TableCell>
              <TableCell className="text-right font-semibold">
                {item.totalSales.toLocaleString()}원
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
