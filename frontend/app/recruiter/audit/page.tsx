"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { apiRequest, qs } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type AuditRow = {
  id: number;
  actor_user_id: number | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

export default function AuditPage() {
  return <RoleGuard allowedRole="recruiter">{(session) => <AuditContent session={session} />}</RoleGuard>;
}

function AuditContent({ session }: { session: SessionData }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const query = qs({ action: action || undefined, limit: 100 });
      const res = await apiRequest<AuditRow[]>(`/audit-logs${query}`, { session });
      setRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load audit logs failed.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell role="recruiter" title="Audit Logs">
      <div className="mb-3 flex items-center gap-2">
        <input
          className="rounded-md border px-3 py-2 text-sm"
          placeholder="Filter by action, ex: login_success"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-100" onClick={() => void load()}>
          Filter
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pr-4">ID</th>
              <th className="pr-4">Action</th>
              <th className="pr-4">Actor</th>
              <th className="pr-4">Resource</th>
              <th className="pr-4">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="py-2 pr-4">{row.id}</td>
                <td className="py-2 pr-4">{row.action}</td>
                <td className="py-2 pr-4">{row.actor_user_id ?? "-"}</td>
                <td className="py-2 pr-4">
                  {row.resource_type}/{row.resource_id ?? "-"}
                </td>
                <td className="py-2 pr-4">{new Date(row.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
