"use client";

import { useEffect, useState } from "react";
import { Users, Briefcase, FileText, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type Stats = {
  total_users: number;
  candidates: number;
  recruiters: number;
  total_jobs: number;
  total_applications: number;
  pending_verifications: number;
  verified_recruiters: number;
};

export default function AdminDashboardPage() {
  return (
    <RoleGuard allowedRole="admin">
      {(session) => <Content session={session} />}
    </RoleGuard>
  );
}

function Content({ session }: { session: SessionData }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<Stats>("/admin/stats", { session });
        setStats(res.data);
      } catch {
        /* ignore */
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell role="admin" title="Admin Dashboard">
      {!stats ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Users className="h-5 w-5" />} label="Total Users" value={stats.total_users} />
          <StatCard icon={<Users className="h-5 w-5" />} label="Candidates" value={stats.candidates} />
          <StatCard icon={<Users className="h-5 w-5" />} label="Recruiters" value={stats.recruiters} />
          <StatCard icon={<Briefcase className="h-5 w-5" />} label="Total Jobs" value={stats.total_jobs} />
          <StatCard icon={<FileText className="h-5 w-5" />} label="Applications" value={stats.total_applications} />
          <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Pending Verifications" value={stats.pending_verifications} className="text-amber-600" />
          <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Verified Recruiters" value={stats.verified_recruiters} className="text-green-600" />
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
        <div>
          <p className={`text-2xl font-bold ${className ?? ""}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
