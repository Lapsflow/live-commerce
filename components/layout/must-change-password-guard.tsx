"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function MustChangePasswordGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const mustChange = (session?.user as any)?.mustChangePassword === true;
  const isChangePasswordPage = pathname === "/profile/change-password";

  useEffect(() => {
    if (status === "authenticated" && mustChange && !isChangePasswordPage) {
      router.replace("/profile/change-password");
    }
  }, [status, mustChange, isChangePasswordPage, router]);

  if (status === "loading") return null;
  if (mustChange && !isChangePasswordPage) return null;

  return <>{children}</>;
}
