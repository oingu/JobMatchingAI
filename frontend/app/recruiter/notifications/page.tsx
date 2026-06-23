"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";
import { useUi } from "@/contexts/UiContext";
import { cn } from "@/lib/utils";

type NotificationItem = { title: string; body: string; status: string };

export default function RecruiterNotificationsPage() {
  return (
    <RoleGuard allowedRole="recruiter">
      {(session) => <NotificationsContent session={session} />}
    </RoleGuard>
  );
}

function NotificationsContent({ session }: { session: SessionData }) {
  const { glassMode } = useUi();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<{ user_id: number; notifications: NotificationItem[] }>(
          `/notifications/${session.userId}`,
          { session },
        );
        setItems(res.data.notifications);

        // Mark as read in the background
        apiRequest(`/notifications/${session.userId}/read-all`, {
          method: "POST",
          session,
        }).catch(() => {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load notifications.");
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  return (
    <AppShell role="recruiter" title="Notifications">
      <div className="w-full space-y-3 pr-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
            <CardContent className="flex flex-col items-center gap-2 py-12">
              <BellOff className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                You&apos;ll be notified when candidates match your job postings.
              </p>
            </CardContent>
          </Card>
        ) : (
          items.map((item, idx) => (
            <Card key={idx} className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="mt-0.5 rounded-md bg-muted p-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
                </div>
                <Badge variant={item.status === "SENT" ? "secondary" : "default"} className="text-[10px]">
                  {item.status}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
