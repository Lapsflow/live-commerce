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
import {
  Users as UsersIcon,
  Search,
  Plus,
  Edit,
  BarChart3,
  UserCheck,
  Shield,
} from "lucide-react";

type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  adminId: string | null;
  channels: string[];
  avgSales: number | null;
  createdAt: string;
  center?: { name: string; code: string } | null;
  admin?: { name: string } | null;
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

  const userRole = (session?.user as any)?.role;
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

  const adminList = useMemo(
    () =>
      users
        .filter((u) => u.role === "ADMIN")
        .map((u) => ({ id: u.id, name: u.name })),
    [users]
  );

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
  const admins = useMemo(
    () => filterBySearch(users.filter((u) => u.role === "ADMIN")),
    [users, searchQuery]
  );

  // Admin dashboard stats
  const adminStats = useMemo(() => {
    const adminUsers = users.filter((u) => u.role === "ADMIN");
    return adminUsers.map((admin) => {
      const managedSellers = users.filter((u) => u.adminId === admin.id);
      const totalAvgSales = managedSellers.reduce(
        (sum, s) => sum + (s.avgSales || 0),
        0
      );
      return {
        ...admin,
        sellerCount: managedSellers.length,
        totalAvgSales,
        sellers: managedSellers,
      };
    });
  }, [users]);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <div className="text-red-600">
            이 페이지에 접근할 권한이 없습니다. (MASTER 또는 SUB_MASTER만 접근 가능)
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

  const getAdminName = (adminId: string | null) => {
    if (!adminId) return "-";
    return users.find((u) => u.id === adminId)?.name || "-";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-grey-900">사용자 관리</h1>
        </div>
        <Button
          onClick={() => (window.location.href = "/signup")}
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
            <TabsTrigger value="admins" className="gap-1.5">
              <Shield className="h-4 w-4" />
              관리자 ({users.filter((u) => u.role === "ADMIN").length})
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              관리자 대시보드
            </TabsTrigger>
          </TabsList>

          {/* 전체 탭 */}
          <TabsContent value="all">
            <UserTable
              users={allUsers}
              columns={["name", "email", "phone", "role", "channels", "avgSales", "createdAt"]}
              onEdit={handleEditUser}
              onRowClick={(user) => router.push(`/users/${user.id}`)}
              getAdminName={getAdminName}
            />
          </TabsContent>

          {/* 셀러 탭 */}
          <TabsContent value="sellers">
            <UserTable
              users={sellers}
              columns={["name", "phone", "admin", "channels", "avgSales", "createdAt"]}
              onEdit={handleEditUser}
              onRowClick={(user) => router.push(`/users/${user.id}`)}
              getAdminName={getAdminName}
            />
          </TabsContent>

          {/* 관리자 탭 */}
          <TabsContent value="admins">
            <UserTable
              users={admins}
              columns={["name", "email", "phone", "sellerCount", "createdAt"]}
              onEdit={handleEditUser}
              onRowClick={(user) => router.push(`/users/${user.id}`)}
              getAdminName={getAdminName}
              allUsers={users}
            />
          </TabsContent>

          {/* 관리자 대시보드 */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminStats.length === 0 ? (
                <Card className="col-span-full p-8 text-center text-grey-500">
                  등록된 관리자가 없습니다
                </Card>
              ) : (
                adminStats.map((admin) => (
                  <Card
                    key={admin.id}
                    className="p-5 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/users/${admin.id}`)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg">{admin.name}</h3>
                      <RoleBadge role="ADMIN" />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-grey-500">관리 셀러</span>
                        <span className="font-semibold">{admin.sellerCount}명</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-grey-500">셀러 평균매출 합계</span>
                        <span className="font-semibold">
                          {admin.totalAvgSales > 0
                            ? `${admin.totalAvgSales.toLocaleString()}원`
                            : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-grey-500">이메일</span>
                        <span className="text-grey-600 truncate ml-2">
                          {admin.email}
                        </span>
                      </div>
                    </div>
                    {admin.sellers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-grey-100">
                        <p className="text-xs text-grey-400 mb-1.5">관리 셀러</p>
                        <div className="flex flex-wrap gap-1">
                          {admin.sellers.slice(0, 5).map((s) => (
                            <span
                              key={s.id}
                              className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded"
                            >
                              {s.name}
                            </span>
                          ))}
                          {admin.sellers.length > 5 && (
                            <span className="text-xs text-grey-400">
                              +{admin.sellers.length - 5}명
                            </span>
                          )}
                        </div>
                      </div>
                    )}
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
        adminList={adminList}
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
  | "admin"
  | "channels"
  | "avgSales"
  | "sellerCount"
  | "createdAt";

const columnConfig: Record<ColumnKey, { label: string; align?: "right" }> = {
  name: { label: "이름" },
  email: { label: "이메일" },
  phone: { label: "전화번호" },
  role: { label: "역할" },
  admin: { label: "소속 관리자" },
  channels: { label: "활동 채널" },
  avgSales: { label: "평균 매출", align: "right" },
  sellerCount: { label: "관리 셀러", align: "right" },
  createdAt: { label: "가입일" },
};

function UserTable({
  users,
  columns,
  onEdit,
  onRowClick,
  getAdminName,
  allUsers,
}: {
  users: User[];
  columns: ColumnKey[];
  onEdit: (user: User) => void;
  onRowClick: (user: User) => void;
  getAdminName: (adminId: string | null) => string;
  allUsers?: User[];
}) {
  const getSellerCount = (userId: string) =>
    (allUsers || []).filter((u) => u.adminId === userId).length;

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
                    columnConfig[col].align === "right" ? "text-right" : "text-left"
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
                          : "text-left"
                      } ${col === "name" ? "font-medium text-blue-600" : "text-grey-600"}`}
                    >
                      {col === "name" && user.name}
                      {col === "email" && user.email}
                      {col === "phone" && (user.phone || "-")}
                      {col === "role" && <RoleBadge role={user.role} />}
                      {col === "admin" && getAdminName(user.adminId)}
                      {col === "channels" &&
                        (user.channels?.length > 0
                          ? user.channels.join(", ")
                          : "-")}
                      {col === "avgSales" &&
                        (user.avgSales
                          ? `${user.avgSales.toLocaleString()}원`
                          : "-")}
                      {col === "sellerCount" && (
                        <span className="font-semibold">
                          {getSellerCount(user.id)}명
                        </span>
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
