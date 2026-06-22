"use client";

import { useEffect, useState } from "react";
import { Save, Lock, User, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import { getSession, setSession, type SessionData, type UserRole } from "@/lib/auth";
import { useUi } from "@/contexts/UiContext";
import { cn } from "@/lib/utils";

type ProfileData = {
  name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  company_name?: string;
  company_website?: string;
  company_phone?: string;
  company_fax?: string;
};

export function SettingsForm({ session, role }: { session: SessionData; role: UserRole }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const { glassMode } = useUi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyFax, setCompanyFax] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<ProfileData>("/auth/profile", { session });
        const d = res.data;
        setName(d.name || "");
        setPhone(d.phone || "");
        setDob(d.date_of_birth || "");
        if (d.company_name !== undefined) setCompanyName(d.company_name);
        if (d.company_website !== undefined) setCompanyWebsite(d.company_website);
        if (d.company_phone !== undefined) setCompanyPhone(d.company_phone);
        if (d.company_fax !== undefined) setCompanyFax(d.company_fax);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = { name, phone, date_of_birth: dob };
      if (role === "recruiter") {
        body.company_name = companyName;
        body.company_website = companyWebsite;
        body.company_phone = companyPhone;
        body.company_fax = companyFax;
      }
      await apiRequest("/auth/profile", { method: "PUT", session, body });
      const current = getSession();
      if (current && name.trim()) {
        setSession({ ...current, name: name.trim() });
      }
      toastSuccess("Profile updated successfully.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPw(true);
    try {
      await apiRequest("/auth/password", {
        method: "PUT",
        session,
        body: { old_password: oldPassword, new_password: newPassword },
      });
      toastSuccess("Password changed successfully.");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Password change failed.");
    } finally {
      setChangingPw(false);
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Personal Info */}
      <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Personal Information</h2>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Full Name</Label>
                <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" value={session.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-phone">Phone</Label>
                <Input id="s-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +84 912 345 678" />
              </div>
              {role === "candidate" && (
                <div className="space-y-1.5">
                  <Label htmlFor="s-dob">Date of Birth</Label>
                  <Input id="s-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              )}
            </div>

            {role === "recruiter" && (
              <>
                <Separator />
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Company Information</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-cname">Company Name</Label>
                    <Input id="s-cname" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-cweb">Company Website</Label>
                    <Input id="s-cweb" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://company.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-cphone">Company Phone</Label>
                    <Input id="s-cphone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="e.g. 024 1234 5678" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-cfax">Company Fax</Label>
                    <Input id="s-cfax" value={companyFax} onChange={(e) => setCompanyFax(e.target.value)} placeholder="e.g. 024 1234 5679" />
                  </div>
                </div>
              </>
            )}

            <Button type="submit" className="gap-2" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className={cn("transition-colors duration-300", glassMode ? "bg-background/40 backdrop-blur-xl border-border/60 shadow-sm" : "bg-transparent hover:bg-accent/5 border border-border/40")}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Change Password</h2>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-oldpw">Current Password</Label>
                <Input id="s-oldpw" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-newpw">New Password</Label>
                <Input id="s-newpw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              </div>
            </div>
            <Button type="submit" variant="outline" className="gap-2" disabled={changingPw}>
              <Lock className="h-4 w-4" />
              {changingPw ? "Changing…" : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
