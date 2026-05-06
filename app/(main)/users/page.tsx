"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RoleBadge } from "@/components/users/role-badge";
import { UserEditDialog } from "@/components/users/user-edit-dialog";
import { UserAddDialog } from "@/components/users/user-add-dialog";
import {
  Users as UsersIcon,
  Search,
  Plus,
  Edit,
  UserCheck,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  channels: string[];
  avgSales: number | null;
  isActive: boolean;
  createdAt: string;
  center?: { name: string; code: string } | null;
  _count?: { sellers?: number; broadcasts?: number; sales?: number; orders?: number };
};

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const userRole = (session?.user as any)?.role;
  const userCenterId = (session?.user as any)?.centerId;
  const hasAccess = userRole === "MASTER" || userRole === "SUB_MASTER";

  useEffect(() => {
    if (hasAccess) loadUsers();
  }, [hasAccess]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users?pageSize=100");
      const data = await res.json();
      if (res.ok && data.data) {
        setUsers(data.data);
      } else {
        setError(data.error?.message || "사용자 목록을 불러올 수 없습니다");
      }
    } catch {
      setError("사용자 목록을 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const handleToggleActive = async (user: User) => {
    const newActive = !user.isActive;
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "상태 변경 실패");
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: newActive } : u))
      );
      toast.success(newActive ? "계정이 활성화되었습니다" : "계정이 비활성화되었습니다");
    } catch (err: any) {
      toast.error(err.message || "상태 변경 중 오류가 발생했습니다");
    }
  };

  // Filtered lists
  const filterBySearch = (list: User[]) =>
    list.filter((u) => {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q))
      );
    });

  const allUsers = useMemo(() => filterBySearch(users), [users, searchQuery]);
  const sellers = useMemo(
    () => filterBySearch(users.filter((u) => u.role === "SELLER")),
    [users, searchQuery]
  );

  // Center groups for center tab
  const centerGroups = useMemo(() => {
    const groups: Record<string, { centerName: string; centerCode: string; users: User[] }> = {};
    const noCenter: User[] = [];
    for (const u of filterBySearch(users)) {
      if (u.center) {
        const key = u.center.code;
        if (!groups[key]) {
          groups[key] = { centerName: u.center.name, centerCode: u.center.code, users: [] };
        }
        groups[key].users.push(u);
      } else {
        noCenter.push(u);
      }
    }
    const sorted = Object.values(groups).sort((a, b) => a.centerCode.localeCompare(b.centerCode));
    if (noCenter.length > 0) {
      sorted.push({ centerName: "미배정", centerCode: "-", users: noCenter });
    }
    return sorted;
  }, [users, searchQuery]);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <div className="text-red-600">
            접근 권한이 없습니다.
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-grey-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-grey-900">사용자 관리</h1>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          사용자 추가
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-grey-400" />
          <Input
            type="text"
            placeholder="이름, 이메일, 전화번호로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>
      </Card>

      {error && (
        <Card className="p-6">
          <div className="text-red-600">{error}</div>
        </Card>
      )}

      {/* Tabs */}
      {!error && (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <UsersIcon className="h-4 w-4" />
              전체 ({users.length})
            </TabsTrigger>
            <TabsTrigger value="sellers" className="gap-1.5">
              <UserCheck className="h-4 w-4" />
              셀러 ({users.filter((u) => u.role === "SELLER").length})
            </TabsTrigger>
            <TabsTrigger value="centers" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              센터
            </TabsTrigger>
          </TabsList>

          {/* 전체 탭 */}
          <TabsContent value="all">
            <UserTable
              users={allUsers}
              columns={["name", "email", "phone", "role", "center", "isActive", "channels", "avgSales", "createdAt"]}
              onEdit={handleEditUser}
              onRowClick={(user) => router.push(`/users/${user.id}`)}
              onToggleActive={handleToggleActive}
            />
          </TabsContent>

          {/* 셀러 탭 */}
          <TabsContent value="sellers">
            <UserTable
              users={sellers}
              columns={["name", "phone", "isActive", "channels", "avgSales", "createdAt"]}
              onEdit={handleEditUser}
              onRowClick={(user) => router.push(`/users/${user.id}`)}
              onToggleActive={handleToggleActive}
            />
          </TabsContent>

          {/* 센터별 탭 */}
          <TabsContent value="centers">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {centerGroups.length === 0 ? (
                <Card className="col-span-full p-8 text-center text-grey-500">
                  검색 결과가 없습니다
                </Card>
              ) : (
                centerGroups.map((group) => (
                  <Card
                    key={group.centerCode}
                    className="p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{group.centerName}</h3>
                        <span className="text-xs text-grey-500 font-mono">{group.centerCode}</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">
                        {group.users.length}명
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {group.users.slice(0, 8).map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between text-sm cursor-pointer hover:bg-grey-50 rounded px-2 py-1"
                          onClick={() => router.push(`/users/${u.id}`)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-grey-900">{u.name}</span>
                            <RoleBadge role={u.role} />
                          </div>
                          <span className="text-grey-400 text-xs">
                            {u.avgSales ? `${u.avgSales.toLocaleString()}원` : ""}
                          </span>
                        </div>
                      ))}
                      {group.users.length > 8 && (
                        <div className="text-xs text-grey-400 text-center pt-1">
                          +{group.users.length - 8}명 더
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

        </Tabs>
      )}

      <UserEditDialog
        user={editingUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => loadUsers()}
      />

      <UserAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => {
          loadUsers();
          toast.success("사용자가 생성되었습니다");
        }}
        currentUserRole={userRole}
        currentUserCenterId={userCenterId}
      />
    </div>
  );
}

// ─── Reusable User Table ────────────────────────────────────

type ColumnKey =
  | "name"
  | "email"
  | "phone"
  | "role"
  | "center"
  | "channels"
  | "avgSales"
  | "isActive"
  | "createdAt";

const columnConfig: Record<ColumnKey, { label: string; align?: "right" | "center" }> = {
  name: { label: "이름" },
  email: { label: "이메일" },
  phone: { label: "전화번호" },
  role: { label: "역할" },
  center: { label: "소속 센터" },
  channels: { label: "활동 채널" },
  avgSales: { label: "평균 매출", align: "right" },
  isActive: { label: "상태", align: "center" },
  createdAt: { label: "가입일" },
};

function UserTable({
  users,
  columns,
  onEdit,
  onRowClick,
  onToggleActive,
}: {
  users: User[];
  columns: ColumnKey[];
  onEdit: (user: User) => void;
  onRowClick: (user: User) => void;
  onToggleActive?: (user: User) => void;
}) {
  return (
    <Card className="p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-grey-200">
          <thead>
            <tr className="bg-grey-50">
              {columns.map((col) => (
                <th
                  key={col}
                  className={`px-4 py-3 text-xs font-medium text-grey-500 uppercase ${
                    columnConfig[col].align === "right" ? "text-right" : columnConfig[col].align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {columnConfig[col].label}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-200">
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-grey-500"
                >
                  검색 결과가 없습니다
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-grey-50 cursor-pointer"
                  onClick={() => onRowClick(user)}
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className={`px-4 py-3 text-sm ${
                        columnConfig[col].align === "right"
                          ? "text-right"
                          : columnConfig[col].align === "center"
                            ? "text-center"
                            : "text-left"
                      } ${col === "name" ? "font-medium text-blue-600" : "text-grey-600"}`}
                    >
                      {col === "name" && user.name}
                      {col === "email" && user.email}
                      {col === "phone" && (user.phone || "-")}
                      {col === "role" && <RoleBadge role={user.role} />}
                      {col === "center" && (user.center?.name || "-")}
                      {col === "channels" &&
                        (user.channels?.length > 0
                          ? user.channels.join(", ")
                          : "-")}
                      {col === "avgSales" &&
                        (user.avgSales
                          ? `${user.avgSales.toLocaleString()}원`
                          : "-")}
                      {col === "isActive" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleActive?.(user);
                          }}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.isActive
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          } transition-colors`}
                        >
                          {user.isActive ? "활성" : "비활성"}
                        </button>
                      )}
                      {col === "createdAt" &&
                        new Date(user.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(user);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      편집
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {users.length > 0 && (
        <div className="mt-4 pt-4 border-t border-grey-200">
          <p className="text-sm text-grey-600">
            총 <span className="font-semibold">{users.length}</span>명
          </p>
        </div>
      )}
    </Card>
  );
}
