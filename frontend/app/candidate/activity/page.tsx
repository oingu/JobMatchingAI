"use client";

import { useEffect, useState } from "react";
import { Activity, Filter } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, qs } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type ActivityData = {
  candidate_id: number;
  status: string | null;
  activity_score: number | null;
  logs: Array<{ event_type: string; job_id: number | null; created_at: string }>;
};

const EVENT_TYPES = ["", "view", "click", "apply", "login"];

export default function CandidateActivityPage() {
  return <RoleGuard allowedRole="candidate">{(session) => <CandidateActivityContent session={session} />}</RoleGuard>;
}

function CandidateActivityContent({ session }: { session: SessionData }) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [eventType, setEventType] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const query = qs({ event_type: eventType || undefined, limit: 100 });
      const res = await apiRequest<ActivityData>(`/activity/${session.userId}${query}`, { session });
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load activity failed.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusColor: Record<string, string> = {
    ACTIVE: "default",
    PASSIVE: "secondary",
    INACTIVE: "destructive",
  };

  return (
    <AppShell role="candidate" title="Activity">
      <div className="space-y-6">
        {/* Stats */}
        {data && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Badge variant={(statusColor[data.status ?? ""] as "default" | "secondary" | "destructive") ?? "outline"}>
                  {data.status ?? "Unknown"}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Activity Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.activity_score?.toFixed(4) ?? "—"}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="">All events</option>
            {EVENT_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Apply
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Logs table */}
        {data && data.logs.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log, idx) => (
                    <TableRow key={`${log.created_at}-${idx}`}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{log.event_type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.job_id ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : data ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No activity logs yet.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
