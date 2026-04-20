"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { apiRequest, apiUpload } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type Mine = {
  id: number;
  company_name: string;
  company_website: string;
  company_phone: string;
  company_fax: string;
  company_address: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  overview: Array<{ title?: string; value?: string }>;
};

export default function RecruiterProfilePage() {
  return (
    <RoleGuard allowedRole="recruiter">
      {(session) => <Content session={session} />}
    </RoleGuard>
  );
}

function Content({ session }: { session: SessionData }) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [companyAddress, setCompanyAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bio, setBio] = useState("");
  const [overviewText, setOverviewText] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<Mine | null>("/recruiter-profiles/mine", { session });
        if (res.data) {
          setCompanyAddress(res.data.company_address || "");
          setAvatarUrl(res.data.avatar_url || "");
          setCoverUrl(res.data.cover_url || "");
          setBio(res.data.bio || "");
          setOverviewText(
            (res.data.overview || [])
              .map((o) => `${o.title || ""} | ${o.value || ""}`.trim())
              .join("\n"),
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  async function savePublicProfile() {
    setSaving(true);
    try {
      const overview = overviewText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [title, value] = line.split("|").map((s) => s.trim());
          return { title: title || "Info", value: value || "" };
        });
      await apiRequest("/recruiter-profiles/mine/public", {
        method: "PUT",
        session,
        body: {
          company_address: companyAddress,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          bio,
          overview,
        },
      });
      success("Recruiter profile updated.");
    } catch (e) {
      error(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPublicImage(kind: "avatar" | "cover") {
    const ref = kind === "avatar" ? avatarFileRef : coverFileRef;
    const file = ref.current?.files?.[0];
    if (!file) return;
    const setLoading = kind === "avatar" ? setUploadingAvatar : setUploadingCover;
    setLoading(true);
    try {
      const res = await apiUpload<{ path: string; url: string }>("/profiles/upload-image", file, session);
      if (kind === "avatar") setAvatarUrl(res.data.url);
      else setCoverUrl(res.data.url);
      success(`${kind === "avatar" ? "Avatar" : "Cover"} uploaded.`);
    } catch (e) {
      error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setLoading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <AppShell role="recruiter" title="My Profile">
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link href={`/recruiter/public/${session.userId}`}>View as Public</Link>
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Recruiter Public Profile</CardTitle>
              <CardDescription>This information is shown to candidates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Avatar</Label>
                <div className="flex items-center gap-3">
                  <Input ref={avatarFileRef} type="file" accept="image/*" />
                  <Button type="button" variant="outline" onClick={() => uploadPublicImage("avatar")} disabled={uploadingAvatar}>
                    {uploadingAvatar ? "Uploading..." : "Upload"}
                  </Button>
                </div>
                {avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar preview" className="h-20 w-20 rounded-full border object-cover" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Cover</Label>
                <div className="flex items-center gap-3">
                  <Input ref={coverFileRef} type="file" accept="image/*" />
                  <Button type="button" variant="outline" onClick={() => uploadPublicImage("cover")} disabled={uploadingCover}>
                    {uploadingCover ? "Uploading..." : "Upload"}
                  </Button>
                </div>
                {coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="Cover preview" className="h-24 w-full rounded-md border object-cover" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company Address (for map)</Label>
              <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Building, street, city" />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <textarea
                className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Introduce your company..."
              />
            </div>
            <div className="space-y-2">
              <Label>Overview (one line: title | value)</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                value={overviewText}
                onChange={(e) => setOverviewText(e.target.value)}
                placeholder={"Industry | Software\nCompany size | 100-500\nWorking mode | Hybrid"}
              />
            </div>
              <Button onClick={savePublicProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Public Profile"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
