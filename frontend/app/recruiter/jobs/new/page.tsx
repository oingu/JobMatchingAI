"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Briefcase,
  MapPin,
  DollarSign,
  Users,
  Calendar,
  Clock,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

interface SkillEntry {
  name: string;
  level: number;
}

interface JobItem {
  id: number;
  title: string;
  brief_description: string;
  required_skills: { name: string; level: number }[];
  location: string;
  salary_min: number;
  salary_max: number;
  experience_level: string;
  start_date: string | null;
  end_date: string | null;
  external_link: string;
  created_at: string | null;
  match_count: number;
  status: "active" | "scheduled" | "expired";
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  expired: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const BRIEF_PREVIEW_LIMIT = 180;

export default function MyPostsPage() {
  return (
    <RoleGuard allowedRole="recruiter">
      {(session) => <MyPostsContent session={session} />}
    </RoleGuard>
  );
}

function MyPostsContent({ session }: { session: SessionData }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editJob, setEditJob] = useState<JobItem | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [applicantsJobId, setApplicantsJobId] = useState<number | null>(null);
  const [applicantsJobTitle, setApplicantsJobTitle] = useState("");
  const [applicantsOpen, setApplicantsOpen] = useState(false);
  const [expandedBriefJobs, setExpandedBriefJobs] = useState<Set<number>>(new Set());

