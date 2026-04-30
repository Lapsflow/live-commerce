import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants/role-labels";

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-block px-2 py-1 text-xs font-medium rounded-md ${
        ROLE_COLORS[role] || "bg-grey-100 text-grey-800"
      }`}
    >
      {ROLE_LABELS[role] || role}
    </span>
  );
}
