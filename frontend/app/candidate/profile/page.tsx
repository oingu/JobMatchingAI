"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Upload, AlertTriangle, BrainCircuit, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/toast";
import { apiRequest, apiUpload } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

interface SkillEntry { name: string; level: number }

const LEVEL_LABELS: Record<number, string> = {
  1: "Beginner", 2: "Elementary", 3: "Intermediate", 4: "Advanced", 5: "Expert",
};

interface CVParsed {
  skills: SkillEntry[];
  experience_level: string;
  locations: string[];
  salary_min: number;
  years_of_experience: number | null;
  raw_text_length: number;
}

interface UploadResult {
  parsed: CVParsed;
  profile_id?: number;
  event_id?: number;
  profile_updated: boolean;
  message?: string;
  parser?: string;
  gemini_error?: string;
}

interface SavedProfile {
  profile_id: number;
  user_id: number;
  skills: SkillEntry[];
  experience_level: string;
  preferred_locations: string;
  preferred_salary_min: number;
  birth_date: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  education: Array<{ school?: string; degree?: string; period?: string }>;
  experiences: Array<{ company?: string; role?: string; period?: string; description?: string }>;
  status: string;
  activity_score: number;
  phone: string;
}

export default function CandidateProfilePage() {
  return (
    <RoleGuard allowedRole="candidate">
      {(session) => <CandidateProfileContent session={session} />}
    </RoleGuard>
  );
}

