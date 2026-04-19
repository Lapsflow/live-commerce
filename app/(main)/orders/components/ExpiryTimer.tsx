"use client";

import { useEffect, useState } from "react";

interface ExpiryTimerProps {
  expiresAt: string | null | undefined;
  status: string;
  paymentStatus: string;
}

export default function ExpiryTimer({
  expiresAt,
  status,
  paymentStatus,
}: ExpiryTimerProps) {
  const [remaining, setRemaining] = useState<string>("");
  const [urgency, setUrgency] = useState<"normal" | "warning" | "expired">("normal");

  useEffect(() => {
    if (!expiresAt || status !== "PENDING" || paymentStatus !== "UNPAID") {
      return;
    }

    const update = () => {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setRemaining("만료됨");
        setUrgency("expired");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setRemaining(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );

      if (diff < 30 * 60 * 1000) {
        setUrgency("warning");
      } else {
        setUrgency("normal");
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, status, paymentStatus]);

  if (!expiresAt || status !== "PENDING" || paymentStatus !== "UNPAID") {
    return null;
  }

  const colorClasses = {
    normal: "text-grey-600",
    warning: "text-orange-600 font-semibold",
    expired: "text-red-600 font-semibold",
  };

  return (
    <span className={`text-xs tabular-nums ${colorClasses[urgency]}`}>
      {urgency === "expired" ? "만료됨" : remaining}
    </span>
  );
}
