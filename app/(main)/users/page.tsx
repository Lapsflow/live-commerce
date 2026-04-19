"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleBadge } from "@/components/users/role-badge";
import { UserEditDialog } from "@/components/users/user-edit-dialog";
import { Users as UsersIcon, Search, Plus, Edit } from "lucide-react";

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
};

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [adminList, setAdminList] = useState<Array<{ id: string; name: string }>>([]);

  // 권한 확인
  const userRole = (session?.user as any)?.role;
  const hasAccess = userRole === "MASTER" || userRole === "SUB_MASTER";

  useEffect(() => {
    if (hasAccess) {
      loadUsers();
    }
  }, [hasAccess]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/users");
      const data = await res.json();

      if (res.ok && data.data) {
        setUsers(data.data);

        // Admin 목록 추출 (ADMIN/SELLER 역할 선택 시 사용)
        const admins = data.data
          .filter((u: User) => u.role === "ADMIN")
          .map((u: User) => ({ id: u.id, name: u.name }));
        setAdminList(admins);
      } else {
        setError(data.error?.message || "사용자 목록을 불러올 수 없습니다");
      }
    } catch (err) {
      console.error("Error loading users:", err);
      setError("사용자 목록을 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    loadUsers(); // Reload users after edit
  };

  // 검색 필터링
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.phone && user.phone.includes(query))
    );
  });

  // 권한 없음
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

      {/* Search Bar */}
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

      {/* Error Display */}
      {error && (
        <Card className="p-6">
          <div className="text-red-600">{error}</div>
        </Card>
      )}

      {/* User List */}
      {!error && (
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-grey-200">
              <thead>
                <tr className="bg-grey-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                    이름
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                    이메일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                    전화번호
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                    역할
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                    활동 채널
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                    평균 매출
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                    가입일
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-grey-500">
                      {searchQuery
                        ? "검색 결과가 없습니다"
                        : "등록된 사용자가 없습니다"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-grey-50">
                      <td className="px-4 py-3 text-sm text-grey-900 font-medium">
                        {user.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-600">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-600">
                        {user.phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-600">
                        {user.channels && user.channels.length > 0
                          ? user.channels.join(", ")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-900 text-right">
                        {user.avgSales
                          ? `${user.avgSales.toLocaleString()}원`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-600">
                        {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditUser(user)}
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

          {/* Summary */}
          {filteredUsers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-grey-200">
              <p className="text-sm text-grey-600">
                총 <span className="font-semibold">{filteredUsers.length}</span>명의 사용자
                {searchQuery && (
                  <span className="ml-2 text-grey-500">
                    (전체: {users.length}명)
                  </span>
                )}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Edit Dialog */}
      <UserEditDialog
        user={editingUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleEditSuccess}
        adminList={adminList}
      />
    </div>
  );
}