function CandidateProfileContent({ session }: { session: SessionData }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [experienceLevel, setExperienceLevel] = useState("junior");
  const [locations, setLocations] = useState("");
  const [salaryMin, setSalaryMin] = useState(0);
  const [birthDate, setBirthDate] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [backup, setBackup] = useState<{ skills: SkillEntry[], experienceLevel: string, locations: string, salaryMin: number } | null>(null);

  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState(3);

  const fileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extraction, setExtraction] = useState<CVParsed | null>(null);
  const [parserUsed, setParserUsed] = useState<string | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [educationText, setEducationText] = useState("");
  const [experienceText, setExperienceText] = useState("");
  const [savingPublic, setSavingPublic] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<SavedProfile | null>("/candidate-profiles/me", { session });
        if (res.data) {
          setSkills(res.data.skills ?? []);
          setExperienceLevel(res.data.experience_level || "junior");
          setLocations(res.data.preferred_locations || "");
          setSalaryMin(res.data.preferred_salary_min || 0);
          setBirthDate(res.data.birth_date || "");
          setAvatarUrl(res.data.avatar_url || "");
          setCoverUrl(res.data.cover_url || "");
          setBio(res.data.bio || "");
          setPhone(res.data.phone || "");
          setEducationText(
            (res.data.education || []).map((e) => `${e.school || ""} | ${e.degree || ""} | ${e.period || ""}`).join("\n"),
          );
          setExperienceText(
            (res.data.experiences || []).map((e) => `${e.company || ""} | ${e.role || ""} | ${e.period || ""} | ${e.description || ""}`).join("\n"),
          );
        }
      } catch { /* No saved profile */ } finally {
        setProfileLoaded(true);
      }
    })();
  }, [session]);

  function addSkill() {
    const name = newSkillName.trim().toLowerCase();
    if (!name || skills.some((s) => s.name === name)) return;
    setSkills([...skills, { name, level: newSkillLevel }]);
    setNewSkillName("");
    setNewSkillLevel(3);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!birthDate) { toastError("Date of Birth is required for matching."); return; }
    if (skills.length === 0) { toastError("Please add at least one skill."); return; }
    try {
      await apiRequest<{ profile_id: number; event_id: number }>("/candidate-profiles", {
        method: "POST",
        session,
        body: {
          user_id: session.userId,
          skills,
          experience_level: experienceLevel,
          preferred_locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
          preferred_salary_min: salaryMin,
          birth_date: birthDate,
        },
      });
      toastSuccess("Profile saved. Matching triggered automatically.");
      setBackup(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Save profile failed.");
    }
  }

  function undoUpload() {
    if (!backup) return;
    setSkills(backup.skills);
    setExperienceLevel(backup.experienceLevel);
    setLocations(backup.locations);
    setSalaryMin(backup.salaryMin);
    setBackup(null);
    setExtraction(null);
    setParserUsed(null);
    setGeminiError(null);
    if (fileRef.current) fileRef.current.value = "";
    toastSuccess("Reverted to previous profile data.");
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { toastError("Please select a PDF file."); return; }
    
    setUploading(true);
    setUploadProgress(0);
    setExtraction(null); setParserUsed(null); setGeminiError(null);
    
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 5 + Math.floor(Math.random() * 10);
      });
    }, 400);

    try {
      const response = await apiUpload<UploadResult>("/candidates/upload-cv", file, session);
      
      clearInterval(interval);
      setUploadProgress(100);
      
      setTimeout(() => {
        const result = response.data;
        setExtraction(result.parsed);
        setParserUsed(result.parser ?? null);
        // @ts-ignore - 'error' is passed back from the updated endpoint
        setGeminiError(result.error || result.gemini_error || null);
        
        if (result.parsed.skills.length > 0) {
          setBackup({ skills, experienceLevel, locations, salaryMin });
          setSkills(result.parsed.skills);
          setExperienceLevel(result.parsed.experience_level);
          if (result.parsed.locations.length > 0) setLocations(result.parsed.locations.join(","));
          if (result.parsed.salary_min > 0) setSalaryMin(result.parsed.salary_min);
          toastSuccess(result.message ?? "CV parsed successfully. Please review and save.");
        } else {
          toastSuccess(result.message ?? "CV parsed but no skills detected. Please update manually.");
        }
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setUploadProgress(0);
      toastError(err instanceof Error ? err.message : "Upload failed.");
      setUploading(false);
    }
  }

  async function savePublicProfile() {
    setSavingPublic(true);
    try {
      const education = educationText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [school, degree, period] = line.split("|").map((s) => s.trim());
          return { school: school || "", degree: degree || "", period: period || "" };
        });
      const experiences = experienceText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [company, role, period, description] = line.split("|").map((s) => s.trim());
          return { company: company || "", role: role || "", period: period || "", description: description || "" };
        });
      await apiRequest("/candidate-profiles/me/public", {
        method: "PUT",
        session,
        body: { avatar_url: avatarUrl, cover_url: coverUrl, bio, phone, education, experiences },
      });
      toastSuccess("Public profile updated.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingPublic(false);
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
      toastSuccess(`${kind === "avatar" ? "Avatar" : "Cover"} uploaded.`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Upload image failed.");
    } finally {
      setLoading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  if (!profileLoaded) {
    return (
      <AppShell role="candidate" title="My Profile">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="candidate" title="My Profile">
      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href={`/candidate/public/${session.userId}`}>View as Public</Link>
          </Button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          {/* ── LEFT COLUMN: Matching Profile ── */}
          <div className="space-y-5">
            {/* CV Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Upload CV</CardTitle>
                <CardDescription>Upload a PDF to auto-extract skills, experience, and preferences.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Input ref={fileRef} type="file" accept=".pdf,application/pdf" className="flex-1" />
                    <Button onClick={handleUpload} disabled={uploading} className="gap-2">
                      <Upload className="h-4 w-4" />
                      {uploading ? "Parsing…" : "Upload"}
                    </Button>
                  </div>
                  {uploading && uploadProgress > 0 && (
                    <div className="space-y-3 mt-4 p-4 border border-emerald-900/40 bg-emerald-950/10 rounded-xl relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 animate-[shimmer_2s_infinite] -skew-x-12" />
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-950 border border-emerald-800 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                          <BrainCircuit className="h-5 w-5 text-emerald-400 animate-pulse" />
                          <Sparkles className="h-3 w-3 text-emerald-300 absolute -top-1 -right-1 animate-ping" />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-emerald-400 font-mono flex items-center gap-1.5">
                              {uploadProgress < 30 && "Extracting document data..."}
                              {uploadProgress >= 30 && uploadProgress < 60 && "Running Gemini Vision NLP..."}
                              {uploadProgress >= 60 && uploadProgress < 90 && "Vectorizing skills & experience..."}
                              {uploadProgress >= 90 && "Finalizing matching profile..."}
                            </span>
                            <span className="font-bold text-emerald-500">{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} className="h-1.5 w-full bg-zinc-900 [&>div]:bg-emerald-500" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Extraction Result (conditional) */}
            {extraction && (
              <Card className="border-emerald-500/20 bg-emerald-950/5 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-zinc-100">Extraction Result</CardTitle>
                    {parserUsed && (
                      <Badge variant="outline" className="border-emerald-900/60 bg-emerald-950/20 text-emerald-400 text-[10px] font-mono">
                        {parserUsed === "gemini" ? "Gemini AI Vision" : "Regex + OCR"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {geminiError && parserUsed === "regex" && (
                    <Alert className="border-amber-900/50 bg-amber-950/20 text-amber-500">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Gemini AI was not used</AlertTitle>
                      <AlertDescription className="text-xs">{geminiError}</AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <p className="mb-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Skills detected: <span className="font-bold font-mono text-emerald-400 text-sm ml-1">{extraction.skills.length}</span>
                    </p>
                    {extraction.skills.length > 0 ? (
                      <div className="space-y-2.5">
                        {extraction.skills.map((s) => (
                          <div key={s.name} className="flex items-center gap-2.5">
                            <span className="min-w-[90px] text-sm font-medium text-zinc-350 capitalize">{s.name}</span>
                            <div className="h-1.5 flex-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900/60 p-[1px]">
                              <div
                                className="h-full rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-500"
                                style={{ width: `${(s.level / 5) * 100}%` }}
                              />
                            </div>
                            <Badge variant="outline" className="min-w-[80px] justify-center text-[10px] font-mono bg-zinc-950/40 border-zinc-900 text-zinc-400">
                              Lv.{s.level} {LEVEL_LABELS[s.level]}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">None detected</p>
                    )}
                  </div>
                  
                  <div className="h-[1px] bg-zinc-900/80 my-3" />

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Experience</p>
                      <p className="font-semibold capitalize text-zinc-300 mt-0.5">
                        {extraction.experience_level}
                        {extraction.years_of_experience !== null && ` (${extraction.years_of_experience}y)`}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Locations</p>
                      <p className="font-semibold text-zinc-300 mt-0.5">{extraction.locations.length > 0 ? extraction.locations.join(", ") : "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Min Salary</p>
                      <p className="font-semibold text-zinc-300 mt-0.5">{extraction.salary_min > 0 ? `$${extraction.salary_min.toLocaleString()}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Text extracted</p>
                      <p className="font-semibold text-zinc-300 mt-0.5">{extraction.raw_text_length.toLocaleString()} chars</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Skills & Proficiency */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Skills &amp; Proficiency</CardTitle>
                <CardDescription>Each skill has a proficiency level (1–5) used for weighted matching.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {skills.length > 0 && (
                  <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                    {skills.map((skill) => (
                      <div key={skill.name} className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2.5">
                        <span className="min-w-[90px] text-sm font-medium">{skill.name}</span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={skill.level}
                          onChange={(e) =>
                            setSkills(skills.map((s) => (s.name === skill.name ? { ...s, level: Number(e.target.value) } : s)))
                          }
                          className="flex-1 accent-primary"
                        />
                        <Badge variant="secondary" className="min-w-[80px] justify-center text-xs">
                          Lv.{skill.level} {LEVEL_LABELS[skill.level]}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSkills(skills.filter((s) => s.name !== skill.name))}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="Skill name"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  />
                  <select
                    className="w-20 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={newSkillLevel}
                    onChange={(e) => setNewSkillLevel(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((l) => (
                      <option key={l} value={l}>Lv.{l}</option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" onClick={addSkill}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Profile Details (Matching Preferences) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Matching Preferences</CardTitle>
                <CardDescription>Your preferences for job matching.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <Label>Date of Birth <span className="text-destructive">*</span></Label>
                      <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Experience Level</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={experienceLevel}
                        onChange={(e) => setExperienceLevel(e.target.value)}
                      >
                        <option value="junior">Junior</option>
                        <option value="middle">Middle</option>
                        <option value="senior">Senior</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Preferred Locations</Label>
                      <Input value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="hanoi, remote" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Min Salary ($)</Label>
                      <Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {backup && (
                      <Button type="button" variant="outline" onClick={undoUpload} className="w-1/3 border-destructive text-destructive hover:bg-destructive/10">
                        Undo
                      </Button>
                    )}
                    <Button type="submit" className="flex-1">Save Profile</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT COLUMN: Public Profile ── */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Public Profile</CardTitle>
                <CardDescription>This section is visible to recruiters (LinkedIn-style).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Avatar & Cover side by side */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Avatar</Label>
                    <div className="flex items-center gap-2">
                      <Input ref={avatarFileRef} type="file" accept="image/*" className="flex-1 text-xs" />
                      <Button type="button" variant="outline" size="sm" onClick={() => uploadPublicImage("avatar")} disabled={uploadingAvatar}>
                        {uploadingAvatar ? "..." : "Upload"}
                      </Button>
                    </div>
                    {avatarUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Avatar preview" className="h-16 w-16 rounded-full border object-cover" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Cover</Label>
                    <div className="flex items-center gap-2">
                      <Input ref={coverFileRef} type="file" accept="image/*" className="flex-1 text-xs" />
                      <Button type="button" variant="outline" size="sm" onClick={() => uploadPublicImage("cover")} disabled={uploadingCover}>
                        {uploadingCover ? "..." : "Upload"}
                      </Button>
                    </div>
                    {coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt="Cover preview" className="h-20 w-full rounded-md border object-cover" />
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+84..." />
                </div>

                <div className="space-y-1.5">
                  <Label>Bio</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief introduction..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Education <span className="text-xs text-muted-foreground">(one line: School | Degree | Period)</span></Label>
                  <textarea
                    className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    value={educationText}
                    onChange={(e) => setEducationText(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Experience <span className="text-xs text-muted-foreground">(Company | Role | Period | Description)</span></Label>
                  <textarea
                    className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    value={experienceText}
                    onChange={(e) => setExperienceText(e.target.value)}
                  />
                </div>

                <Button type="button" className="w-full" onClick={savePublicProfile} disabled={savingPublic}>
                  {savingPublic ? "Saving..." : "Save Public Profile"}
                </Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
