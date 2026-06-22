"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Briefcase, GraduationCap, MapPin, Mail, Phone, Calendar } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { getSession, type SessionData, type UserRole } from "@/lib/auth";
import { useUi } from "@/contexts/UiContext";
import { cn } from "@/lib/utils";

type CandidatePublic = {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  education: Array<{ school?: string; degree?: string; period?: string }>;
  experiences: Array<{ company?: string; role?: string; period?: string; description?: string }>;
  skills: Array<{ name: string; level: number }>;
  experience_level: string;
  preferred_locations: string;
  preferred_salary_min: number;
};

export default function CandidatePublicProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { glassMode } = useUi();
  const [session, setSession] = useState<SessionData | null>(null);
  const [data, setData] = useState<CandidatePublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      setLoading(false);
      return;
    }
    setSession(s);
    (async () => {
      try {
        const res = await apiRequest<CandidatePublic>(`/candidate-profiles/${params.id}/public`, { session: s });
        setData(res.data);
      } catch (err) {
        console.error("Failed to load candidate profile:", err);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  const role = useMemo<UserRole>(() => session?.role ?? "candidate", [session?.role]);
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertTitle>Phiên đăng nhập không tồn tại</AlertTitle>
          <AlertDescription>
            Bạn chưa đăng nhập hoặc token đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.
          </AlertDescription>
          <div className="mt-3">
            <Button onClick={() => router.push("/login")}>Đăng nhập</Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <AppShell role={role} title="Candidate Profile">
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading profile…</p>
      ) : !data ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Profile not found.</p>
      ) : (
        <div className="space-y-6">
          <div className={cn("relative overflow-hidden rounded-xl border transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
            <div
              className="h-40 w-full bg-gradient-to-r from-slate-100 to-slate-200 bg-cover bg-center"
              style={data.cover_url ? { backgroundImage: `url(${data.cover_url})` } : undefined}
            />
            <div className="relative px-6 pb-6">
              <div className="-mt-10 mb-3 h-20 w-20 overflow-hidden rounded-full border-4 border-background bg-muted">
                {data.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.avatar_url} alt={data.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-semibold">
                    {data.name?.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-bold">{data.name}</h2>
              <p className="text-sm text-muted-foreground capitalize">{data.experience_level}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" />{data.email}</span>
                {data.phone && <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{data.phone}</span>}
                {data.dob && <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{data.dob}</span>}
                {data.preferred_locations && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{data.preferred_locations}</span>}
              </div>
              {data.bio && <p className="mt-3 text-sm leading-relaxed text-foreground/90">{data.bio}</p>}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
              <CardContent className="p-5">
                <h3 className="mb-3 text-base font-semibold">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {data.skills?.length ? data.skills.map((s) => (
                    <Badge key={`${s.name}-${s.level}`} variant="secondary">
                      {s.name} Lv.{s.level}
                    </Badge>
                  )) : <p className="text-sm text-muted-foreground">No skills listed.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
              <CardContent className="p-5">
                <h3 className="mb-3 text-base font-semibold">Preferences</h3>
                <p className="text-sm text-muted-foreground">Preferred locations: {data.preferred_locations || "—"}</p>
                <p className="text-sm text-muted-foreground">Minimum salary: ${data.preferred_salary_min || 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
            <CardContent className="p-5">
              <h3 className="mb-3 inline-flex items-center gap-2 text-base font-semibold">
                <GraduationCap className="h-4 w-4" /> Education
              </h3>
              {data.education?.length ? data.education.map((e, idx) => (
                <div key={idx} className="mb-3 rounded-lg border bg-muted/20 p-3 last:mb-0">
                  <p className="font-medium">{e.school || "School"}</p>
                  <p className="text-sm text-muted-foreground">{e.degree || "Degree"} {e.period ? `• ${e.period}` : ""}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No education records.</p>}
            </CardContent>
          </Card>

          <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
            <CardContent className="p-5">
              <h3 className="mb-3 inline-flex items-center gap-2 text-base font-semibold">
                <Briefcase className="h-4 w-4" /> Experience
              </h3>
              {data.experiences?.length ? data.experiences.map((e, idx) => (
                <div key={idx} className="mb-3 rounded-lg border bg-muted/20 p-3 last:mb-0">
                  <p className="font-medium">{e.role || "Role"} {e.company ? `at ${e.company}` : ""}</p>
                  {e.period && <p className="text-sm text-muted-foreground">{e.period}</p>}
                  {e.description && <p className="mt-1 text-sm text-foreground/90">{e.description}</p>}
                </div>
              )) : <p className="text-sm text-muted-foreground">No experience records.</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
