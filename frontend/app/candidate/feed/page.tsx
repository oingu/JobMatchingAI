"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  DollarSign,
  Briefcase,
  Eye,
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
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  required_skills: SkillItem[];
  company: string;
  company_avatar_url: string;
  company_phone: string;
  company_website: string;
  recruiter_verified: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
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
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};
const BRIEF_PREVIEW_LIMIT = 180;

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

export default function CandidateFeedPage() {
  return (
    <RoleGuard allowedRole="candidate">
      {(session) => <CandidateFeedContent session={session} />}
    </RoleGuard>
  );
}

function CandidateFeedContent({ session }: { session: SessionData }) {
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
  }

  return (
    <AppShell role="candidate" title="Job Feed">
      <div className="w-full space-y-5">
        {/* Top-K selector */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Top matching jobs for you</p>
            <p className="text-xs text-muted-foreground">
              Ranked by skill match, preferences, and activity
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">
              Show top
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
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12">
              <Briefcase className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                No recommendations yet
              </p>
              <p className="text-xs text-muted-foreground">
                Update your profile or upload a CV to get matched.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <Card key={`${item.job_id}-${idx}`} className="overflow-hidden py-0">
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Rank badge */}
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center border-r bg-muted/50">
                      <span className="text-lg font-bold">{idx + 1}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        rank
                      </span>
                    </div>

                    <div className="flex-1 p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2.5">
                          <h3
                            className="cursor-pointer font-semibold hover:text-primary hover:underline"
                            onClick={() => void openDetail(item)}
                          >
                            {item.job_title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarImage src={item.company_avatar_url || undefined} alt={item.company || "Company"} />
                              <AvatarFallback>
                                {(item.company || "C").slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            {item.recruiter_id ? (
                              <Link href={`/recruiter/public/${item.recruiter_id}`} className="underline underline-offset-2 hover:text-foreground">
                                {item.company || `Job #${item.job_id}`}
                              </Link>
                            ) : (
                              <span>{item.company || `Job #${item.job_id}`}</span>
                            )}
                            {item.recruiter_verified ? (
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
                          {(item.company_phone || item.company_website) && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                              {item.company_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{item.company_phone}</span>}
                              {item.company_website && (
                                <a
                                  className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
                                  href={toWebsiteUrl(item.company_website)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Globe className="h-3 w-3" />
                                  {item.company_website}
                                </a>
                              )}
                            </div>
                          )}
                          {item.brief_description && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              <p>
                                {expandedBriefJobs.has(item.job_id) || item.brief_description.length <= BRIEF_PREVIEW_LIMIT
                                  ? item.brief_description
                                  : `${item.brief_description.slice(0, BRIEF_PREVIEW_LIMIT)}...`}
                              </p>
                              {item.brief_description.length > BRIEF_PREVIEW_LIMIT && (
                                <button
                                  type="button"
                                  className="mt-1 text-xs font-medium text-primary hover:underline"
                                  onClick={() => toggleBrief(item.job_id)}
                                >
                                  {expandedBriefJobs.has(item.job_id) ? "Show less" : "Read more"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">
                            {(item.score * 100).toFixed(0)}%
                          </p>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            match
                          </p>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="mt-3.5 flex flex-wrap gap-1.5">
                        {item.location && (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-xs capitalize"
                          >
                            <MapPin className="h-3 w-3" /> {item.location}
                          </Badge>
                        )}
                        {item.experience_level && (
                          <Badge
                            variant="secondary"
                            className="text-xs capitalize"
                          >
                            {item.experience_level}
                          </Badge>
                        )}
                        {(item.salary_min > 0 || item.salary_max > 0) && (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-xs"
                          >
                            <DollarSign className="h-3 w-3" />
                            {formatSalary(item.salary_min)} –{" "}
                            {formatSalary(item.salary_max)}
                          </Badge>
                        )}
                      </div>

                      {/* Dates */}
                      {(item.created_at || item.start_date || item.end_date) && (
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                          {item.created_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Posted {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          )}
                          {item.start_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Start {new Date(item.start_date).toLocaleDateString()}
                            </span>
                          )}
                          {item.end_date && (
                            <span className="flex items-center gap-1 font-medium text-orange-600">
                              <Calendar className="h-3 w-3" />
                              Deadline {new Date(item.end_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Required skills */}
                      {item.required_skills?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {item.required_skills.map((s) => (
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

                      {/* Score breakdown */}
                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                        {[
                          { label: "Skill", value: item.skill_match },
                          { label: "Preference", value: item.preference_match },
                          { label: "Activity", value: item.activity_score },
                        ].map((s) => (
                          <div key={s.label} className="space-y-1">
                            <div className="flex justify-between text-muted-foreground">
                              <span>{s.label}</span>
                              <span className="font-medium text-foreground">
                                {(s.value * 100).toFixed(0)}%
                              </span>
                            </div>
                            <Progress value={s.value * 100} className="h-1.5" />
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex gap-2 border-t pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => void openDetail(item)}
                        >
                          <Eye className="h-3.5 w-3.5" /> View Details
                        </Button>
                        <Button
                          variant={savedJobs.has(item.job_id) ? "secondary" : "outline"}
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => void track(item.job_id, "click")}
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          {savedJobs.has(item.job_id) ? "Saved" : "Save"}
                        </Button>
                        {appliedJobs.has(item.job_id) ? (
                          <Button
                            size="sm"
                            disabled
                            className="gap-1 text-xs opacity-100"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Applied
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => openApplyDialog(item.job_id, item.job_title)}
                          >
                            <Send className="h-3.5 w-3.5" /> Apply
                          </Button>
                        )}
                      </div>
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
            <SheetTitle>
              {detailFeed?.job_title ?? "Job Details"}
            </SheetTitle>
            <SheetDescription>
              {detailFeed
                ? `${detailFeed.company || `Job #${detailFeed.job_id}`} • ${(detailFeed.score * 100).toFixed(0)}% match`
                : "Loading…"}
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1 px-4">
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
              </div>
            ) : detailJob && detailFeed ? (
              <div className="space-y-5 py-4">
                {/* Match score */}
                <Card className="border border-border ring-0 shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Your Match Score</p>
                      <p className="text-2xl font-bold text-primary">
                        {(detailFeed.score * 100).toFixed(0)}%
                      </p>
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
                            <span className="font-medium text-foreground">
                              {(s.value * 100).toFixed(0)}%
                            </span>
                          </div>
                          <Progress value={s.value * 100} className="h-1.5" />
                        </div>
                      ))}
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
                  <Button
                    variant={savedJobs.has(detailJob.id) ? "secondary" : "outline"}
                    className="flex-1 gap-1.5"
                    onClick={() => void track(detailJob.id, "click")}
                  >
                    <Bookmark className="h-4 w-4" />
                    {savedJobs.has(detailJob.id) ? "Saved" : "Save Job"}
                  </Button>
                  {appliedJobs.has(detailJob.id) ? (
                    <Button disabled className="flex-1 gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Applied
                    </Button>
                  ) : (
                    <Button
                      className="flex-1 gap-1.5"
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
