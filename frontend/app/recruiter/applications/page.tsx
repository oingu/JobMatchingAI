"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Users,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type AppItem = {
  id: number;
  job_id: number;
  job_title: string;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  candidate_dob: string;
  skills: { name: string; level: number }[];
  experience_level: string;
  cover_letter: string;
  status: string;
  score: number | null;
  created_at: string | null;
};

const STATUS_CFG: Record<
  string,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", icon: <Clock className="h-3.5 w-3.5" />, variant: "secondary" },
  ACCEPTED: { label: "Accepted", icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: "default" },
  REJECTED: { label: "Rejected", icon: <XCircle className="h-3.5 w-3.5" />, variant: "destructive" },
  WITHDRAWN: { label: "Withdrawn", icon: <AlertCircle className="h-3.5 w-3.5" />, variant: "outline" },
};

type FilterStatus = "ALL" | "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export default function RecruiterApplicationsPage() {
  return (
    <RoleGuard allowedRole="recruiter">
      {(session) => <Content session={session} />}
    </RoleGuard>
  );
}

function Content({ session }: { session: SessionData }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("ALL");

  async function load() {
    try {
      const res = await apiRequest<AppItem[]>("/applications/all", { session });
      setApps(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function review(appId: number, status: "ACCEPTED" | "REJECTED") {
    try {
      await apiRequest(`/applications/${appId}/review`, {
        method: "PUT",
        session,
        body: { status },
      });
      toastSuccess(status === "ACCEPTED" ? "Candidate accepted!" : "Application rejected.");
      setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Review failed.");
    }
  }

  const filtered = filter === "ALL" ? apps : apps.filter((a) => a.status === filter);
  const pending = apps.filter((a) => a.status === "PENDING").length;
  const accepted = apps.filter((a) => a.status === "ACCEPTED").length;
  const rejected = apps.filter((a) => a.status === "REJECTED").length;

  const filters: { key: FilterStatus; label: string; count?: number }[] = [
    { key: "ALL", label: "All", count: apps.length },
    { key: "PENDING", label: "Pending", count: pending },
    { key: "ACCEPTED", label: "Accepted", count: accepted },
    { key: "REJECTED", label: "Rejected", count: rejected },
    { key: "WITHDRAWN", label: "Withdrawn" },
  ];

  return (
    <AppShell role="recruiter" title="Applications">
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={apps.length} />
        <StatCard label="Pending" value={pending} className="text-amber-600" />
        <StatCard label="Accepted" value={accepted} className="text-green-600" />
        <StatCard label="Rejected" value={rejected} className="text-red-500" />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.count !== undefined && (
              <Badge
                variant={filter === f.key ? "secondary" : "outline"}
                className="ml-1 text-[10px] px-1.5 py-0"
              >
                {f.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading applications…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">No applications found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const cfg = STATUS_CFG[app.status] ?? STATUS_CFG.PENDING;
            return (
              <Card key={app.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold leading-tight">{app.candidate_name}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{app.candidate_email}</span>
                          {app.candidate_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{app.candidate_phone}</span>}
                          {app.candidate_dob && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{app.candidate_dob}</span>}
                        </div>
                      </div>
                      <Badge variant={cfg.variant} className="shrink-0 gap-1">
                        {cfg.icon} {cfg.label}
                      </Badge>
                    </div>

                    {/* Job reference */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs gap-1">
                        <Briefcase className="h-3 w-3" /> {app.job_title}
                      </Badge>
                      {app.score !== null && (
                        <Badge variant="outline" className="text-[10px]">
                          Match: {(app.score * 100).toFixed(0)}%
                        </Badge>
                      )}
                      {app.experience_level && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {app.experience_level}
                        </Badge>
                      )}
                    </div>

                    {/* Skills */}
                    {app.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {app.skills.map((s) => (
                          <Badge key={s.name} variant="secondary" className="text-[10px]">
                            {s.name} Lv.{s.level}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Cover letter */}
                    {app.cover_letter && (
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Cover Letter</p>
                        <p className="text-sm">{app.cover_letter}</p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      {app.created_at && (
                        <span className="text-[10px] text-muted-foreground">
                          Applied {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      )}
                      {app.status === "PENDING" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => review(app.id, "ACCEPTED")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1 text-xs"
                            onClick={() => review(app.id, "REJECTED")}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link href={`/candidate/public/${app.candidate_id}`}>View Candidate Profile</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className={`text-2xl font-bold ${className ?? ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
