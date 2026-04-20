"use client";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { SettingsForm } from "@/components/settings-form";

export default function AdminSettingsPage() {
  return (
    <RoleGuard allowedRole="admin">
      {(session) => (
        <AppShell role="admin" title="Settings">
          <SettingsForm session={session} role="admin" />
        </AppShell>
      )}
    </RoleGuard>
  );
}
