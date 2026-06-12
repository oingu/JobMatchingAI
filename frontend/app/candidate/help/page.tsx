"use client";

import { HelpContent } from "@/components/help-content";
import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";

export default function HelpPage() {
  return (
    <RoleGuard allowedRole="candidate">
      {(_session) => (
        <AppShell role="candidate" title="Help & Support">
          <HelpContent />
        </AppShell>
      )}
    </RoleGuard>
  );
}
