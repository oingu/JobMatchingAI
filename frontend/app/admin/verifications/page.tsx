"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Globe,
  FileText,
  ExternalLink,
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

type VerificationItem = {
  profile_id: number;
  user_id: number;
  recruiter_name: string;
  recruiter_email: string;
  company_name: string;
  company_website: string;
  tax_id: string;
  business_license_path: string;
  verification_status: string;
  verification_note?: string;
  updated_at: string | null;
};

type FilterStatus = "PENDING_REVIEW" | "ALL";

export default function AdminVerificationsPage() {
  return (
    <RoleGuard allowedRole="admin">
      {(session) => <Content session={session} />}
    </RoleGuard>
  );
}

function Content({ session }: { session: SessionData }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("PENDING_REVIEW");
  const [rejectNote, setRejectNote] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    try {
      const endpoint = filter === "PENDING_REVIEW" ? "/admin/verifications" : "/admin/verifications/all";
      const res = await apiRequest<VerificationItem[]>(endpoint, { session });
      setItems(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function review(profileId: number, action: "approve" | "reject") {
    const note = action === "reject" ? (rejectNote[profileId] || "") : "";
    try {
      await apiRequest(`/admin/verifications/${profileId}?action=${action}&note=${encodeURIComponent(note)}`, {
        method: "PUT",
        session,
      });
      toastSuccess(action === "approve" ? "Recruiter approved!" : "Recruiter rejected.");
      setItems((prev) =>
        prev.map((it) =>
          it.profile_id === profileId
            ? { ...it, verification_status: action === "approve" ? "VERIFIED" : "REJECTED" }
            : it,
        ),
      );
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Review failed.");
    }
  }

  const pending = items.filter((i) => i.verification_status === "PENDING_REVIEW");
  const verified = items.filter((i) => i.verification_status === "VERIFIED");
  const rejected = items.filter((i) => i.verification_status === "REJECTED");

  return (
    <AppShell role="admin" title="Recruiter Verifications">
      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{verified.length}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{rejected.length}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={filter === "PENDING_REVIEW" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("PENDING_REVIEW")}
        >
          Pending Review
        </Button>
        <Button
          variant={filter === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("ALL")}
        >
          All Submissions
        </Button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 opacity-40" />
          <p className="text-sm">No verification requests found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.profile_id}>
              <CardContent className="p-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-base">{item.recruiter_name}</h3>
                    <p className="text-xs text-muted-foreground">{item.recruiter_email}</p>
                  </div>
                  <Badge
                    variant={
                      item.verification_status === "VERIFIED" ? "default" :
                      item.verification_status === "REJECTED" ? "destructive" :
                      "secondary"
                    }
                    className="gap-1"
                  >
                    {item.verification_status === "VERIFIED" && <CheckCircle2 className="h-3 w-3" />}
                    {item.verification_status === "REJECTED" && <XCircle className="h-3 w-3" />}
                    {item.verification_status === "PENDING_REVIEW" && <Clock className="h-3 w-3" />}
                    {item.verification_status}
                  </Badge>
                </div>

                <Separator />

                {/* Company details */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Company:</span> {item.company_name}
                  </div>
                  {item.company_website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Website:</span>
                      <a href={item.company_website} target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1">
                        {item.company_website} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {item.tax_id && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Tax ID:</span> {item.tax_id}
                    </div>
                  )}
                  {item.business_license_path && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">License:</span>
                      <a
                        href={`http://localhost:8000/${item.business_license_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline flex items-center gap-1"
                      >
                        View Document <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {item.updated_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Submitted: {new Date(item.updated_at).toLocaleString()}
                  </p>
                )}

                {item.verification_note && item.verification_status !== "PENDING_REVIEW" && (
                  <p className="text-xs text-muted-foreground italic">Note: {item.verification_note}</p>
                )}

                {/* Actions */}
                {item.verification_status === "PENDING_REVIEW" && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Rejection note (optional)</Label>
                        <Input
                          placeholder="Reason for rejection..."
                          value={rejectNote[item.profile_id] ?? ""}
                          onChange={(e) => setRejectNote((prev) => ({ ...prev, [item.profile_id]: e.target.value }))}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 gap-1"
                          onClick={() => review(item.profile_id, "approve")}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1 gap-1"
                          onClick={() => review(item.profile_id, "reject")}
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
