"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  Briefcase,
  Eye,
  EyeOff,
  Bookmark,
  Send,
  CheckCircle2,
  Calendar,
  Users,
  Building2,
  User,
  Phone,
  Globe,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  Sparkles,
  Zap,
  Star,
  MapPin,
  Layers,
  Monitor,
  Clock,
  BrainCircuit,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUi } from "@/contexts/UiContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TiltCard } from "@/components/ui/tilt-card";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/toast";
import { apiRequest, qs } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type SkillItem = { name: string; level: number };

type FeedItem = {
  job_id: number;
  recruiter_id: number | null;
  job_title: string;
  brief_description: string;
  score: number;
  skill_match: number;
  preference_match: number;
  activity_score: number;
  location: string;
  salary_min: number;
  salary_max: number;
  experience_level: string;
  domain: string;
  work_mode: string;
  employment_type: string;
  required_skills: SkillItem[];
  matched_skills: string[];
  company: string;
  company_avatar_url: string;
  company_phone: string;
  company_website: string;
  recruiter_verified: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  external_link: string;
};

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
  company_avatar_url: string;
  company_phone: string;
  company_website: string;
  recruiter_verified: boolean;
  match_count: number;
  external_link: string;
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};
const BRIEF_PREVIEW_LIMIT = 500;

const TOP_K_OPTIONS = [5, 10, 15, 20];

