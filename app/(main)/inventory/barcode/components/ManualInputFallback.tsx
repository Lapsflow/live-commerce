"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

interface ManualInputFallbackProps {
  onSearch: (barcode: string) => void;
  autoFocus?: boolean;
  isSearching?: boolean;
}

export function ManualInputFallback({ onSearch, autoFocus = true, isSearching = false }: ManualInputFallbackProps) {
  const [barcode, setBarcode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // BARCODE-03: 자동 포커스 유지
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // BARCODE-03: 검색 완료 후 0.5초 뒤 자동 초기화 + 포커스
  useEffect(() => {
    if (!isSearching && barcode === "") {
      // 검색 완료 후 포커스 복귀
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSearching, barcode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = barcode.trim();
    if (!trimmed) return;

    onSearch(trimmed);

    // BARCODE-03: 0.5초 후 입력 자동 초기화 + 포커스 유지
    setTimeout(() => {
      setBarcode("");
      inputRef.current?.focus();
    }, 500);
  };

  // BARCODE-02: 포커스 벗어나면 자동 복귀 (스캐너 HID 입력 안정성)
  const handleBlur = () => {
    if (autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        ref={inputRef}
        type="text"
        placeholder="바코드 번호 입력 (스캐너 또는 수동)"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onBlur={handleBlur}
        className="flex-1"
        autoFocus={autoFocus}
        autoComplete="off"
      />
      <Button type="submit" disabled={!barcode.trim() || isSearching}>
        {isSearching ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Search className="h-4 w-4 mr-2" />
        )}
        검색
      </Button>
    </form>
  );
}
