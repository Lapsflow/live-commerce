import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
}

export function NavItem({ href, label, icon: Icon, isActive }: NavItemProps) {
  return (
    <li>
      <Link
        href={href}
        className={`
          flex items-center px-3 py-2 rounded-md text-sm font-medium
          transition-colors duration-150 ease-in-out
          ${
            isActive
              ? "bg-blue-50 text-blue-700"
              : "text-grey-700 hover:bg-grey-100 hover:text-grey-900"
          }
        `}
      >
        <Icon className="h-5 w-5 mr-3" />
        {label}
      </Link>
    </li>
  );
}
