const roleLabels: Record<string, string> = {
  MASTER: "마스터",
  SUB_MASTER: "부마스터",
  ADMIN: "관리자",
  SELLER: "셀러",
};

const roleColors: Record<string, string> = {
  MASTER: "bg-purple-100 text-purple-800",
  SUB_MASTER: "bg-indigo-100 text-indigo-800",
  ADMIN: "bg-blue-100 text-blue-800",
  SELLER: "bg-green-100 text-green-800",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-block px-2 py-1 text-xs font-medium rounded-md ${
        roleColors[role] || "bg-gray-100 text-gray-800"
      }`}
    >
      {roleLabels[role] || role}
    </span>
  );
}
