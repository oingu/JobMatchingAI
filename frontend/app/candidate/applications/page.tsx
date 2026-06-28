"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Trophy,
  Sparkles,
  Bot,
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
import { useUi } from "@/contexts/UiContext";
import { cn } from "@/lib/utils";
import { MockInterviewDialog } from "@/components/mock-interview-dialog";

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
  INTERVIEWING: {
    label: "Interviewing",
    icon: <CalendarDays className="h-3.5 w-3.5" />,
    variant: "default",
  },
  HIRED: {
    label: "Hired",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    variant: "default",
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
  const { glassMode } = useUi();
  const { success: toastSuccess, error: toastError } = useToast();
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<JobDetail | null>(null);
  const [detailApp, setDetailApp] = useState<ApplicationItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chatAppId, setChatAppId] = useState<number | null>(null);
  const [mockInterviewAppId, setMockInterviewAppId] = useState<string | null>(null);

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
  }, [session]);

  // Listen to WebSocket events to reload list
  useEffect(() => {
    const handleWsMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg.type === "new_message" || msg.type === "new_notification") {
        void load();
      }
    };
    window.addEventListener('ws-message', handleWsMessage);
    return () => window.removeEventListener('ws-message', handleWsMessage);
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
  const interviewing = apps.filter((a) => a.status === "INTERVIEWING");
  const hired = apps.filter((a) => a.status === "HIRED");
  const rejected = apps.filter((a) => a.status === "REJECTED");
  const invited = apps.filter((a) => a.status === "INVITED");

  const filteredApps = apps.filter((a) => statusFilter === "ALL" || a.status === statusFilter);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <AppShell role="candidate" title={t("candidate.apps.title")}>
      {/* Stats Pipeline */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className={cn(
          "mb-8 p-4 rounded-xl border flex flex-wrap items-center gap-4 transition-colors duration-300",
          glassMode ? "bg-background/30 backdrop-blur-3xl border-border/40 shadow-[0_4px_30px_rgba(0,0,0,0.05)]" : "bg-card border-border shadow-sm"
        )}
      >
        <motion.div variants={itemVariants}>
          <StatCard label={t("candidate.apps.total")} value={apps.length} icon={<Briefcase className="w-5 h-5" />} />
        </motion.div>
        
        <motion.div variants={itemVariants} className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2" />

        <div className="flex flex-wrap items-center gap-3">
          <motion.div variants={itemVariants}>
            <StatCard label={t("candidate.apps.invited")} value={invited.length} className="text-indigo-600 bg-indigo-50/60 dark:bg-indigo-900/20 border-indigo-200/50 dark:border-indigo-800/40" icon={<Sparkles className="w-5 h-5" />} />
          </motion.div>
          <motion.div variants={itemVariants}><ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-700 hidden sm:block" /></motion.div>
          
          <motion.div variants={itemVariants}>
            <StatCard label={t("candidate.apps.pending")} value={pending.length} className="text-amber-600 bg-amber-50/60 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/40" icon={<Clock className="w-5 h-5" />} />
          </motion.div>
          <motion.div variants={itemVariants}><ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-700 hidden sm:block" /></motion.div>
          
          <motion.div variants={itemVariants}>
            <StatCard label={t("candidate.apps.accepted")} value={accepted.length} className="text-green-600 bg-green-50/60 dark:bg-green-900/20 border-green-200/50 dark:border-green-800/40" icon={<CheckCircle2 className="w-5 h-5" />} />
          </motion.div>
          <motion.div variants={itemVariants}><ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-700 hidden sm:block" /></motion.div>
          
          <motion.div variants={itemVariants}>
            <StatCard label="Interviewing" value={interviewing.length} className="text-blue-600 bg-blue-50/60 dark:bg-blue-900/20 border-blue-200/50 dark:border-blue-800/40" icon={<CalendarDays className="w-5 h-5" />} />
          </motion.div>
          <motion.div variants={itemVariants}><ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-700 hidden sm:block" /></motion.div>
          
          <motion.div variants={itemVariants}>
            <StatCard label="Hired" value={hired.length} className="text-emerald-600 bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-300/60 dark:border-emerald-700/50 ring-1 ring-emerald-500/30 shadow-sm" icon={<Trophy className="w-5 h-5" />} />
          </motion.div>
        </div>

        <motion.div variants={itemVariants} className="sm:ml-auto">
          <StatCard label={t("candidate.apps.rejected")} value={rejected.length} className="text-red-500 bg-red-50/60 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/40 opacity-80 hover:opacity-100" icon={<XCircle className="w-5 h-5" />} />
        </motion.div>
      </motion.div>

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
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button
              variant={statusFilter === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("ALL")}
              className="text-xs h-8"
            >
              All
            </Button>
            {["INVITED", "PENDING", "ACCEPTED", "INTERVIEWING", "HIRED", "REJECTED", "WITHDRAWN"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="text-xs h-8"
              >
                {STATUS_CONFIG[status]?.label || status}
              </Button>
            ))}
          </div>

          <motion.div 
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            key={statusFilter} // Re-animate when filter changes
          >
            {filteredApps.length === 0 ? (
              <motion.div variants={itemVariants} className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
                No applications found for the selected status.
              </motion.div>
            ) : (
              filteredApps.map((app) => {
            const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.PENDING;
            const isPremium = app.status === "INVITED" || (app.score !== null && app.score >= 0.9);

            return (
              <motion.div key={app.id} variants={itemVariants}>
              <Card 
                className={cn(
                  "relative overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl group shadow-sm",
                  isPremium 
                    ? (glassMode ? "bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/5 border-indigo-500/30 hover:border-indigo-500/60 hover:shadow-indigo-500/20" : "bg-card border-indigo-500/30 hover:border-indigo-500/60 hover:shadow-indigo-500/20")
                    : (glassMode ? "bg-background/40 backdrop-blur-xl border border-border/60 hover:bg-accent/30 hover:border-border/80 hover:shadow-primary/5" : "bg-card border-border hover:border-primary/40 hover:shadow-primary/5")
                )}
              >
                {/* Decorative background glow for premium cards */}
                {isPremium && (
                  <div className="absolute -right-20 -top-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors duration-500" />
                )}
                
                <CardContent className="flex items-start gap-4 p-5 relative z-10">
                  <div className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                    isPremium ? "bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-500/20" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                  )}>
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg leading-tight truncate group-hover:text-primary transition-colors">
                            {app.job_title}
                          </h3>
                          {isPremium && (
                            <span className="flex h-5 items-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-2 text-[9px] font-bold text-white uppercase tracking-wider animate-pulse shadow-sm">
                              ✨ {app.status === "INVITED" ? "Invited" : "Top Match"}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5 truncate">
                            <Avatar size="sm">
                              <AvatarImage src={app.company_avatar_url || undefined} alt={app.company || "Company"} />
                              <AvatarFallback>
                                {(app.company || "C").slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[120px]">{app.company}</span>
                          </span>
                          {app.location && (
                            <span className="flex items-center gap-1 truncate max-w-[100px]">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{app.location}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="w-full sm:w-auto flex flex-col items-end gap-3 shrink-0">
                        <div className="w-full sm:w-auto sm:min-w-[250px] md:min-w-[300px] flex justify-end">
                          <ApplicationTimeline status={app.status} />
                        </div>
                      </div>
                    </div>

                    {app.cover_letter && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic pt-2">
                        &ldquo;{app.cover_letter}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-wrap items-center gap-3">
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
                        <>
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
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                          onClick={() => setMockInterviewAppId(app.id.toString())}
                        >
                          <Bot className="h-3 w-3" /> {t("candidate.apps.mock_interview")}
                        </Button>
                        </>
                      )}
                      </div>
                      <Badge variant={cfg.variant} className="shrink-0 gap-1 ml-auto">
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            );
          })
            )}
          </motion.div>
        </>
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
                  <Card className={cn("border border-border ring-0 shadow-none transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl" : "bg-transparent hover:bg-accent/5")}>
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
      {mockInterviewAppId && (
        <MockInterviewDialog
          appId={mockInterviewAppId}
          isOpen={true}
          onClose={() => setMockInterviewAppId(null)}
          session={session}
        />
      )}
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

  function StatCard({ label, value, className = "", icon }: { label: string; value: number; className?: string, icon?: React.ReactNode }) {
    const { glassMode } = useUi();
    return (
      <div className={cn(
        "flex min-w-[130px] items-center justify-between gap-3 rounded-xl border p-3 transition-all duration-300 hover:shadow-lg hover:-translate-y-1", 
        glassMode ? "border-border/40 bg-background/20 backdrop-blur-md hover:bg-background/40" : "bg-card border-border hover:bg-accent/40",
        className
      )}>
        <div className="flex flex-col">
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
          <p className="text-2xl font-bold leading-none mt-1">{value}</p>
        </div>
        {icon && <div className="opacity-80">{icon}</div>}
      </div>
    );
  }

function ApplicationTimeline({ status }: { status: string }) {
  if (status === "INVITED") return null; // No timeline needed for invitations yet

  const steps = [
    { key: "applied", label: "Applied", active: true, variant: "default" },
    { 
      key: "shortlisted", 
      label: ["ACCEPTED", "INTERVIEWING", "HIRED"].includes(status) ? "Shortlisted" : status === "REJECTED" ? "Rejected" : status === "WITHDRAWN" ? "Withdrawn" : "Under Review", 
      active: ["ACCEPTED", "INTERVIEWING", "HIRED", "REJECTED", "WITHDRAWN"].includes(status),
      variant: status === "REJECTED" ? "destructive" : status === "WITHDRAWN" ? "warning" : "default"
    },
    { 
      key: "interview", 
      label: "Interviewing", 
      active: ["INTERVIEWING", "HIRED"].includes(status),
      variant: status === "INTERVIEWING" ? "success" : "default"
    },
    {
      key: "hired",
      label: "Hired",
      active: status === "HIRED",
      variant: status === "HIRED" ? "success" : "default"
    }
  ];

  return (
    <div className="flex items-center w-full max-w-sm mt-2 relative mx-auto">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5 relative z-10">
            <div 
              className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center border-2 text-[9px] font-bold transition-all duration-300",
                step.active 
                  ? step.variant === "success" ? "bg-green-500 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]" 
                    : step.variant === "destructive" ? "bg-red-500 border-red-500 text-white"
                    : step.variant === "warning" ? "bg-amber-500 border-amber-500 text-white"
                    : "bg-primary border-primary text-primary-foreground shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                  : "bg-muted border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {step.active && step.variant === "success" ? <CheckCircle2 className="h-3 w-3" /> 
               : step.active && step.variant === "destructive" ? <XCircle className="h-3 w-3" />
               : idx + 1}
            </div>
            <span className={cn(
              "text-[10px] font-medium absolute top-6 whitespace-nowrap",
              step.active ? "text-foreground" : "text-muted-foreground"
            )}>
              {step.label}
            </span>
          </div>
          
          {/* Connector Line */}
          {idx < steps.length - 1 && (
            <div className="flex-1 h-[2px] mx-1 relative">
              <div className="absolute inset-0 bg-muted-foreground/20 rounded-full" />
              <div 
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                  steps[idx + 1].active ? "w-full bg-primary" : "w-0 bg-primary"
                )} 
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
