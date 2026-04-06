"use client";

import { useSession, signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";

const roleLabels: Record<string, string> = {
  MASTER: "마스터",
  SUB_MASTER: "부마스터",
  ADMIN: "관리자",
  SELLER: "셀러",
};

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const userName = (session.user as any).name || "사용자";
  const userRole = (session.user as any).role || "SELLER";
  const roleLabel = roleLabels[userRole] || userRole;

  return (
    <div className="space-y-2">
      {/* User Info */}
      <div className="flex items-center px-3 py-2 text-sm">
        <User className="h-5 w-5 mr-3 text-gray-500" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{userName}</p>
          <p className="text-xs text-gray-500">{roleLabel}</p>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="
          flex items-center w-full px-3 py-2 text-sm font-medium
          text-gray-700 hover:bg-gray-100 hover:text-gray-900
          rounded-md transition-colors duration-150 ease-in-out
        "
      >
        <LogOut className="h-5 w-5 mr-3" />
        로그아웃
      </button>
    </div>
  );
}
