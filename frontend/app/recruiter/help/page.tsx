"use client";

import { HelpContent } from "@/components/help-content";
import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";

export default function HelpPage() {
  return (
    <RoleGuard allowedRole="recruiter">
      {(_session) => (
        <AppShell role="recruiter" title="Help & Support">
          <HelpContent />
        </AppShell>
      )}
    </RoleGuard>
  );
}
