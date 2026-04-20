"use client";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";

export default function AdminUsersPage() {
  return (
    <RoleGuard allowedRole="admin">
      {() => (
        <AppShell role="admin" title="Users">
          <p className="py-12 text-center text-sm text-muted-foreground">
            User management — coming soon.
          </p>
        </AppShell>
      )}
    </RoleGuard>
  );
}
