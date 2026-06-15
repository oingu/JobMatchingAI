"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Undo2,
  Eye,
  DollarSign,
  User,
  Phone,
  Globe,
  Calendar,
  Users,
  Layers,
  Monitor,
  Send,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { ChatBox } from "@/components/chat-box";
import { MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";

type ApplicationItem = {
  id: number;
  job_id: number;
  job_title: string;
  company: string;
  company_avatar_url: string;
  location: string;
  cover_letter: string;
  status: string;
  score: number | null;
  unread_messages_count: number;
  created_at: string | null;
  updated_at: string | null;
};

type SkillItem = { name: string; level: number };
type JobDetail = {
  id: number;
  recruiter_id: number;
  title: string;
  brief_description: string;
  required_skills: SkillItem[];
  location: string;
  salary_min: number;
  salary_max: number;
  experience_level: string;
  domain: string;
  work_mode: string;
  employment_type: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  recruiter_name: string;
  company: string;
  company_phone: string;
  company_website: string;
  recruiter_verified: boolean;
  match_count: number;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: {
    label: "Pending",
    icon: <Clock className="h-3.5 w-3.5" />,
    variant: "secondary",
  },
  ACCEPTED: {
    label: "Accepted",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    variant: "default",
  },
  REJECTED: {
    label: "Rejected",
    icon: <XCircle className="h-3.5 w-3.5" />,
    variant: "destructive",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    variant: "outline",
  },
  INVITED: {
    label: "Invited",
    icon: <Send className="h-3.5 w-3.5" />,
    variant: "default",
  },
};

export default function MyApplicationsPage() {
  return (
    <RoleGuard allowedRole="candidate">
      {(session) => <ApplicationsContent session={session} />}
    </RoleGuard>
  );
}

function ApplicationsContent({ session }: { session: SessionData }) {
  const { t } = useLanguage();
  const { success: toastSuccess, error: toastError } = useToast();
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<JobDetail | null>(null);
  const [detailApp, setDetailApp] = useState<ApplicationItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chatAppId, setChatAppId] = useState<number | null>(null);

  async function load() {
    try {
      const res = await apiRequest<ApplicationItem[]>("/applications/mine", {
        session,
      });
      setApps(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function withdraw(appId: number) {
    try {
      await apiRequest(`/applications/${appId}`, {
        method: "DELETE",
        session,
      });
      toastSuccess("Application withdrawn.");
      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: "WITHDRAWN" } : a)),
      );
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Withdraw failed.");
    }
  }

  async function respondToInvitation(appId: number, action: "ACCEPT" | "DECLINE") {
    try {
      await apiRequest(`/applications/${appId}/respond`, {
        method: "POST",
        session,
        body: { action }
      });
      toastSuccess(action === "ACCEPT" ? "Invitation accepted! Application is now pending." : "Invitation declined.");
      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: action === "ACCEPT" ? "PENDING" : "WITHDRAWN" } : a)),
      );
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to respond.");
    }
  }

  async function openDetail(app: ApplicationItem) {
    setDetailApp(app);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await apiRequest<JobDetail>(`/jobs/${app.job_id}`, { session });
      setDetailJob(res.data);
    } catch {
      setDetailJob(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const pending = apps.filter((a) => a.status === "PENDING");
  const accepted = apps.filter((a) => a.status === "ACCEPTED");
  const rejected = apps.filter((a) => a.status === "REJECTED");
  const invited = apps.filter((a) => a.status === "INVITED");

  return (
    <AppShell role="candidate" title={t("candidate.apps.title")}>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label={t("candidate.apps.total")} value={apps.length} />
        <StatCard label={t("candidate.apps.invited")} value={invited.length} className="text-indigo-600" />
        <StatCard label={t("candidate.apps.pending")} value={pending.length} />
        <StatCard
          label={t("candidate.apps.accepted")}
          value={accepted.length}
          className="text-green-600"
        />
        <StatCard
          label={t("candidate.apps.rejected")}
          value={rejected.length}
          className="text-red-500"
        />
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          {t("ui.loading")}
        </p>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Briefcase className="h-10 w-10 opacity-40" />
          <p className="text-sm">{t("candidate.apps.no_apps")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => {
            const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.PENDING;
            return (
              <Card key={app.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold leading-tight">
                          {app.job_title}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Avatar size="sm">
                              <AvatarImage src={app.company_avatar_url || undefined} alt={app.company || "Company"} />
                              <AvatarFallback>
                                {(app.company || "C").slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {app.company}
                          </span>
                          {app.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {app.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant={cfg.variant} className="shrink-0 gap-1">
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </div>

                    {app.cover_letter && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        &ldquo;{app.cover_letter}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center gap-3 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => void openDetail(app)}
                      >
                        <Eye className="h-3 w-3" /> {t("ui.view_details")}
                      </Button>
                      {app.score !== null && (
                        <Badge variant="outline" className="text-[10px]">
                          {t("candidate.apps.match")}: {(app.score * 100).toFixed(0)}%
                        </Badge>
                      )}
                      {app.created_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {t("candidate.apps.applied_on")}{" "}
                          {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      )}
                      {app.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => withdraw(app.id)}
                        >
                          <Undo2 className="h-3 w-3" /> {t("candidate.apps.withdraw")}
                        </Button>
                      )}
                      {app.status === "INVITED" && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-1 text-xs bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => respondToInvitation(app.id, "ACCEPT")}
                          >
                            <CheckCircle2 className="h-3 w-3" /> {t("candidate.apps.accept_invite")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => respondToInvitation(app.id, "DECLINE")}
                          >
                            <XCircle className="h-3 w-3" /> {t("candidate.apps.decline_invite")}
                          </Button>
                        </div>
                      )}
                      {["ACCEPTED", "INTERVIEWING"].includes(app.status) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 relative"
                          onClick={() => setChatAppId(app.id)}
                        >
                          <MessageCircle className="h-3 w-3" /> {t("candidate.apps.chat")}
                          {app.unread_messages_count > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
                              {app.unread_messages_count}
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>{detailApp?.job_title ?? "Job Details"}</SheetTitle>
            <SheetDescription>
              {detailApp
                ? `${detailApp.company || `Job #${detailApp.job_id}`}${detailApp.score !== null ? ` • ${(detailApp.score * 100).toFixed(0)}% match` : ""}`
                : "Loading…"}
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1 px-4">
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
              </div>
            ) : detailJob ? (
              <div className="space-y-5 py-4">
                {detailApp?.score !== null && detailApp?.score !== undefined && (
                  <Card className="border border-border ring-0 shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Your Match Score</p>
                        <p className="text-2xl font-bold text-primary">
                          {(detailApp.score * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="mt-3">
                        <Progress value={detailApp.score * 100} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Job Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Company" value={detailJob.company || "—"} />
                    <InfoRow icon={<User className="h-4 w-4" />} label="Recruiter" value={detailJob.recruiter_name} />
                    {detailJob.company_phone && (
                      <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={detailJob.company_phone} />
                    )}
                    {detailJob.company_website && (
                      <InfoRow
                        icon={<Globe className="h-4 w-4" />}
                        label="Website"
                        value={
                          <a className="underline underline-offset-2 hover:text-foreground" href={toWebsiteUrl(detailJob.company_website)} target="_blank" rel="noreferrer">
                            {detailJob.company_website}
                          </a>
                        }
                      />
                    )}
                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={detailJob.location || "—"} />
                    <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Experience" value={detailJob.experience_level} />
                    <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Salary" value={`${detailJob.salary_min || 0} - ${detailJob.salary_max || 0}`} />
                    {detailJob.domain && (
                      <InfoRow icon={<Layers className="h-4 w-4" />} label="Domain" value={detailJob.domain} />
                    )}
                    {detailJob.work_mode && (
                      <InfoRow icon={<Monitor className="h-4 w-4" />} label="Work Mode" value={detailJob.work_mode} />
                    )}
                    {detailJob.employment_type && (
                      <InfoRow icon={<Clock className="h-4 w-4" />} label="Type" value={detailJob.employment_type} />
                    )}
                    <InfoRow icon={<Users className="h-4 w-4" />} label="Candidates" value={`${detailJob.match_count} matched`} />
                    {detailJob.start_date && (
                      <InfoRow icon={<Calendar className="h-4 w-4" />} label="Start" value={new Date(detailJob.start_date).toLocaleDateString()} />
                    )}
                    {detailJob.end_date && (
                      <InfoRow icon={<Calendar className="h-4 w-4" />} label="Deadline" value={new Date(detailJob.end_date).toLocaleDateString()} />
                    )}
                  </div>
                </div>

                <Separator />

                {detailJob.brief_description && (
                  <>
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Brief Description</h4>
                      <p className="text-sm text-muted-foreground">{detailJob.brief_description}</p>
                    </div>
                    <Separator />
                  </>
                )}

                {detailJob.required_skills.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Required Skills</h4>
                    <div className="space-y-2">
                      {detailJob.required_skills.map((s) => (
                        <div
                          key={s.name}
                          className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                        >
                          <span className="text-sm font-medium capitalize">{s.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            Lv.{s.level}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />
                {detailJob.recruiter_id && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/recruiter/public/${detailJob.recruiter_id}`}>
                      View Recruiter Profile
                    </Link>
                  </Button>
                )}
                
                {detailApp && (detailApp.status === "ACCEPTED" || detailApp.status === "INTERVIEWING") && (
                  <>
                    <Separator />
                    <Button 
                      onClick={() => {
                        setChatAppId(detailApp.id);
                        setDetailOpen(false);
                      }} 
                      className="w-full gap-2"
                    >
                      <MessageCircle className="h-4 w-4" /> Message Recruiter
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Could not load job details.
              </p>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Floating Chat Box */}
      {(() => {
        const chatAppDetails = apps.find(a => a.id === chatAppId);
        if (!chatAppDetails) return null;
        return (
          <div className="fixed bottom-0 right-4 sm:right-20 z-[100] animate-in slide-in-from-bottom-5">
            <ChatBox 
              applicationId={chatAppDetails.id} 
              currentUserId={session.userId} 
              session={session} 
              recipientName={chatAppDetails.company || "Recruiter"}
              recipientAvatar={chatAppDetails.company_avatar_url}
              onClose={() => setChatAppId(null)}
              className="w-[330px] h-[450px] sm:w-[350px] sm:h-[460px] border-b-0 rounded-b-none"
            />
          </div>
        );
      })()}
    </AppShell>
  );
}

function toWebsiteUrl(value: string): string {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
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
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium capitalize">{value}</p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className={`text-2xl font-bold ${className ?? ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
