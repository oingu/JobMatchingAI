"use client";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { SettingsForm } from "@/components/settings-form";

export default function CandidateSettingsPage() {
  return (
    <RoleGuard allowedRole="candidate">
      {(session) => (
        <AppShell role="candidate" title="Settings">
          <SettingsForm session={session} role="candidate" />
        </AppShell>
      )}
    </RoleGuard>
  );
}
