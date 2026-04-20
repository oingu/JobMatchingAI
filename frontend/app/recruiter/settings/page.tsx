"use client";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { SettingsForm } from "@/components/settings-form";

export default function RecruiterSettingsPage() {
  return (
    <RoleGuard allowedRole="recruiter">
      {(session) => (
        <AppShell role="recruiter" title="Settings">
          <SettingsForm session={session} role="recruiter" />
        </AppShell>
      )}
    </RoleGuard>
  );
}
