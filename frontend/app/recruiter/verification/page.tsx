"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Upload,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";
import { useUi } from "@/contexts/UiContext";
import { cn } from "@/lib/utils";

type ProfileData = {
  id: number;
  company_name: string;
  company_website: string;
  tax_id: string;
  business_license_path: string;
  verification_status: string;
  verification_note: string;
} | null;

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  UNVERIFIED: { label: "Unverified", icon: <ShieldAlert className="h-4 w-4" />, color: "text-amber-600" },
  PENDING_REVIEW: { label: "Pending Review", icon: <Clock className="h-4 w-4" />, color: "text-blue-600" },
  VERIFIED: { label: "Verified", icon: <ShieldCheck className="h-4 w-4" />, color: "text-green-600" },
  REJECTED: { label: "Rejected", icon: <XCircle className="h-4 w-4" />, color: "text-red-600" },
};

export default function VerificationPage() {
  return (
    <RoleGuard allowedRole="recruiter">
      {(session) => <Content session={session} />}
    </RoleGuard>
  );
}

function Content({ session }: { session: SessionData }) {
  const { glassMode } = useUi();
  const { success: toastSuccess, error: toastError } = useToast();
  const [profile, setProfile] = useState<ProfileData>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [taxId, setTaxId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadProfile() {
    try {
      const res = await apiRequest<ProfileData>("/recruiter-profiles/mine", { session });
      setProfile(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitVerification(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toastError("Please upload your business license.");
      return;
    }
    setSubmitting(true);
    try {
      if (!profile) {
        const name = companyName.trim();
        if (!name) {
          toastError("Please enter your company name.");
          setSubmitting(false);
          return;
        }
        await apiRequest("/recruiter-profiles", {
          method: "POST",
          session,
          body: { user_id: session.userId, company_name: name },
        });
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`http://localhost:8000/recruiter-profiles/verify?company_website=${encodeURIComponent(website)}&tax_id=${encodeURIComponent(taxId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Submission failed");
      toastSuccess("Verification submitted! Please wait for admin review.");
      void loadProfile();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppShell role="recruiter" title="Verification">
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  const status = profile?.verification_status ?? "UNVERIFIED";
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.UNVERIFIED;

  return (
    <AppShell role="recruiter" title="Verification">
      {/* Current status */}
      <Card className={cn("mb-6 transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
        <CardContent className="flex items-center gap-4 p-6">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-muted ${cfg.color}`}>
            {cfg.icon}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Verification Status</h2>
            <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
            {profile?.verification_note && (
              <p className="mt-1 text-xs text-muted-foreground">{profile.verification_note}</p>
            )}
          </div>
          <Badge
            variant={
              status === "VERIFIED" ? "default" :
              status === "REJECTED" ? "destructive" : "secondary"
            }
            className="text-sm px-3 py-1"
          >
            {cfg.label}
          </Badge>
        </CardContent>
      </Card>

      {/* Info when verified */}
      {status === "VERIFIED" && (
        <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold">Your company is verified!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              All your job posts will display a &quot;Verified Employer&quot; badge.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info when pending */}
      {status === "PENDING_REVIEW" && (
        <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
          <CardContent className="p-6 text-center">
            <Clock className="mx-auto h-12 w-12 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold">Under Review</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your verification documents are being reviewed by our admin team. This usually takes 1-2 business days.
            </p>
            {profile?.company_website && (
              <p className="text-xs text-muted-foreground mt-2">Website: {profile.company_website}</p>
            )}
            {profile?.tax_id && (
              <p className="text-xs text-muted-foreground">Tax ID: {profile.tax_id}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form to submit verification */}
      {(status === "UNVERIFIED" || status === "REJECTED") && (
        <>
          {status === "REJECTED" && profile && (
            <Card className={cn("mb-4 border-destructive/50 transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
              <CardContent className="p-4">
                <p className="text-sm text-destructive font-medium">
                  Your previous submission was rejected. Please review the feedback and try again.
                </p>
                {profile.verification_note && (
                  <p className="text-xs text-muted-foreground mt-1">Reason: {profile.verification_note}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-1">Submit Verification</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Provide your company details and upload a business license to get the &quot;Verified Employer&quot; badge on your job posts.
              </p>
              <Separator className="mb-4" />
              <form onSubmit={submitVerification} className="space-y-4">
                {!profile && (
                  <div className="space-y-1.5">
                    <Label htmlFor="company-name">Company Name *</Label>
                    <Input
                      id="company-name"
                      placeholder="e.g. SOICT Technology"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="website">Company Website</Label>
                  <Input
                    id="website"
                    placeholder="https://company.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tax-id">Tax ID / Business Registration Number</Label>
                  <Input
                    id="tax-id"
                    placeholder="e.g. 0123456789"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="license">Business License *</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="license"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="flex-1"
                    />
                    {file && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {file.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Upload PDF or image of your business license / registration certificate.
                  </p>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  <Upload className="h-4 w-4" />
                  {submitting ? "Submitting…" : "Submit for Review"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}
