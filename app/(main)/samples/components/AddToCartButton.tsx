"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
  };
  variant?: "icon" | "full";
}

export function AddToCartButton({ product, variant = "icon" }: AddToCartButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAddToCart = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/proposals/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
          samplePrice: 0, // 샘플은 무료
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "장바구니 추가 실패");
      }

      toast({
        title: "장바구니 추가",
        description: `${product.name}이(가) 장바구니에 추가되었습니다.`,
      });
    } catch (err: any) {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <Button
        size="sm"
        onClick={handleAddToCart}
        disabled={isLoading}
        className="shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingCart className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleAddToCart}
      disabled={isLoading}
      className="w-full"
      size="lg"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          추가 중...
        </>
      ) : (
        <>
          <ShoppingCart className="mr-2 h-5 w-5" />
          장바구니에 담기
        </>
      )}
    </Button>
  );
}
