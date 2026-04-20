"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Building2, Globe, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { getSession, type SessionData, type UserRole } from "@/lib/auth";

type RecruiterPublic = {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  company_website: string;
  company_phone: string;
  company_fax: string;
  company_address: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  overview: Array<{ title?: string; value?: string }>;
  verification_status: string;
  jobs: Array<{ id: number; title: string; location: string; start_date: string | null; end_date: string | null }>;
};

function toWebsiteUrl(value: string): string {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export default function RecruiterPublicProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [data, setData] = useState<RecruiterPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    (async () => {
      try {
        const res = await apiRequest<RecruiterPublic>(`/recruiter-profiles/${params.id}/public`, { session: s });
        setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  const role = useMemo<UserRole>(() => session?.role ?? "candidate", [session?.role]);
  const mapQuery = encodeURIComponent(data?.company_address || data?.jobs?.[0]?.location || "");
  if (!session) return null;

  return (
    <AppShell role={role} title="Recruiter Profile">
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading profile…</p>
      ) : !data ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Profile not found.</p>
      ) : (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-xl border">
            <div
              className="h-40 w-full bg-gradient-to-r from-slate-100 to-slate-200 bg-cover bg-center"
              style={data.cover_url ? { backgroundImage: `url(${data.cover_url})` } : undefined}
            />
            <div className="relative px-6 pb-6">
              <div className="-mt-10 mb-3 h-20 w-20 overflow-hidden rounded-full border-4 border-background bg-muted">
                {data.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.avatar_url} alt={data.company_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-semibold">
                    {data.company_name?.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{data.company_name || data.name}</h2>
                {data.verification_status === "VERIFIED" && (
                  <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
                )}
              </div>
              {data.bio && <p className="mt-2 text-sm leading-relaxed text-foreground/90">{data.bio}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Building2 className="h-4 w-4" />{data.name}</span>
                {data.company_phone && <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{data.company_phone}</span>}
                {data.company_website && (
                  <a href={toWebsiteUrl(data.company_website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                    <Globe className="h-4 w-4" />{data.company_website}
                  </a>
                )}
                {data.email && <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" />{data.email}</span>}
                {data.company_address && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{data.company_address}</span>}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-base font-semibold">Company Overview</h3>
                {data.overview?.length ? data.overview.map((o, idx) => (
                  <div key={idx} className="mb-2 rounded-lg border bg-muted/20 p-3 last:mb-0">
                    <p className="text-xs text-muted-foreground">{o.title || "Info"}</p>
                    <p className="text-sm font-medium">{o.value || "—"}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No overview data.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-base font-semibold">Job Locations Map</h3>
                {mapQuery ? (
                  <iframe
                    title="Company location map"
                    src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                    className="h-64 w-full rounded-lg border"
                    loading="lazy"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No location available for map display.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 text-base font-semibold">Open / Recent Jobs</h3>
              {data.jobs?.length ? data.jobs.map((j) => (
                <div key={j.id} className="mb-2 rounded-lg border bg-muted/20 p-3 last:mb-0">
                  <p className="font-medium">{j.title}</p>
                  <p className="text-sm text-muted-foreground">{j.location || "—"}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No job posts available.</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
