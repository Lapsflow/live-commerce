"use client";

import { useSession, signOut } from "next-auth/react";
import { User, LogOut, KeyRound } from "lucide-react";
import Link from "next/link";

import { ROLE_LABELS } from "@/lib/constants/role-labels";

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const userName = (session.user as any).name || "사용자";
  const userRole = (session.user as any).role || "SELLER";
  const roleLabel = ROLE_LABELS[userRole] || userRole;

  return (
    <div className="space-y-2">
      {/* User Info */}
      <div className="flex items-center px-3 py-2 text-sm">
        <User className="h-5 w-5 mr-3 text-grey-500" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-grey-900 truncate">{userName}</p>
          <p className="text-xs text-grey-500">{roleLabel}</p>
        </div>
      </div>

      {/* Change Password */}
      <Link
        href="/settings"
        className="
          flex items-center w-full px-3 py-2 text-sm font-medium
          text-grey-700 hover:bg-grey-100 hover:text-grey-900
          rounded-md transition-colors duration-150 ease-in-out
        "
      >
        <KeyRound className="h-5 w-5 mr-3" />
        비밀번호 변경
      </Link>

      {/* Logout Button */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="
          flex items-center w-full px-3 py-2 text-sm font-medium
          text-grey-700 hover:bg-grey-100 hover:text-grey-900
          rounded-md transition-colors duration-150 ease-in-out
        "
      >
        <LogOut className="h-5 w-5 mr-3" />
        로그아웃
      </button>
    </div>
  );
}
