"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Video, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";
import { useUi } from "@/contexts/UiContext";
import { cn } from "@/lib/utils";

type InterviewItem = {
  id: number;
  job_title: string;
  company_name: string;
  scheduled_time: string;
  location_type: string;
  location_details: string;
  status: string;
  notes: string;
};

export default function CandidateInterviewsPage() {
  return (
    <RoleGuard allowedRole="candidate">
      {(session) => <Content session={session} />}
    </RoleGuard>
  );
}

function Content({ session }: { session: SessionData }) {
  const { glassMode } = useUi();
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<InterviewItem[]>("/interviews/candidate", { session });
        setInterviews(res.data);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [session]);

  return (
    <AppShell role="candidate" title="My Interviews">
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading interviews…</p>
      ) : interviews.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <CalendarDays className="h-10 w-10 opacity-40" />
          <p className="text-sm">You have no scheduled interviews yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview) => (
            <Card 
              key={interview.id}
              className={cn(
                "transition-all duration-300 shadow-sm",
                glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 hover:bg-accent/30 hover:shadow-md" : "bg-transparent hover:bg-accent/5 hover:border-primary/40 border border-border/40"
              )}
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{interview.job_title}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> {interview.company_name}
                      </p>
                    </div>
                    <Badge variant={interview.status === "SCHEDULED" ? "default" : "secondary"}>
                      {interview.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {new Date(interview.scheduled_time).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {interview.location_type === "ONLINE" ? (
                        <Video className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      )}
                      {interview.location_type === "ONLINE" && interview.location_details.startsWith("http") ? (
                        <a href={interview.location_details} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          Join Meeting
                        </a>
                      ) : (
                        <span className="truncate" title={interview.location_details}>{interview.location_details}</span>
                      )}
                    </div>
                  </div>
                  
                  {interview.notes && (
                    <div className="mt-3 rounded-md bg-muted p-3">
                      <p className="text-xs font-semibold mb-1">Notes from Recruiter</p>
                      <p className="text-sm">{interview.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
