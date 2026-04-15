"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface ManualInputFallbackProps {
  onSearch: (barcode: string) => void;
}

export function ManualInputFallback({ onSearch }: ManualInputFallbackProps) {
  const [barcode, setBarcode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode.trim()) {
      onSearch(barcode.trim());
      setBarcode("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="text"
        placeholder="바코드 번호 입력"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" disabled={!barcode.trim()}>
        <Search className="h-4 w-4 mr-2" />
        검색
      </Button>
    </form>
  );
}
