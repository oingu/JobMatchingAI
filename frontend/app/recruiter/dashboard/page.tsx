"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Mail, Phone, Target, User, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type Rec = {
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  candidate_dob: string;
  skills: { name: string; level: number }[];
  experience_level: string;
  skill_match: number;
  preference_match: number;
  activity_score: number;
  final_score: number;
};

type DashboardRow = {
  job_id: number;
  title: string;
  recommendations: Rec[];
};

export default function RecruiterDashboardPage() {
  return (
    <RoleGuard allowedRole="recruiter">
      {(session) => <RecruiterDashboardContent session={session} />}
    </RoleGuard>
  );
}

function RecruiterDashboardContent({ session }: { session: SessionData }) {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topK, setTopK] = useState(20);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<{ jobTitle: string; rec: Rec } | null>(null);

  async function loadData() {
    setError("");
    setLoading(true);
    try {
      const res = await apiRequest<{ recruiter_id: number; jobs: DashboardRow[] }>(
        `/dashboard/recruiter/${session.userId}?limit=20&top_k=${topK}`,
        { session },
      );
      setRows(res.data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load dashboard failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topK]);

  function openCandidateDetail(jobTitle: string, rec: Rec) {
    setSelected({ jobTitle, rec });
    setDetailOpen(true);
  }

  return (
    <AppShell role="recruiter" title="Dashboard">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Jobs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{rows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {rows.reduce((sum, r) => sum + r.recommendations.length, 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {(() => {
                  const all = rows.flatMap((r) => r.recommendations.map((c) => c.final_score));
                  return all.length > 0 ? (all.reduce((a, b) => a + b, 0) / all.length * 100).toFixed(0) + "%" : "—";
                })()}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Display top matching candidates per job
          </p>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20, 50].map((k) => (
              <Button
                key={k}
                size="sm"
                variant={topK === k ? "default" : "outline"}
                onClick={() => setTopK(k)}
              >
                Top {k}
              </Button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-sm font-medium text-muted-foreground">No jobs posted yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Post your first job to start receiving candidate matches.</p>
            </CardContent>
          </Card>
        ) : (
          rows.map((job) => (
            <Card key={job.job_id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{job.title}</CardTitle>
                  <Badge variant="outline">
                    {job.recommendations.length} candidate{job.recommendations.length !== 1 && "s"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {job.recommendations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching candidates found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Skills</TableHead>
                        <TableHead>Skill</TableHead>
                        <TableHead>Pref</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {job.recommendations.map((rec, idx) => (
                        <TableRow key={`${job.job_id}-${rec.candidate_id}`}>
                          <TableCell>
                            <Badge variant={idx === 0 ? "default" : "secondary"} className="text-xs">
                              #{idx + 1}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="font-medium text-sm text-left hover:text-primary hover:underline"
                              onClick={() => openCandidateDetail(job.title, rec)}
                            >
                              {rec.candidate_name || `Candidate ${rec.candidate_id}`}
                            </button>
                            <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                              {rec.candidate_email && <span>{rec.candidate_email}</span>}
                              {rec.candidate_phone && <span>📞 {rec.candidate_phone}</span>}
                              {rec.candidate_dob && <span>🎂 {rec.candidate_dob}</span>}
                            </div>
                            {rec.experience_level && (
                              <Badge variant="outline" className="mt-1 text-[10px] capitalize">{rec.experience_level}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(rec.skills ?? []).slice(0, 4).map((s) => (
                                <Badge key={s.name} variant="secondary" className="text-[10px]">
                                  {s.name} Lv.{s.level}
                                </Badge>
                              ))}
                              {(rec.skills ?? []).length > 4 && (
                                <Badge variant="outline" className="text-[10px]">+{rec.skills.length - 4}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={rec.skill_match * 100} className="h-2 w-14" />
                              <span className="text-xs text-muted-foreground">{(rec.skill_match * 100).toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={rec.preference_match * 100} className="h-2 w-14" />
                              <span className="text-xs text-muted-foreground">{(rec.preference_match * 100).toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-bold">{(rec.final_score * 100).toFixed(0)}%</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:w-1/2 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>{selected?.rec.candidate_name || "Candidate Detail"}</SheetTitle>
            <SheetDescription>
              {selected
                ? `${selected.jobTitle} • ${(selected.rec.final_score * 100).toFixed(0)}% match`
                : "Candidate matching detail"}
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1 px-4">
            {selected && (
              <div className="space-y-5 py-4">
                <Card className="border border-border ring-0 shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Match Score</p>
                      <p className="text-2xl font-bold text-primary">
                        {(selected.rec.final_score * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      {[
                        { label: "Skill", value: selected.rec.skill_match },
                        { label: "Preference", value: selected.rec.preference_match },
                        { label: "Activity", value: selected.rec.activity_score },
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

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Candidate Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem icon={<User className="h-4 w-4" />} label="Name" value={selected.rec.candidate_name || "—"} />
                    <DetailItem icon={<Mail className="h-4 w-4" />} label="Email" value={selected.rec.candidate_email || "—"} />
                    <DetailItem icon={<Phone className="h-4 w-4" />} label="Phone" value={selected.rec.candidate_phone || "—"} />
                    <DetailItem icon={<Calendar className="h-4 w-4" />} label="DOB" value={selected.rec.candidate_dob || "—"} />
                    <DetailItem icon={<Target className="h-4 w-4" />} label="Experience" value={selected.rec.experience_level || "—"} />
                    <DetailItem icon={<Users className="h-4 w-4" />} label="Candidate ID" value={String(selected.rec.candidate_id)} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Skills</h4>
                  {selected.rec.skills.length > 0 ? (
                    <div className="space-y-2">
                      {selected.rec.skills.map((s) => (
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
                  ) : (
                    <p className="text-sm text-muted-foreground">No skills provided.</p>
                  )}
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/candidate/public/${selected.rec.candidate_id}`}>
                    View Full Candidate Profile
                  </Link>
                </Button>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
