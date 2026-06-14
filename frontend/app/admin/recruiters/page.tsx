"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  Mail,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type RecruiterItem = {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  company_website: string;
  avatar_url: string;
  verification_status: string;
  job_count: number;
  total_applicants: number;
  created_at: string | null;
};

type FilterStatus = "ALL" | "VERIFIED" | "UNVERIFIED" | "PENDING_REVIEW" | "REJECTED";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  VERIFIED: {
    label: "Verified",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  PENDING_REVIEW: {
    label: "Pending",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: <Clock className="h-3 w-3" />,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    icon: <XCircle className="h-3 w-3" />,
  },
  UNVERIFIED: {
    label: "Unverified",
    color: "bg-muted/50 text-muted-foreground border-border/50",
    icon: <ShieldAlert className="h-3 w-3" />,
  },
};

export default function AdminRecruitersPage() {
  return (
    <RoleGuard allowedRole="admin">
      {(session) => <Content session={session} />}
    </RoleGuard>
  );
}

function Content({ session }: { session: SessionData }) {
  const [recruiters, setRecruiters] = useState<RecruiterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await apiRequest<RecruiterItem[]>("/admin/recruiters", { session });
        setRecruiters(res.data);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [session]);

  const filtered = recruiters.filter((r) => {
    if (filter !== "ALL" && r.verification_status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.company_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalRecruiters = recruiters.length;
  const verifiedCount = recruiters.filter((r) => r.verification_status === "VERIFIED").length;
  const pendingCount = recruiters.filter((r) => r.verification_status === "PENDING_REVIEW").length;
  const unverifiedCount = recruiters.filter((r) => r.verification_status === "UNVERIFIED").length;
  const rejectedCount = recruiters.filter((r) => r.verification_status === "REJECTED").length;
  const totalJobs = recruiters.reduce((sum, r) => sum + r.job_count, 0);
  const totalApplicants = recruiters.reduce((sum, r) => sum + r.total_applicants, 0);

  const filters: { key: FilterStatus; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: totalRecruiters },
    { key: "VERIFIED", label: "Verified", count: verifiedCount },
    { key: "PENDING_REVIEW", label: "Pending", count: pendingCount },
    { key: "UNVERIFIED", label: "Unverified", count: unverifiedCount },
    { key: "REJECTED", label: "Rejected", count: rejectedCount },
  ];

  return (
    <AppShell role="admin" title="Recruiters">
      {/* Overview Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalRecruiters}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Total Recruiters</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{verifiedCount}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{totalJobs}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Total Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-500">{totalApplicants}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Total Applicants</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="ml-0.5 text-[10px] opacity-70">({f.count})</span>
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company..."
            className="pl-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">No recruiters found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec) => {
            const cfg = STATUS_CONFIG[rec.verification_status] ?? STATUS_CONFIG.UNVERIFIED;
            const initials = rec.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <Card key={rec.user_id} className="transition-colors hover:border-border/80">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Avatar className="h-11 w-11 border border-border shrink-0">
                      {rec.avatar_url && (
                        <AvatarImage src={rec.avatar_url} alt={rec.name} className="object-cover" />
                      )}
                      <AvatarFallback className="bg-muted text-xs font-bold text-foreground/80">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground truncate">{rec.name}</h3>
                        <Badge variant="outline" className={`gap-1 text-[10px] ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {rec.email}
                        </span>
                        {rec.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {rec.phone}
                          </span>
                        )}
                        {rec.company_name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {rec.company_name}
                          </span>
                        )}
                        {rec.company_website && (
                          <a
                            href={rec.company_website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors"
                          >
                            <Globe className="h-3 w-3" /> Website
                          </a>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center gap-1.5 rounded-md bg-muted/40 border border-border/40 px-2.5 py-1">
                          <Briefcase className="h-3 w-3 text-blue-500" />
                          <span className="text-xs font-semibold text-foreground/90">{rec.job_count}</span>
                          <span className="text-[10px] text-muted-foreground">jobs</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-md bg-muted/40 border border-border/40 px-2.5 py-1">
                          <Users className="h-3 w-3 text-violet-500" />
                          <span className="text-xs font-semibold text-foreground/90">{rec.total_applicants}</span>
                          <span className="text-[10px] text-muted-foreground">applicants</span>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex flex-col items-end justify-between h-full min-h-[5rem] shrink-0">
                      <Button asChild variant="outline" size="sm" className="text-xs">
                        <Link href={`/recruiter/public/${rec.user_id}`}>View Profile</Link>
                      </Button>
                      {rec.created_at && (
                        <span className="text-[10px] text-muted-foreground/60 mt-auto pt-2">
                          Joined {new Date(rec.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
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