  const fetchJobs = useCallback(async () => {
    try {
      const res = await apiRequest<JobItem[]>("/jobs/mine", { session });
      setJobs(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  async function handleDelete() {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await apiRequest(`/jobs/${deleteId}`, { method: "DELETE", session });
      setJobs((prev) => prev.filter((j) => j.id !== deleteId));
      toastSuccess("Job post deleted successfully.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to delete job.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  function onJobCreated() {
    setSheetOpen(false);
    fetchJobs();
  }

  const activeCount = jobs.filter((j) => j.status === "active").length;
  const scheduledCount = jobs.filter((j) => j.status === "scheduled").length;
  const expiredCount = jobs.filter((j) => j.status === "expired").length;

  function toggleBrief(jobId: number) {
    setExpandedBriefJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  return (
    <AppShell role="recruiter" title="My Posts">
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{scheduledCount}</p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <Calendar className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{expiredCount}</p>
              <p className="text-xs text-muted-foreground">Expired</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header + action */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">
          All Posts ({jobs.length})
        </h2>
        <Button onClick={() => setSheetOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Post a Job
        </Button>
      </div>

      {/* Job list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">No posts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click &quot;Post a Job&quot; to create your first listing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{job.title}</p>
                      <Badge
                        className={`text-[10px] capitalize ${STATUS_STYLES[job.status]}`}
                      >
                        {job.status}
                      </Badge>
                    </div>
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

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {job.location}
                        </span>
                      )}
                      {(job.salary_min > 0 || job.salary_max > 0) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {job.salary_min.toLocaleString()} –{" "}
                          {job.salary_max.toLocaleString()}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {job.experience_level}
                      </Badge>
                    </div>

                    {/* Dates row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {job.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Start:{" "}
                          {new Date(job.start_date).toLocaleDateString()}
                        </span>
                      )}
                      {job.end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          End: {new Date(job.end_date).toLocaleDateString()}
                        </span>
                      )}
                      {job.created_at && (
                        <span>
                          Created:{" "}
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Skills */}
                    {job.required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
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
                  </div>

                  {/* Right side: match count + delete */}
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      <Users className="h-3 w-3" />
                      {job.match_count} matches
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => {
                        setApplicantsJobId(job.id);
                        setApplicantsJobTitle(job.title);
                        setApplicantsOpen(true);
                      }}
                    >
                      <Users className="h-3 w-3" /> Applicants
                    </Button>
                    <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => {
                        setEditJob(job);
                        setEditSheetOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog
                      open={deleteId === job.id}
                      onOpenChange={(open) => {
                        if (!open) setDeleteId(null);
                      }}
                    >
                      <AlertDialogPrimitive.Trigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          />
                        }
                        onClick={() => setDeleteId(job.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </AlertDialogPrimitive.Trigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{job.title}&quot; and all associated
                            recommendations will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            {deleting ? "Deleting…" : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Job Sheet (modal) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Post a New Job</SheetTitle>
            <SheetDescription>
              Fill in the details below. The system will start matching
              candidates once the start date arrives.
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1 px-4">
            <CreateJobForm session={session} onSuccess={onJobCreated} />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Edit Job Sheet (modal) */}
      <Sheet
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) setEditJob(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Edit Job Post</SheetTitle>
            <SheetDescription>
              Update the job details. Matching will be re-triggered for this job.
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1 px-4">
            {editJob && (
              <EditJobForm
                session={session}
                job={editJob}
                onSuccess={() => {
                  setEditSheetOpen(false);
                  setEditJob(null);
                  fetchJobs();
                }}
              />
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Applicants Sheet */}
      <Sheet
        open={applicantsOpen}
        onOpenChange={(open) => {
          setApplicantsOpen(open);
          if (!open) setApplicantsJobId(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Applicants — {applicantsJobTitle}</SheetTitle>
            <SheetDescription>
              Review candidates who applied for this position.
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1 px-4">
            {applicantsJobId && (
              <ApplicantsList
                session={session}
                jobId={applicantsJobId}
              />
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

/* ─── Applicants List ─── */

type ApplicantItem = {
  id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  skills: { name: string; level: number }[];
  experience_level: string;
  cover_letter: string;
  status: string;
  score: number | null;
  created_at: string | null;
};

function ApplicantsList({
  session,
  jobId,
}: {
  session: SessionData;
  jobId: number;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [applicants, setApplicants] = useState<ApplicantItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await apiRequest<ApplicantItem[]>(
        `/applications/job/${jobId}`,
        { session },
      );
      setApplicants(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function review(appId: number, status: "ACCEPTED" | "REJECTED") {
    try {
      await apiRequest(`/applications/${appId}/review`, {
        method: "PUT",
        session,
        body: { status },
      });
      toastSuccess(
        status === "ACCEPTED"
          ? "Candidate accepted!"
          : "Application rejected.",
      );
      setApplicants((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status } : a)),
      );
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Review failed.");
    }
  }

  if (loading)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading applicants…
      </p>
    );

  if (applicants.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Users className="h-8 w-8 opacity-40" />
        <p className="text-sm">No applications yet.</p>
      </div>
    );

  return (
    <div className="space-y-3 py-4">
      {applicants.map((app) => (
        <Card key={app.id} className="border border-border ring-0 shadow-none">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold">{app.candidate_name}</h4>
                <p className="text-xs text-muted-foreground">
                  {app.candidate_email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {app.score !== null && (
                  <Badge variant="outline" className="text-xs">
                    Match: {(app.score * 100).toFixed(0)}%
                  </Badge>
                )}
                <Badge
                  variant={
                    app.status === "ACCEPTED"
                      ? "default"
                      : app.status === "REJECTED"
                        ? "destructive"
                        : app.status === "WITHDRAWN"
                          ? "outline"
                          : "secondary"
                  }
                  className="text-xs"
                >
                  {app.status}
                </Badge>
              </div>
            </div>

            {app.experience_level && (
              <Badge variant="outline" className="text-xs capitalize">
                {app.experience_level}
              </Badge>
            )}

            {app.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {app.skills.map((s: { name: string; level: number }) => (
                  <Badge key={s.name} variant="outline" className="text-[10px]">
                    {s.name} Lv.{s.level}
                  </Badge>
                ))}
              </div>
            )}

            {app.cover_letter && (
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Cover Letter
                </p>
                <p className="text-sm">{app.cover_letter}</p>
              </div>
            )}

            {app.created_at && (
              <p className="text-[10px] text-muted-foreground">
                Applied {new Date(app.created_at).toLocaleDateString()}
              </p>
            )}

            {app.status === "PENDING" && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => review(app.id, "ACCEPTED")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1 gap-1"
                  onClick={() => review(app.id, "REJECTED")}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="w-full text-xs">
              <Link href={`/candidate/public/${app.candidate_id}`}>View Candidate Profile</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Create Job Form (inside Sheet) ─── */

function CreateJobForm({
  session,
  onSuccess,
}: {
  session: SessionData;
  onSuccess: () => void;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [title, setTitle] = useState("");
  const [briefDescription, setBriefDescription] = useState("");
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [location, setLocation] = useState("");
  const [salaryMin, setSalaryMin] = useState(0);
  const [salaryMax, setSalaryMax] = useState(0);
  const [experienceLevel, setExperienceLevel] = useState("junior");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [externalLink, setExternalLink] = useState("");

  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState(3);

  function addSkill() {
    const name = newSkillName.trim().toLowerCase();
    if (!name || skills.some((s) => s.name === name)) return;
    setSkills([...skills, { name, level: newSkillLevel }]);
    setNewSkillName("");
    setNewSkillLevel(3);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (skills.length === 0) {
      toastError("Add at least one required skill.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        recruiter_id: session.userId,
        title,
        brief_description: briefDescription,
        required_skills: skills,
        location,
        salary_min: salaryMin,
        salary_max: salaryMax,
        experience_level: experienceLevel,
        external_link: externalLink,
      };
      if (startDate) body.start_date = startDate.toISOString();
      if (endDate) body.end_date = endDate.toISOString();

      const res = await apiRequest<{
        job_id: number;
        event_id: number | null;
        scheduled: boolean;
      }>("/jobs", { method: "POST", session, body });

      const info = res.data.scheduled
        ? `Job #${res.data.job_id} created and scheduled.`
        : `Job #${res.data.job_id} created. Matching triggered.`;
      toastSuccess(info);
      setTimeout(() => onSuccess(), 800);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Create job failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 py-4">
      {/* Basic info */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="title">Job Title *</Label>
          <Input
            id="title"
            placeholder="e.g. Backend Developer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location *</Label>
          <Input
            id="location"
            placeholder="e.g. Hanoi, Remote"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brief-description">Brief Description</Label>
          <textarea
            id="brief-description"
            className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            placeholder="Describe key responsibilities, team, and expectations..."
            value={briefDescription}
            onChange={(e) => setBriefDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="external-link">External Job Link (Optional)</Label>
          <Input
            id="external-link"
            placeholder="e.g. https://company.com/careers/details"
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Salary Min</Label>
            <Input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Salary Max</Label>
            <Input
              type="number"
              value={salaryMax}
              onChange={(e) => setSalaryMax(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Experience Level</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
          >
            <option value="junior">Junior</option>
            <option value="middle">Middle</option>
            <option value="senior">Senior</option>
          </select>
        </div>

        {/* Date fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Select start date"
            />
            <p className="text-[11px] text-muted-foreground">
              When matching begins
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>End Date</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Select end date"
            />
            <p className="text-[11px] text-muted-foreground">
              When the post expires
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Skills */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Required Skills *</Label>

        {skills.length > 0 && (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2.5"
              >
                <span className="min-w-[80px] text-sm font-medium">
                  {skill.name}
                </span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={skill.level}
                  onChange={(e) =>
                    setSkills(
                      skills.map((s) =>
                        s.name === skill.name
                          ? { ...s, level: Number(e.target.value) }
                          : s,
                      ),
                    )
                  }
                  className="flex-1 accent-primary"
                />
                <Badge
                  variant="secondary"
                  className="min-w-[80px] justify-center text-[10px]"
                >
                  Lv.{skill.level} {LEVEL_LABELS[skill.level]}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    setSkills(skills.filter((s) => s.name !== skill.name))
                  }
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            placeholder="Skill name"
            onKeyDown={(e) =>
              e.key === "Enter" && (e.preventDefault(), addSkill())
            }
          />
          <select
            className="w-16 rounded-md border border-input bg-transparent px-1.5 text-sm"
            value={newSkillLevel}
            onChange={(e) => setNewSkillLevel(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                Lv.{l}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={addSkill}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      <Separator />

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Publishing…" : "Publish Job"}
      </Button>
    </form>
  );
}

/* ─── Edit Job Form (inside Sheet) ─── */

function EditJobForm({
  session,
  job,
  onSuccess,
}: {
  session: SessionData;
  job: JobItem;
  onSuccess: () => void;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [title, setTitle] = useState(job.title);
  const [briefDescription, setBriefDescription] = useState(job.brief_description || "");
  const [skills, setSkills] = useState<SkillEntry[]>(
    (job.required_skills || []).map((s: SkillEntry) => ({
      name: s.name,
      level: s.level ?? 3,
    })),
  );
  const [location, setLocation] = useState(job.location);
  const [salaryMin, setSalaryMin] = useState(job.salary_min);
  const [salaryMax, setSalaryMax] = useState(job.salary_max);
  const [experienceLevel, setExperienceLevel] = useState(
    job.experience_level || "junior",
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    job.start_date ? new Date(job.start_date) : undefined,
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    job.end_date ? new Date(job.end_date) : undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const [externalLink, setExternalLink] = useState(job.external_link || "");

  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState(3);

  function addSkill() {
    const name = newSkillName.trim().toLowerCase();
    if (!name || skills.some((s) => s.name === name)) return;
    setSkills([...skills, { name, level: newSkillLevel }]);
    setNewSkillName("");
    setNewSkillLevel(3);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (skills.length === 0) {
      toastError("Add at least one required skill.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title,
        brief_description: briefDescription,
        required_skills: skills,
        location,
        salary_min: salaryMin,
        salary_max: salaryMax,
        experience_level: experienceLevel,
        external_link: externalLink,
      };
      if (startDate) body.start_date = startDate.toISOString();
      if (endDate) body.end_date = endDate.toISOString();

      const res = await apiRequest<{
        job_id: number;
        event_id: number | null;
        rematched: boolean;
      }>(`/jobs/${job.id}`, { method: "PUT", session, body });

      const info = res.data.rematched
        ? `Job #${res.data.job_id} updated. Re-matching triggered.`
        : `Job #${res.data.job_id} updated and scheduled.`;
      toastSuccess(info);
      setTimeout(() => onSuccess(), 800);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Update job failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 py-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-title">Job Title *</Label>
          <Input
            id="edit-title"
            placeholder="e.g. Backend Developer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-location">Location *</Label>
          <Input
            id="edit-location"
            placeholder="e.g. Hanoi, Remote"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-brief-description">Brief Description</Label>
          <textarea
            id="edit-brief-description"
            className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            placeholder="Describe key responsibilities, team, and expectations..."
            value={briefDescription}
            onChange={(e) => setBriefDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-external-link">External Job Link (Optional)</Label>
          <Input
            id="edit-external-link"
            placeholder="e.g. https://company.com/careers/details"
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Salary Min</Label>
            <Input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Salary Max</Label>
            <Input
              type="number"
              value={salaryMax}
              onChange={(e) => setSalaryMax(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Experience Level</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
          >
            <option value="junior">Junior</option>
            <option value="middle">Middle</option>
            <option value="senior">Senior</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Select start date"
            />
            <p className="text-[11px] text-muted-foreground">
              When matching begins
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>End Date</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Select end date"
            />
            <p className="text-[11px] text-muted-foreground">
              When the post expires
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Required Skills *</Label>

        {skills.length > 0 && (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2.5"
              >
                <span className="min-w-[80px] text-sm font-medium">
                  {skill.name}
                </span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={skill.level}
                  onChange={(e) =>
                    setSkills(
                      skills.map((s) =>
                        s.name === skill.name
                          ? { ...s, level: Number(e.target.value) }
                          : s,
                      ),
                    )
                  }
                  className="flex-1 accent-primary"
                />
                <Badge
                  variant="secondary"
                  className="min-w-[80px] justify-center text-[10px]"
                >
                  Lv.{skill.level} {LEVEL_LABELS[skill.level]}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    setSkills(skills.filter((s) => s.name !== skill.name))
                  }
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            placeholder="Skill name"
            onKeyDown={(e) =>
              e.key === "Enter" && (e.preventDefault(), addSkill())
            }
          />
          <select
            className="w-16 rounded-md border border-input bg-transparent px-1.5 text-sm"
            value={newSkillLevel}
            onChange={(e) => setNewSkillLevel(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                Lv.{l}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={addSkill}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      <Separator />

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving…" : "Save Changes & Re-match"}
      </Button>
    </form>
  );
}
