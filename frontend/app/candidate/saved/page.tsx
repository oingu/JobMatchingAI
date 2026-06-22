"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  MapPin,
  DollarSign,
  Briefcase,
  Building2,
  Trash2,
  Eye,
  Send,
  CheckCircle2,
  Calendar,
  Users,
  User,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Globe,
  Layers,
  Monitor,
  Clock,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";
import { useUi } from "@/contexts/UiContext";
import { cn } from "@/lib/utils";

type SkillItem = { name: string; level: number };

type SavedJob = {
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
  company: string;
  company_avatar_url: string;
  company_phone: string;
  company_website: string;
  recruiter_verified: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  score: number | null;
  skill_match: number | null;
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
  match_count: number;
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};
const BRIEF_PREVIEW_LIMIT = 180;

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

export default function SavedJobsPage() {
  return (
    <RoleGuard allowedRole="candidate">
      {(session) => <SavedJobsContent session={session} />}
    </RoleGuard>
  );
}

function SavedJobsContent({ session }: { session: SessionData }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const { glassMode } = useUi();
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedJobs, setAppliedJobs] = useState<Set<number>>(new Set());

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<JobDetail | null>(null);
  const [detailSaved, setDetailSaved] = useState<SavedJob | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedBriefJobs, setExpandedBriefJobs] = useState<Set<number>>(new Set());

  const fetchSaved = useCallback(async () => {
    try {
      const res = await apiRequest<SavedJob[]>("/jobs/saved", { session });
      setJobs(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  async function track(jobId: number, eventType: "view" | "click" | "apply") {
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
      if (eventType === "apply") {
        setAppliedJobs((prev) => new Set(prev).add(jobId));
        toastSuccess("Application submitted successfully!");
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  async function openDetail(savedJob: SavedJob) {
    setDetailSaved(savedJob);
    setDetailOpen(true);
    setDetailLoading(true);
    void track(savedJob.id, "view");
    try {
      const res = await apiRequest<JobDetail>(`/jobs/${savedJob.id}`, {
        session,
      });
      setDetailJob(res.data);
    } catch {
      setDetailJob(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function unsave(jobId: number) {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    toastSuccess("Job removed from saved list.");
  }

  function toggleBrief(jobId: number) {
    setExpandedBriefJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  return (
    <AppShell role="candidate" title="Saved Jobs">
      <div className="w-full space-y-5">
        <div>
          <p className="text-sm font-medium">
            Your saved jobs ({jobs.length})
          </p>
          <p className="text-xs text-muted-foreground">
            Jobs you bookmarked from the feed
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
            <CardContent className="flex flex-col items-center gap-2 py-12">
              <Bookmark className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                No saved jobs yet
              </p>
              <p className="text-xs text-muted-foreground">
                Browse the Job Feed and click &quot;Save&quot; on jobs you are
                interested in.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card 
                key={job.id} 
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 hover:bg-accent/30 shadow-sm hover:shadow-md" : "bg-transparent hover:bg-accent/5 hover:border-primary/40 border border-border/40"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <h3
                          className="cursor-pointer font-semibold hover:text-primary hover:underline"
                          onClick={() => void openDetail(job)}
                        >
                          {job.title}
                        </h3>
                        {job.score !== null && (
                          <Badge variant="secondary" className="text-xs">
                            {(job.score * 100).toFixed(0)}% match
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarImage src={job.company_avatar_url || undefined} alt={job.company || "Company"} />
                          <AvatarFallback>
                            {(job.company || "C").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {job.recruiter_id ? (
                          <Link href={`/recruiter/public/${job.recruiter_id}`} className="underline underline-offset-2 hover:text-foreground">
                            {job.company || `Job #${job.id}`}
                          </Link>
                        ) : (
                          <span>{job.company || `Job #${job.id}`}</span>
                        )}
                        {job.recruiter_verified ? (
                          <Badge variant="default" className="gap-0.5 text-[9px] px-1.5 py-0">
                            <ShieldCheck className="h-2.5 w-2.5" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-0.5 text-[9px] px-1.5 py-0 text-amber-600 border-amber-300">
                            <ShieldAlert className="h-2.5 w-2.5" /> Unverified
                          </Badge>
                        )}
                        </p>
                      </div>
                      {(job.company_phone || job.company_website) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          {job.company_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{job.company_phone}</span>}
                          {job.company_website && (
                            <a
                              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
                              href={toWebsiteUrl(job.company_website)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Globe className="h-3 w-3" />
                              {job.company_website}
                            </a>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {job.location}
                          </span>
                        )}
                        {(job.salary_min > 0 || job.salary_max > 0) && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatSalary(job.salary_min)} –{" "}
                            {formatSalary(job.salary_max)}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {job.experience_level}
                        </Badge>
                        {job.domain && (
                          <Badge variant="outline" className="text-[10px]">
                            {job.domain}
                          </Badge>
                        )}
                        {job.work_mode && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {job.work_mode}
                          </Badge>
                        )}
                        {job.employment_type && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {job.employment_type}
                          </Badge>
                        )}
                        {job.created_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Posted {new Date(job.created_at).toLocaleDateString()}
                          </span>
                        )}
                        {job.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Start {new Date(job.start_date).toLocaleDateString()}
                          </span>
                        )}
                        {job.end_date && (
                          <span className="flex items-center gap-1 font-medium text-orange-600">
                            <Calendar className="h-3 w-3" />
                            Deadline {new Date(job.end_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {job.required_skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {job.required_skills.map((s) => (
                            <Badge
                              key={s.name}
                              variant="outline"
                              className="text-xs"
                            >
                              {s.name}{" "}
                              <span className="ml-1 text-muted-foreground">
                                Lv.{s.level}
                              </span>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {job.brief_description && (
                        <div className="text-sm text-muted-foreground">
                          <p>
                            {expandedBriefJobs.has(job.id) || job.brief_description.length <= BRIEF_PREVIEW_LIMIT
                              ? job.brief_description
                              : `${job.brief_description.slice(0, BRIEF_PREVIEW_LIMIT)}...`}
                          </p>
                          {job.brief_description.length > BRIEF_PREVIEW_LIMIT && (
                            <button
                              type="button"
                              className="mt-1 text-xs font-medium text-primary hover:underline"
                              onClick={() => toggleBrief(job.id)}
                            >
                              {expandedBriefJobs.has(job.id) ? "Show less" : "Read more"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => void openDetail(job)}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      {appliedJobs.has(job.id) ? (
                        <Button
                          size="sm"
                          disabled
                          className="gap-1 text-xs opacity-100"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Applied
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => void track(job.id, "apply")}
                        >
                          <Send className="h-3.5 w-3.5" /> Apply
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => unsave(job.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Job Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>{detailSaved?.title ?? "Job Details"}</SheetTitle>
            <SheetDescription>
              {detailSaved
                ? `${detailSaved.company || `Job #${detailSaved.id}`}${detailSaved.score !== null ? ` • ${(detailSaved.score * 100).toFixed(0)}% match` : ""}`
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
                {/* Match score */}
                {detailSaved?.score !== null && detailSaved?.score !== undefined && (
                  <Card>
                    <CardContent className="flex items-center justify-between p-4">
                      <p className="text-sm font-medium">Your Match Score</p>
                      <p className="text-2xl font-bold text-primary">
                        {(detailSaved.score * 100).toFixed(0)}%
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Job info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Job Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow
                      icon={<Building2 className="h-4 w-4" />}
                      label="Company"
                      value={detailJob.company || "—"}
                    />
                    <InfoRow
                      icon={<User className="h-4 w-4" />}
                      label="Recruiter"
                      value={detailJob.recruiter_name}
                    />
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
                    <InfoRow
                      icon={<MapPin className="h-4 w-4" />}
                      label="Location"
                      value={detailJob.location || "—"}
                    />
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
                        value={new Date(
                          detailJob.start_date,
                        ).toLocaleDateString()}
                      />
                    )}
                    {detailJob.end_date && (
                      <InfoRow
                        icon={<Calendar className="h-4 w-4" />}
                        label="Deadline"
                        value={new Date(
                          detailJob.end_date,
                        ).toLocaleDateString()}
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
                      <p className="text-sm text-muted-foreground">{detailJob.brief_description}</p>
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
                  {appliedJobs.has(detailJob.id) ? (
                    <Button disabled className="flex-1 gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Applied
                    </Button>
                  ) : (
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={() => void track(detailJob.id, "apply")}
                    >
                      <Send className="h-4 w-4" /> Apply Now
                    </Button>
                  )}
                </div>

                {detailJob.created_at && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Posted on{" "}
                    {new Date(detailJob.created_at).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "long", day: "numeric" },
                    )}
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
