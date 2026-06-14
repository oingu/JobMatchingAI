"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Calendar,
  DollarSign,
  Briefcase,
  User,
  Users,
  CheckCircle2,
  Send,
  Eye,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import { getSession, type SessionData, type UserRole } from "@/lib/auth";

type RecruiterPublic = {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  company_website: string;
  company_phone: string;
  company_fax: string;
  company_address: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  overview: Array<{ title?: string; value?: string }>;
  verification_status: string;
  jobs: Array<{ id: number; title: string; location: string; domain: string; work_mode: string; employment_type: string; start_date: string | null; end_date: string | null }>;
};

function toWebsiteUrl(value: string): string {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export default function RecruiterPublicProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [data, setData] = useState<RecruiterPublic | null>(null);
  const [loading, setLoading] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      setLoading(false);
      return;
    }
    setSession(s);
    (async () => {
      try {
        const res = await apiRequest<RecruiterPublic>(`/recruiter-profiles/${params.id}/public`, { session: s });
        setData(res.data);
      } catch (err) {
        console.error("Failed to load recruiter profile:", err);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  const role = useMemo<UserRole>(() => session?.role ?? "candidate", [session?.role]);

  useEffect(() => {
    if (!session || role !== "candidate") return;
    (async () => {
      try {
        const res = await apiRequest<{ job_id: number }[]>("/applications/mine", { session });
        setAppliedJobs(new Set(res.data.map((a) => a.job_id)));
      } catch {
        /* ignore */
      }
    })();
  }, [session, role]);

  async function openJobDetail(jobId: number) {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await apiRequest<any>(`/jobs/${jobId}`, { session });
      setDetailJob(res.data);
    } catch {
      setDetailJob(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleApply(jobId: number) {
    setApplying(true);
    try {
      await apiRequest("/applications", {
        method: "POST",
        session,
        body: { job_id: jobId, cover_letter: "" },
      });
      setAppliedJobs((prev) => new Set(prev).add(jobId));
      success("Application submitted successfully!");
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to apply.");
    } finally {
      setApplying(false);
    }
  }

  const mapQuery = encodeURIComponent(data?.company_address || data?.jobs?.[0]?.location || "");
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertTitle>Phiên đăng nhập không tồn tại</AlertTitle>
          <AlertDescription>
            Bạn chưa đăng nhập hoặc token đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.
          </AlertDescription>
          <div className="mt-3">
            <Button onClick={() => router.push("/login")}>Đăng nhập</Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <AppShell role={role} title="Recruiter Profile">
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading profile…</p>
      ) : !data ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Profile not found.</p>
      ) : (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-xl border">
            <div
              className="h-40 w-full bg-gradient-to-r from-slate-100 to-slate-200 bg-cover bg-center"
              style={data.cover_url ? { backgroundImage: `url(${data.cover_url})` } : undefined}
            />
            <div className="relative px-6 pb-6">
              <div className="-mt-10 mb-3 h-20 w-20 overflow-hidden rounded-full border-4 border-background bg-muted">
                {data.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.avatar_url} alt={data.company_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-semibold">
                    {data.company_name?.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{data.company_name || data.name}</h2>
                {data.verification_status === "VERIFIED" && (
                  <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
                )}
              </div>
              {data.bio && <p className="mt-2 text-sm leading-relaxed text-foreground/90">{data.bio}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Building2 className="h-4 w-4" />{data.name}</span>
                {data.company_phone && <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{data.company_phone}</span>}
                {data.company_website && (
                  <a href={toWebsiteUrl(data.company_website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                    <Globe className="h-4 w-4" />{data.company_website}
                  </a>
                )}
                {data.email && <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" />{data.email}</span>}
                {data.company_address && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{data.company_address}</span>}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-base font-semibold">Company Overview</h3>
                {data.overview?.length ? data.overview.map((o, idx) => (
                  <div key={idx} className="mb-2 rounded-lg border bg-muted/20 p-3 last:mb-0">
                    <p className="text-xs text-muted-foreground">{o.title || "Info"}</p>
                    <p className="text-sm font-medium">{o.value || "—"}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No overview data.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-base font-semibold">Job Locations Map</h3>
                {mapQuery ? (
                  <iframe
                    title="Company location map"
                    src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                    className="h-64 w-full rounded-lg border"
                    loading="lazy"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No location available for map display.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-zinc-800 bg-zinc-950/20 backdrop-blur-md">
            <CardContent className="p-6">
              <h3 className="mb-4 text-lg font-bold tracking-tight bg-gradient-to-r from-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Open / Recent Jobs
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.jobs?.length ? (
                  data.jobs.map((j) => (
                    <div
                      key={j.id}
                      onClick={() => openJobDetail(j.id)}
                      className="group relative cursor-pointer overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/40 hover:shadow-lg hover:shadow-zinc-950/20 hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <div className="relative flex flex-col justify-between h-full gap-2">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-zinc-100 group-hover:text-violet-400 transition-colors duration-200">
                              {j.title}
                            </p>
                            <span className="text-[10px] text-violet-400 font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                              Chi tiết →
                            </span>
                          </div>
                          <p className="text-sm text-zinc-400 inline-flex items-center gap-1 mt-1">
                            <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                            {j.location || "Remote"}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {j.domain && <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{j.domain}</Badge>}
                            {j.work_mode && <Badge variant="outline" className="text-[10px] capitalize border-zinc-700 text-zinc-400">{j.work_mode}</Badge>}
                            {j.employment_type && <Badge variant="outline" className="text-[10px] capitalize border-zinc-700 text-zinc-400">{j.employment_type}</Badge>}
                          </div>
                        </div>

                        {(j.start_date || j.end_date) && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-900/80 text-[11px] text-zinc-500">
                            {j.start_date && (
                              <span>Bắt đầu: {new Date(j.start_date).toLocaleDateString()}</span>
                            )}
                            {j.end_date && (
                              <span>Hạn: {new Date(j.end_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                    No active job posts available.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Job Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none border-zinc-800 bg-zinc-950/95 backdrop-blur-xl text-zinc-100 flex flex-col h-full p-0">
          <SheetHeader className="pl-6 pr-12 pt-6 pb-4 bg-zinc-950/95 border-zinc-800/80">
            <SheetTitle className="text-xl font-bold text-zinc-100">
              {detailJob?.title ?? "Job Details"}
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              {detailJob ? `${detailJob.company || `Job #${detailJob.id}`}` : "Loading…"}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-800 border-t-violet-500" />
              </div>
            ) : detailJob ? (
              <div className="space-y-6">
                {/* Job info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-zinc-300">Thông tin công việc</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Công ty" value={`${detailJob.company || "—"} ${detailJob.recruiter_verified ? "✓ Verified" : ""}`} />
                    <InfoRow icon={<User className="h-4 w-4" />} label="Người tuyển dụng" value={detailJob.recruiter_name} />
                    {detailJob.company_phone && (
                      <InfoRow icon={<Phone className="h-4 w-4" />} label="Điện thoại" value={detailJob.company_phone} />
                    )}
                    {detailJob.company_website && (
                      <InfoRow
                        icon={<Globe className="h-4 w-4" />}
                        label="Website"
                        value={
                          <a
                            className="underline underline-offset-2 text-violet-400 hover:text-violet-300 transition-colors"
                            href={toWebsiteUrl(detailJob.company_website)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {detailJob.company_website}
                          </a>
                        }
                      />
                    )}
                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Địa điểm" value={detailJob.location || "—"} />
                    <InfoRow
                      icon={<Briefcase className="h-4 w-4" />}
                      label="Kinh nghiệm"
                      value={detailJob.experience_level}
                    />
                    <InfoRow
                      icon={<DollarSign className="h-4 w-4" />}
                      label="Mức lương"
                      value={
                        detailJob.salary_min || detailJob.salary_max
                          ? `${formatSalary(detailJob.salary_min)} – ${formatSalary(detailJob.salary_max)}`
                          : "Thỏa thuận"
                      }
                    />
                    <InfoRow
                      icon={<Users className="h-4 w-4" />}
                      label="Ứng viên"
                      value={`${detailJob.match_count} đã ứng tuyển`}
                    />
                    {detailJob.start_date && (
                      <InfoRow
                        icon={<Calendar className="h-4 w-4" />}
                        label="Ngày bắt đầu"
                        value={new Date(detailJob.start_date).toLocaleDateString()}
                      />
                    )}
                    {detailJob.end_date && (
                      <InfoRow
                        icon={<Calendar className="h-4 w-4" />}
                        label="Hạn cuối"
                        value={new Date(detailJob.end_date).toLocaleDateString()}
                      />
                    )}
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {detailJob.brief_description && (
                  <>
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-zinc-300">Mô tả công việc</h4>
                      <p className="text-sm leading-relaxed text-zinc-400 whitespace-pre-line">{detailJob.brief_description}</p>
                    </div>
                    <Separator className="bg-zinc-800" />
                  </>
                )}

                {/* Required skills */}
                {detailJob.required_skills && detailJob.required_skills.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-zinc-300">Kỹ năng yêu cầu</h4>
                    <div className="space-y-2">
                      {detailJob.required_skills.map((s: any) => (
                        <div
                          key={s.name}
                          className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/20 px-3 py-2"
                        >
                          <span className="text-sm font-medium text-zinc-300 capitalize">
                            {s.name}
                          </span>
                          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs">
                            Lv.{s.level} {LEVEL_LABELS[s.level] ?? ""}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="bg-zinc-800" />

                {/* Actions */}
                {role === "candidate" && (
                  <div className="flex gap-2">
                    {appliedJobs.has(detailJob.id) ? (
                      <Button disabled className="flex-1 gap-1.5 bg-zinc-800 text-zinc-400 border border-zinc-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Đã ứng tuyển
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-lg shadow-violet-600/20"
                        disabled={applying}
                        onClick={() => handleApply(detailJob.id)}
                      >
                        <Send className="h-4 w-4" /> {applying ? "Đang nộp..." : "Ứng tuyển ngay"}
                      </Button>
                    )}
                  </div>
                )}

                {detailJob.created_at && (
                  <p className="text-center text-[11px] text-zinc-500">
                    Đăng ngày{" "}
                    {new Date(detailJob.created_at).toLocaleDateString("vi-VN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-500">
                Không thể tải thông tin công việc.
              </p>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

function formatSalary(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-zinc-900/30 p-2.5 border border-zinc-900/80">
      <div className="mt-0.5 text-zinc-400">{icon}</div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="text-sm font-semibold text-zinc-200">{value}</p>
      </div>
    </div>
  );
}
