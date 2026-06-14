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
  CalendarDays,
  MessageCircle,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { ChatBox } from "@/components/chat-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  domain: string;
  work_mode: string;
  employment_type: string;
  cover_letter: string;
  status: string;
  score: number | null;
  unread_messages_count: number;
  created_at: string | null;
};

const STATUS_CFG: Record<
  string,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", icon: <Clock className="h-3.5 w-3.5" />, variant: "secondary" },
  ACCEPTED: { label: "Accepted", icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: "default" },
  INTERVIEWING: { label: "Interviewing", icon: <CalendarDays className="h-3.5 w-3.5" />, variant: "default" },
  REJECTED: { label: "Rejected", icon: <XCircle className="h-3.5 w-3.5" />, variant: "destructive" },
  WITHDRAWN: { label: "Withdrawn", icon: <AlertCircle className="h-3.5 w-3.5" />, variant: "outline" },
};

type FilterStatus = "ALL" | "PENDING" | "ACCEPTED" | "INTERVIEWING" | "REJECTED" | "WITHDRAWN";

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
  const [schedulingApp, setSchedulingApp] = useState<number | null>(null);
  const [chatApp, setChatApp] = useState<number | null>(null);
  const [interviewData, setInterviewData] = useState({
    date: "",
    time: "",
    location_type: "ONLINE",
    location_details: "",
    notes: ""
  });

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
    const interval = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

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
  async function scheduleInterview() {
    if (!schedulingApp || !interviewData.date || !interviewData.time || !interviewData.location_details) {
      toastError("Please fill in all required fields.");
      return;
    }
    
    try {
      const scheduled_time = new Date(`${interviewData.date}T${interviewData.time}`).toISOString();
      await apiRequest("/interviews", {
        method: "POST",
        session,
        body: {
          application_id: schedulingApp,
          scheduled_time,
          location_type: interviewData.location_type,
          location_details: interviewData.location_details,
          notes: interviewData.notes
        },
      });
      toastSuccess("Interview scheduled and candidate notified!");
      setApps((prev) => prev.map((a) => (a.id === schedulingApp ? { ...a, status: "INTERVIEWING" } : a)));
      setSchedulingApp(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to schedule interview.");
    }
  }
  const filtered = filter === "ALL" ? apps : apps.filter((a) => a.status === filter);
  const pending = apps.filter((a) => a.status === "PENDING").length;
  const accepted = apps.filter((a) => a.status === "ACCEPTED").length;
  const interviewing = apps.filter((a) => a.status === "INTERVIEWING").length;
  const rejected = apps.filter((a) => a.status === "REJECTED").length;

  const filters: { key: FilterStatus; label: string; count?: number }[] = [
    { key: "ALL", label: "All", count: apps.length },
    { key: "PENDING", label: "Pending", count: pending },
    { key: "ACCEPTED", label: "Accepted", count: accepted },
    { key: "INTERVIEWING", label: "Interviewing", count: interviewing },
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
                      {app.domain && (
                        <Badge variant="outline" className="text-[10px]">
                          {app.domain}
                        </Badge>
                      )}
                      {app.work_mode && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {app.work_mode}
                        </Badge>
                      )}
                      {app.employment_type && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {app.employment_type}
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
                      {(app.status === "ACCEPTED" || app.status === "INTERVIEWING") && (
                        <div className="flex gap-2">
                          {app.status === "ACCEPTED" && (
                            <Button
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => setSchedulingApp(app.id)}
                            >
                              <CalendarDays className="h-3.5 w-3.5" /> Schedule Interview
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 relative"
                            onClick={() => setChatApp(app.id)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> Message
                            {app.unread_messages_count > 0 && (
                              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
                                {app.unread_messages_count}
                              </span>
                            )}
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

      {/* Schedule Interview Modal */}
      <Dialog open={schedulingApp !== null} onOpenChange={(o) => !o && setSchedulingApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={interviewData.date} onChange={(e) => setInterviewData({...interviewData, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={interviewData.time} onChange={(e) => setInterviewData({...interviewData, time: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location Type</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={interviewData.location_type} 
                onChange={(e) => setInterviewData({...interviewData, location_type: e.target.value})}
              >
                <option value="ONLINE">Online (Video Call)</option>
                <option value="OFFLINE">Offline (In-person)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Details (Meet Link or Address)</Label>
              <Input 
                placeholder={interviewData.location_type === "ONLINE" ? "e.g. https://meet.google.com/..." : "123 Main St..."} 
                value={interviewData.location_details} 
                onChange={(e) => setInterviewData({...interviewData, location_details: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Notes for Candidate (Optional)</Label>
              <Textarea 
                placeholder="Any instructions before the interview?"
                value={interviewData.notes}
                onChange={(e) => setInterviewData({...interviewData, notes: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulingApp(null)}>Cancel</Button>
            <Button onClick={scheduleInterview}>Schedule & Notify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Chat Box */}
      {(() => {
        const chatApplication = apps.find(a => a.id === chatApp);
        if (!chatApplication) return null;
        return (
          <div className="fixed bottom-0 right-4 sm:right-20 z-[100] animate-in slide-in-from-bottom-5">
            <ChatBox 
              applicationId={chatApplication.id} 
              currentUserId={session.userId} 
              session={session} 
              recipientName={chatApplication.candidate_name}
              onClose={() => setChatApp(null)}
              className="w-[330px] h-[450px] sm:w-[350px] sm:h-[460px] border-b-0 rounded-b-none"
            />
          </div>
        );
      })()}
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
