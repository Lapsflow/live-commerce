"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Radio,
  ShoppingCart,
  TrendingUp,
  Barcode,
  Users,
  BarChart,
  Package,
  Menu,
  X,
  Calendar,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { NavItem } from "./nav-item";
import { UserMenu } from "./user-menu";

interface MenuItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const menuByRole: Record<string, MenuItem[]> = {
  SELLER: [
    { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
    { href: "/broadcasts", label: "방송", icon: Radio },
    { href: "/broadcasts/calendar", label: "방송 캘린더", icon: Calendar },
    { href: "/orders", label: "발주", icon: ShoppingCart },
    { href: "/sales", label: "판매", icon: TrendingUp },
    { href: "/proposals", label: "상품 제안", icon: FileText },
    { href: "/barcode", label: "바코드", icon: Barcode },
  ],
  ADMIN: [
    { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
    { href: "/users", label: "셀러 관리", icon: Users },
    { href: "/orders", label: "발주 승인", icon: ShoppingCart },
    { href: "/broadcasts", label: "방송", icon: Radio },
    { href: "/broadcasts/calendar", label: "방송 캘린더", icon: Calendar },
    { href: "/proposals", label: "상품 제안", icon: FileText },
  ],
  MASTER: [
    { href: "/dashboard", label: "전체 통계", icon: BarChart },
    { href: "/users", label: "사용자 관리", icon: Users },
    { href: "/orders", label: "발주 관리", icon: ShoppingCart },
    { href: "/broadcasts", label: "방송 관리", icon: Radio },
    { href: "/broadcasts/calendar", label: "방송 캘린더", icon: Calendar },
    { href: "/products", label: "상품 관리", icon: Package },
    { href: "/proposals", label: "상품 제안", icon: FileText },
  ],
  SUB_MASTER: [
    { href: "/dashboard", label: "전체 통계", icon: BarChart },
    { href: "/users", label: "사용자 관리", icon: Users },
    { href: "/orders", label: "발주 관리", icon: ShoppingCart },
    { href: "/broadcasts", label: "방송 관리", icon: Radio },
    { href: "/broadcasts/calendar", label: "방송 캘린더", icon: Calendar },
    { href: "/proposals", label: "상품 제안", icon: FileText },
  ],
};

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userRole = (session?.user as any)?.role || "SELLER";
  const menuItems = menuByRole[userRole] || menuByRole.SELLER;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md"
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64 bg-white border-r border-gray-200
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-gray-200">
            <Link href="/dashboard" className="text-xl font-bold text-gray-800">
              Live Commerce
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={pathname === item.href || pathname?.startsWith(`${item.href}/`)}
                />
              ))}
            </ul>
          </nav>

          {/* User Menu */}
          <div className="p-4 border-t border-gray-200">
            <UserMenu />
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
