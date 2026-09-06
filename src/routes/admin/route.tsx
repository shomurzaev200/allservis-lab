import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/shell";
import { AuthGuard } from "@/components/auth-guard";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AuthGuard>
      <AdminShell>
        <Outlet />
      </AdminShell>
    </AuthGuard>
  );
}