function formatSalary(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function toWebsiteUrl(value: string): string {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function timeAgo(dateStr: string, t: (key: string) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return t("feed.time_now");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${t("feed.time_m")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t("feed.time_h")}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${t("feed.time_d")}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}${t("feed.time_w")}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}${t("feed.time_mo")}`;
  return `${Math.floor(months / 12)}${t("feed.time_y")}`;
}

function deadlineCountdown(dateStr: string): { text: string; urgent: boolean } {
  const now = new Date();
  const deadline = new Date(dateStr);
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "Expired", urgent: true };
  if (diffDays === 0) return { text: "🔴 Expires today!", urgent: true };
  if (diffDays === 1) return { text: "⏰ 1 day left to apply", urgent: true };
  if (diffDays <= 3) return { text: `⏰ ${diffDays} days left to apply`, urgent: true };
  if (diffDays <= 7) return { text: `📅 ${diffDays} days left`, urgent: false };
  return { text: `📅 Deadline: ${deadline.toLocaleDateString()}`, urgent: false };
}

function AnimatedScore({ value, className }: { value: number, className?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const stepTime = Math.abs(Math.floor(duration / steps));
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      // easeOutExpo for smoother ending
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.round(value * easeProgress));

      if (currentStep >= steps) {
        clearInterval(timer);
        setDisplayValue(Math.round(value));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return <span className={className}>{displayValue}%</span>;
}

function AnimatedProgress({ value, className }: { value: number, className?: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // slight delay for stagger effect
    const timer = setTimeout(() => setProgress(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return <Progress value={progress} className={cn("transition-all duration-1000 ease-out", className)} />;
}

export default function CandidateFeedPage() {
  return (
    <RoleGuard allowedRole="candidate">
      {(session) => <CandidateFeedContent session={session} />}
    </RoleGuard>
  );
}

function CandidateFeedContent({ session }: { session: SessionData }) {
  const { t } = useLanguage();
  const { glassMode } = useUi();
  const { success: toastSuccess, error: toastError } = useToast();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appliedJobs, setAppliedJobs] = useState<Set<number>>(new Set());
  const [savedJobs, setSavedJobs] = useState<Set<number>>(new Set());

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<JobDetail | null>(null);
  const [detailFeed, setDetailFeed] = useState<FeedItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [analyzingGap, setAnalyzingGap] = useState(false);
  const [gapAnalysis, setGapAnalysis] = useState<any>(null);

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyJobId, setApplyJobId] = useState<number | null>(null);
  const [applyJobTitle, setApplyJobTitle] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [expandedBriefJobs, setExpandedBriefJobs] = useState<Set<number>>(new Set());

  async function load(k: number = topK) {
    setError("");
    setLoading(true);
    try {
      const query = qs({ top_k: k });
      const res = await apiRequest<{
        candidate_id: number;
        items: FeedItem[];
      }>(`/feed/candidate/${session.userId}${query}`, { session });
      setItems(res.data.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load recommendations.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAppliedJobs() {
    try {
      const res = await apiRequest<{ job_id: number }[]>("/applications/mine", { session });
      setAppliedJobs(new Set(res.data.map((a) => a.job_id)));
    } catch {
      /* ignore */
    }
  }

  async function track(jobId: number, eventType: "view" | "click") {
    try {
      await apiRequest("/interactions", {
        method: "POST",
        session,
        body: {
          user_id: session.userId,
          job_id: jobId,
          event_type: eventType,
          event_metadata: {},
        },
      });
      if (eventType === "click") {
        setSavedJobs((prev) => new Set(prev).add(jobId));
        toastSuccess("Job saved to your archive.");
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  async function handleExternalLinkClick(jobId: number, externalLink: string) {
    try {
      await apiRequest("/interactions", {
        method: "POST",
        session,
        body: {
          user_id: session.userId,
          job_id: jobId,
          event_type: "click",
          event_metadata: { source: "external_job_link", target: externalLink },
        },
      });
    } catch (err) {
      console.error("Failed to track interaction:", err);
    }
    window.open(externalLink, "_blank", "noopener,noreferrer");
  }

  function openApplyDialog(jobId: number, jobTitle: string) {
    setApplyJobId(jobId);
    setApplyJobTitle(jobTitle);
    setCoverLetter("");
    setApplyDialogOpen(true);
  }

  async function submitApplication() {
    if (applyJobId === null) return;
    setApplying(true);
    try {
      await apiRequest("/applications", {
        method: "POST",
        session,
        body: { job_id: applyJobId, cover_letter: coverLetter },
      });
      setAppliedJobs((prev) => new Set(prev).add(applyJobId));
      toastSuccess("Application submitted successfully!");
      setApplyDialogOpen(false);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to apply.");
    } finally {
      setApplying(false);
    }
  }

  function toggleBrief(jobId: number) {
    setExpandedBriefJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  async function openDetail(feedItem: FeedItem) {
    setDetailFeed(feedItem);
    setDetailOpen(true);
    setDetailLoading(true);
    setGapAnalysis(null);
    void track(feedItem.job_id, "view");
    try {
      const res = await apiRequest<JobDetail>(
        `/jobs/${feedItem.job_id}`,
        { session },
      );
      setDetailJob(res.data);
    } catch {
      setDetailJob(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadAppliedJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTopKChange(k: number) {
    setTopK(k);
    void load(k);
  };

  const handleHideJob = async (jobId: number) => {
    if (!session?.userId) return;
    try {
      await apiRequest(`/feed/candidate/${session.userId}/hide-job/${jobId}`, {
        method: "POST",
        session,
      });
      // Optimistically remove from feed
      setItems((prev) => prev.filter((item) => item.job_id !== jobId));
      toastSuccess("Job hidden from feed.");
    } catch (err: any) {
      toastError(err.message || "Failed to hide job");
    }
  };

  async function handleAnalyzeGap() {
    if (!detailJob) return;
    setAnalyzingGap(true);
    setGapAnalysis(null);
    try {
      const res = await apiRequest<any>(`/jobs/${detailJob.id}/analyze-gap`, {
        method: "POST",
        session,
      });
      setGapAnalysis(res.data);
      toastSuccess("Skill gap analysis complete!");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzingGap(false);
    }
  }

  return (
    <AppShell role="candidate" title="Job Feed">
      <div className="w-full space-y-5">
        {/* Personalized greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Hi {session.name?.split(" ").pop() || "there"} 👋
            </h2>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Finding matching jobs for you..."
                : items.length > 0
                  ? `${items.length} jobs match your profile today`
                  : "No matching jobs found yet"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">
              {t("feed.show_top") as string}
            </span>
            {TOP_K_OPTIONS.map((k) => (
              <Button
                key={k}
                variant={topK === k ? "default" : "outline"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => handleTopKChange(k)}
              >
                {k}
              </Button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl border border-border bg-card/10">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-3 flex-1">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-20 w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12">
              <Briefcase className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                {t("feed.no_recommendations") as string}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("feed.update_profile") as string}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => {
              const alreadyApplied = appliedJobs.has(item.job_id);
              const alreadySaved = savedJobs.has(item.job_id);
              const isPremium = item.score >= 0.9;

              return (
                <div
                  key={`${item.job_id}-${idx}`}
                  style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" }}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-400"
                >
                  <TiltCard
                    intensity={isPremium ? 8 : 4}
                    popOutChildren={false}
                    innerClassName="flex w-full"
                    className={cn(
                      "rounded-xl relative flex overflow-hidden group transition-all duration-300 shadow-sm",
                      isPremium 
                        ? (glassMode ? "bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/5 border border-indigo-500/30 hover:border-indigo-500/60 hover:shadow-indigo-500/20" : "bg-transparent border border-indigo-500/30 hover:border-indigo-500/60 hover:shadow-indigo-500/20 hover:bg-indigo-500/5")
                        : (glassMode ? "bg-background/40 backdrop-blur-xl border border-border/60 hover:bg-accent/30 hover:border-border/80 hover:shadow-foreground/5" : "bg-transparent hover:bg-accent/5 hover:border-primary/40 hover:shadow-primary/5 border border-border")
                    )}
                  >
                  {/* Decorative background glow for premium cards */}
                  {isPremium && (
                    <div className="absolute -right-20 -top-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors duration-500 z-0 pointer-events-none" />
                  )}
                  {/* ── Rank sidebar ── */}
                  <div className={cn(
                    "flex w-12 shrink-0 flex-col items-center justify-center border-r select-none relative z-10 transition-colors duration-300",
                    isPremium ? "bg-indigo-500/5 border-indigo-500/20 group-hover:bg-indigo-500/10" : "bg-muted/20 border-border/60"
                  )}>
                    <span className={cn(
                      "text-sm font-mono font-bold transition-colors duration-300",
                      isPremium ? "text-indigo-500 group-hover:text-indigo-400" : "text-muted-foreground group-hover:text-primary"
                    )}>
                      #{idx + 1}
                    </span>
                    <span className={cn(
                      "text-[8px] font-mono uppercase tracking-wider mt-0.5",
                      isPremium ? "text-indigo-500/70" : "text-muted-foreground"
                    )}>
                      {t("feed.rank") as string}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* ── Post header (company info) ── */}
                    <div className="flex items-start gap-3 p-5 pb-0">
                      <Avatar className="h-10 w-10 border border-border shrink-0 mt-0.5">
                        <AvatarImage src={item.company_avatar_url || undefined} alt={item.company || "Company"} />
                        <AvatarFallback className="bg-muted text-xs font-bold text-muted-foreground">
                          {(item.company || "C").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.recruiter_id ? (
                            <Link
                              href={`/recruiter/public/${item.recruiter_id}`}
                              className="text-sm font-semibold text-foreground/90 hover:text-foreground transition-colors truncate"
                            >
                              {item.company || `Recruiter #${item.recruiter_id}`}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold text-foreground/90 truncate">
                              {item.company || "Unknown Company"}
                            </span>
                          )}
                          {item.recruiter_verified && (
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {item.location && (
                            <>
                              <span>{item.location}</span>
                              <span className="text-muted-foreground/50">•</span>
                            </>
                          )}
                          {item.created_at && (
                            <span>{timeAgo(item.created_at, t as any)}</span>
                          )}
                        </div>
                      </div>
                      {/* Match score pill & Hide Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={cn(
                          "flex items-center gap-1 rounded-full px-2.5 py-1",
                          isPremium 
                            ? "bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse shadow-sm border-none" 
                            : "bg-emerald-500/10 border border-emerald-500/20"
                        )}>
                          <AnimatedScore
                            value={item.score * 100}
                            className={cn(
                              "text-sm font-bold font-mono tracking-tight",
                              isPremium ? "text-white" : "text-emerald-600 dark:text-emerald-500"
                            )}
                          />
                          <span className={cn(
                            "text-[9px] font-medium",
                            isPremium ? "text-white uppercase tracking-wider font-bold" : "text-emerald-600/70 dark:text-emerald-500/70 lowercase tracking-normal"
                          )}>
                            {t("feed.match") as string}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHideJob(item.job_id);
                          }}
                          title="Hide this job"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          <span className="sr-only">Hide job</span>
                        </Button>
                      </div>
                    </div>

                    {/* ── Post body ── */}
                    <div className="px-5 pt-3 pb-0 relative z-10">
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-base font-bold text-foreground cursor-pointer group-hover:text-primary transition-colors leading-snug truncate"
                          onClick={() => void openDetail(item)}
                        >
                          {item.job_title}
                        </h3>
                      </div>

                      {item.brief_description && (
                        <div className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                          <p>
                            {expandedBriefJobs.has(item.job_id) || item.brief_description.length <= BRIEF_PREVIEW_LIMIT
                              ? item.brief_description
                              : `${item.brief_description.slice(0, BRIEF_PREVIEW_LIMIT)}…`}
                          </p>
                          {item.brief_description.length > BRIEF_PREVIEW_LIMIT && (
                            <button
                              type="button"
                              className="mt-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => toggleBrief(item.job_id)}
                            >
                              {expandedBriefJobs.has(item.job_id) ? t("feed.show_less") as string : t("feed.see_more") as string}
                            </button>
                          )}
                        </div>
                      )}

                      {/* ── Match reason ── */}
                      {item.matched_skills?.length > 0 && (
                        <p className="mt-2 text-[11px] text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 shrink-0" />
                          <span>
                            Matched: {item.matched_skills.slice(0, 3).join(", ")}
                            {item.matched_skills.length > 3 && ` và ${item.matched_skills.length - 3} kỹ năng khác`}
                          </span>
                        </p>
                      )}

                      {/* ── Tags ── */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.experience_level && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] capitalize bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                          >
                            {item.experience_level}
                          </Badge>
                        )}
                        {item.domain && (
                          <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500/20">
                            {item.domain}
                          </Badge>
                        )}
                        {item.work_mode && (
                          <Badge variant="secondary" className="text-[10px] capitalize bg-muted/60 border border-border/60 text-muted-foreground hover:bg-muted/60">
                            {item.work_mode}
                          </Badge>
                        )}
                        {item.employment_type && (
                          <Badge variant="secondary" className="text-[10px] capitalize bg-muted/60 border border-border/60 text-muted-foreground hover:bg-muted/60">
                            {item.employment_type}
                          </Badge>
                        )}
                        {(item.salary_min > 0 || item.salary_max > 0) && (
                          <Badge
                            variant="secondary"
                            className="gap-0.5 text-[10px] bg-muted/60 border border-border/60 text-muted-foreground hover:bg-muted/60"
                          >
                            <DollarSign className="h-2.5 w-2.5" />
                            {formatSalary(item.salary_min)} – {formatSalary(item.salary_max)}
                          </Badge>
                        )}
                        {item.required_skills?.slice(0, 4).map((s) => (
                          <Badge
                            key={s.name}
                            variant="outline"
                            className="text-[10px] font-mono border-border text-muted-foreground rounded-md"
                          >
                            {s.name}
                          </Badge>
                        ))}
                        {item.required_skills?.length > 4 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-border text-muted-foreground/80 rounded-md"
                          >
                            +{item.required_skills.length - 4} more
                          </Badge>
                        )}
                      </div>

                      {item.end_date && (() => {
                        const dl = deadlineCountdown(item.end_date);
                        return (
                          <p className={cn(
                            "mt-2 text-[10px] font-semibold",
                            dl.urgent ? "text-rose-500 animate-pulse" : "text-muted-foreground"
                          )}>
                            {dl.text}
                          </p>
                        );
                      })()}
                    </div>

                    {/* ── Action bar ── */}
                    <div className="flex items-center justify-between border-t border-border mt-4 px-2 py-1.5 relative z-10">
                      <div className="flex">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all cursor-pointer"
                          onClick={() => void openDetail(item)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">{t("feed.details") as string}</span>
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-all cursor-pointer",
                            alreadySaved
                              ? "text-emerald-500 hover:bg-emerald-500/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                          )}
                          onClick={() => void track(item.job_id, "click")}
                        >
                          <Bookmark className={cn("h-4 w-4", alreadySaved && "fill-emerald-500")} />
                          <span className="hidden sm:inline">{alreadySaved ? t("feed.saved") as string : t("feed.save") as string}</span>
                        </button>
                        {item.external_link && (
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-all cursor-pointer"
                            onClick={() => handleExternalLinkClick(item.job_id, item.external_link)}
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="hidden sm:inline">{t("feed.link") as string}</span>
                          </button>
                        )}
                      </div>

                      {alreadyApplied ? (
                        <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span>{t("feed.applied") as string}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white dark:text-zinc-950 text-xs font-semibold px-4 py-1.5 transition-all cursor-pointer active:scale-[0.97] shadow-sm shadow-emerald-500/10"
                          onClick={() => openApplyDialog(item.job_id, item.job_title)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {t("feed.apply") as string}
                        </button>
                      )}
                    </div>
                  </div>
                  </TiltCard>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Job Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>
              {detailFeed?.job_title ?? "Job Details"}
            </SheetTitle>
            <SheetDescription>
              {detailFeed
                ? `${detailFeed.company || `Job #${detailFeed.job_id}`} • ${(detailFeed.score * 100).toFixed(0)}% match`
                : "Loading…"}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-4">
            {detailLoading ? (
              <div className="space-y-6 py-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <div className="space-y-3">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-1/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            ) : detailJob && detailFeed ? (
              <div className="space-y-5 py-4">
                {/* Match score */}
                <Card className="border border-border ring-0 shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Your Match Score</p>
                      <AnimatedScore value={detailFeed.score * 100} className="text-2xl font-bold text-primary" />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      {[
                        { label: "Skill", value: detailFeed.skill_match },
                        { label: "Preference", value: detailFeed.preference_match },
                        { label: "Activity", value: detailFeed.activity_score },
                      ].map((s) => (
                        <div key={s.label} className="space-y-1">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{s.label}</span>
                            <AnimatedScore value={s.value * 100} className="font-medium text-foreground" />
                          </div>
                          <AnimatedProgress value={s.value * 100} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <Button 
                        variant="secondary" 
                        className="w-full text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20"
                        onClick={handleAnalyzeGap}
                        disabled={analyzingGap}
                      >
                        {analyzingGap ? (
                          <><BrainCircuit className="mr-2 h-4 w-4 animate-pulse" /> {t("gap.analyzing")}</>
                        ) : (
                          <><BrainCircuit className="mr-2 h-4 w-4" /> {t("gap.analyze_btn")}</>
                        )}
                      </Button>
                      
                      {gapAnalysis && (
                        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                          {/* Matching Skills */}
                          <div className="space-y-2">
                            <h5 className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("gap.matching")}
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                              {gapAnalysis.matching_skills?.map((s: string) => (
                                <Badge key={s} variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px]">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          {/* Missing Skills */}
                          <div className="space-y-2">
                            <h5 className="text-xs font-semibold text-rose-500 flex items-center gap-1.5">
                              <ShieldAlert className="h-3 w-3" />
                              {t("gap.missing")}
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                              {gapAnalysis.missing_skills?.map((s: string) => (
                                <Badge key={s} variant="outline" className="text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10 text-[10px]">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          {/* Learning Path */}
                          <div className="space-y-2 bg-muted/40 p-3 rounded-lg border border-border/50">
                            <h5 className="text-xs font-semibold flex items-center gap-1.5">
                              <Sparkles className="h-3 w-3 text-indigo-500" />
                              {t("gap.learning_path")}
                            </h5>
                            <ol className="list-decimal list-outside ml-4 space-y-1">
                              {gapAnalysis.learning_path?.map((step: string, i: number) => (
                                <li key={i} className="text-[11px] text-muted-foreground pl-1 leading-relaxed">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Job info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Job Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Company" value={`${detailJob.company || "—"} ${detailJob.recruiter_verified ? "✓ Verified" : ""}`} />
                    <InfoRow icon={<User className="h-4 w-4" />} label="Recruiter" value={detailJob.recruiter_name} />
                    {detailJob.company_phone && (
                      <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={detailJob.company_phone} />
                    )}
                    {detailJob.company_website && (
                      <InfoRow
                        icon={<Globe className="h-4 w-4" />}
                        label="Website"
                        value={
                          <a
                            className="underline underline-offset-2 hover:text-foreground"
                            href={toWebsiteUrl(detailJob.company_website)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {detailJob.company_website}
                          </a>
                        }
                      />
                    )}
                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={detailJob.location || "—"} />
                    <InfoRow
                      icon={<Briefcase className="h-4 w-4" />}
                      label="Experience"
                      value={detailJob.experience_level}
                    />
                    <InfoRow
                      icon={<DollarSign className="h-4 w-4" />}
                      label="Salary"
                      value={
                        detailJob.salary_min || detailJob.salary_max
                          ? `${formatSalary(detailJob.salary_min)} – ${formatSalary(detailJob.salary_max)}`
                          : "—"
                      }
                    />
                    {detailJob.domain && (
                      <InfoRow icon={<Layers className="h-4 w-4" />} label="Domain" value={detailJob.domain} />
                    )}
                    {detailJob.work_mode && (
                      <InfoRow icon={<Monitor className="h-4 w-4" />} label="Work Mode" value={detailJob.work_mode} />
                    )}
                    {detailJob.employment_type && (
                      <InfoRow icon={<Clock className="h-4 w-4" />} label="Type" value={detailJob.employment_type} />
                    )}
                    <InfoRow
                      icon={<Users className="h-4 w-4" />}
                      label="Candidates"
                      value={`${detailJob.match_count} matched`}
                    />
                    {detailJob.start_date && (
                      <InfoRow
                        icon={<Calendar className="h-4 w-4" />}
                        label="Start"
                        value={new Date(detailJob.start_date).toLocaleDateString()}
                      />
                    )}
                    {detailJob.end_date && (
                      <InfoRow
                        icon={<Calendar className="h-4 w-4" />}
                        label="Deadline"
                        value={new Date(detailJob.end_date).toLocaleDateString()}
                      />
                    )}
                  </div>
                </div>

                <Separator />

                {detailJob.recruiter_id && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/recruiter/public/${detailJob.recruiter_id}`}>
                      View Recruiter Profile
                    </Link>
                  </Button>
                )}

                <Separator />

                {detailJob.brief_description && (
                  <>
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Brief Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{detailJob.brief_description}</p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Required skills */}
                {detailJob.required_skills.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Required Skills</h4>
                    <div className="space-y-2">
                      {detailJob.required_skills.map((s) => (
                        <div
                          key={s.name}
                          className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                        >
                          <span className="text-sm font-medium capitalize">
                            {s.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            Lv.{s.level} {LEVEL_LABELS[s.level] ?? ""}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant={savedJobs.has(detailJob.id) ? "secondary" : "outline"}
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => void track(detailJob.id, "click")}
                  >
                    <Bookmark className="h-4 w-4" />
                    {savedJobs.has(detailJob.id) ? "Saved" : "Save Job"}
                  </Button>
                  {detailJob.external_link && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs text-blue-500 border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                      onClick={() => handleExternalLinkClick(detailJob.id, detailJob.external_link)}
                    >
                      <ExternalLink className="h-4 w-4" /> Job Link
                    </Button>
                  )}
                  {appliedJobs.has(detailJob.id) ? (
                    <Button disabled className="flex-1 gap-1.5 text-xs">
                      <CheckCircle2 className="h-4 w-4" /> Applied
                    </Button>
                  ) : (
                    <Button
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => openApplyDialog(detailJob.id, detailJob.title)}
                    >
                      <Send className="h-4 w-4" /> Apply Now
                    </Button>
                  )}
                </div>

                {detailJob.created_at && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Posted on{" "}
                    {new Date(detailJob.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
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

      {/* Apply Dialog */}
      <AlertDialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply for {applyJobTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              Add an optional cover letter or note to your application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cover-letter">Cover Letter (optional)</Label>
            <textarea
              id="cover-letter"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Why are you a good fit for this role?"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitApplication} disabled={applying}>
              {applying ? "Submitting…" : "Submit Application"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
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
