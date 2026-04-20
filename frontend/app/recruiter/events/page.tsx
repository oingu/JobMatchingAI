"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type EventRow = {
  id: number;
  event_type: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export default function EventsPage() {
  return <RoleGuard allowedRole="recruiter">{(session) => <EventsContent session={session} />}</RoleGuard>;
}

function EventsContent({ session }: { session: SessionData }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState("");

  async function loadEvents() {
    setError("");
    try {
      const res = await apiRequest<EventRow[]>("/events?offset=0&limit=100", { session });
      setEvents(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load events failed.");
    }
  }

  async function retry(eventId: number) {
    await apiRequest(`/events/${eventId}/retry`, { method: "POST", session });
    await apiRequest("/events/process?limit=20", { method: "POST", session });
    await loadEvents();
  }

  useEffect(() => {
    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell role="recruiter" title="Events">
      <button className="mb-3 rounded-md border px-3 py-2 text-sm hover:bg-zinc-100" onClick={() => void loadEvents()}>
        Refresh
      </button>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pr-4">ID</th>
              <th className="pr-4">Type</th>
              <th className="pr-4">Status</th>
              <th className="pr-4">Created</th>
              <th className="pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-t">
                <td className="py-2 pr-4">{event.id}</td>
                <td className="py-2 pr-4">{event.event_type}</td>
                <td className="py-2 pr-4">{event.status}</td>
                <td className="py-2 pr-4">{new Date(event.created_at).toLocaleString()}</td>
                <td className="py-2 pr-4">
                  {event.status === "FAILED" ? (
                    <button className="rounded border px-2 py-1 hover:bg-zinc-100" onClick={() => void retry(event.id)}>
                      Retry
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
