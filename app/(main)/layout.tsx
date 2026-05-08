import { Sidebar } from "@/components/layout/sidebar";
import { MustChangePasswordGuard } from "@/components/layout/must-change-password-guard";

export const dynamic = 'force-dynamic';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-grey-50">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 lg:ml-64">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">
          <MustChangePasswordGuard>
            {children}
          </MustChangePasswordGuard>
        </div>
      </main>
    </div>
  );
}
