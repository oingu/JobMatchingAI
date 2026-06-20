"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Trash2, Upload, AlertTriangle, BrainCircuit, Sparkles, FileText } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VIETNAM_PROVINCES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
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
  preferred_domains: string;
  preferred_work_modes: string;
  preferred_employment_types: string;
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
  const [domains, setDomains] = useState("");
  const [workModes, setWorkModes] = useState("");
  const [employmentTypes, setEmploymentTypes] = useState("");
  const [salaryMin, setSalaryMin] = useState(0);
  const [birthDate, setBirthDate] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [backup, setBackup] = useState<{ skills: SkillEntry[], experienceLevel: string, locations: string, domains: string, workModes: string, employmentTypes: string, salaryMin: number } | null>(null);

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

  const { t } = useLanguage();
  const [analyzingResume, setAnalyzingResume] = useState(false);
  const [resumeAnalysis, setResumeAnalysis] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<SavedProfile | null>("/candidate-profiles/me", { session });
        if (res.data) {
          setSkills(res.data.skills ?? []);
          setExperienceLevel(res.data.experience_level || "junior");
          setLocations(res.data.preferred_locations || "");
          setDomains(res.data.preferred_domains || "");
          setWorkModes(res.data.preferred_work_modes || "");
          setEmploymentTypes(res.data.preferred_employment_types || "");
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
          preferred_domains: domains,
          preferred_work_modes: workModes,
          preferred_employment_types: employmentTypes,
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
    setDomains(backup.domains);
    setWorkModes(backup.workModes);
    setEmploymentTypes(backup.employmentTypes);
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
          setBackup({ skills, experienceLevel, locations, domains, workModes, employmentTypes, salaryMin });
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

  async function handleAnalyzeResume() {
    setAnalyzingResume(true);
    setResumeAnalysis(null);
    try {
      const res = await apiRequest<any>("/candidate-profiles/me/analyze-resume", {
        method: "POST",
        session,
      });
      setResumeAnalysis(res.data);
      toastSuccess("Resume analysis complete!");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzingResume(false);
    }
  }

  // Compute profile strength and suggestions
  const { strength, suggestions } = useMemo(() => {
    let score = 0;
    const suggs: string[] = [];

    // Basic fields (10% each)
    if (birthDate) score += 10; else suggs.push("💡 Add your Date of Birth to help recruiters filter candidates better.");
    if (locations) score += 10; else suggs.push("💡 Add Preferred Locations so we can find jobs near you.");
    if (domains) score += 10; else suggs.push("💡 Specify Preferred Domains/Industries to get more relevant matches.");
    
    // Skills (up to 30%)
    if (skills.length >= 3) {
      score += 30;
    } else if (skills.length > 0) {
      score += 15;
      suggs.push(`💡 Add ${3 - skills.length} more technical skill(s) to increase your chance of being noticed by recruiters!`);
    } else {
      suggs.push("💡 Add at least 3 skills so recruiters know what you are good at.");
    }

    // Public profile fields (40%)
    if (avatarUrl) score += 10; else suggs.push("💡 Upload a professional Avatar to make your profile stand out.");
    if (bio && bio.length >= 20) score += 10; else suggs.push("💡 Write a brief Bio (at least 20 chars) to introduce yourself.");
    if (educationText) score += 10; else suggs.push("💡 Add your Education history to build trust.");
    if (experienceText) score += 10; else suggs.push("💡 Detail your past Experience. If you are a fresher, add personal projects!");

    return { strength: score, suggestions: suggs };
  }, [birthDate, locations, domains, skills, avatarUrl, bio, educationText, experienceText]);

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
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">My Profile</h2>
          <Button asChild variant="outline">
            <Link href={`/candidate/public/${session.userId}`}>View as Public</Link>
          </Button>
        </div>

        {/* Profile Strength Gamification */}
        <Card className="bg-gradient-to-r from-indigo-500/10 via-background to-purple-500/10 border-indigo-500/20 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none group-hover:from-indigo-500/20 transition-colors duration-500" />
          <CardContent className="p-4 relative z-10 flex flex-col sm:flex-row items-center gap-5">
            {/* Circular Progress */}
            <div className="relative flex items-center justify-center h-20 w-20 shrink-0">
              <svg className="h-20 w-20 -rotate-90 transform drop-shadow-md" viewBox="0 0 100 100">
                <circle
                  className="text-muted-foreground/20"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                />
                <circle
                  className={cn(
                    "transition-all duration-1000 ease-out",
                    strength >= 80 ? "text-emerald-500" : strength >= 50 ? "text-indigo-500" : "text-amber-500"
                  )}
                  strokeWidth="8"
                  strokeDasharray={40 * 2 * Math.PI}
                  strokeDashoffset={40 * 2 * Math.PI - (strength / 100) * 40 * 2 * Math.PI}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-foreground">{strength}%</span>
              </div>
            </div>

            {/* Content & Suggestions */}
            <div className="flex-1 space-y-1.5 text-center sm:text-left w-full">
              <h3 className="text-base font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
                Profile Strength
                {strength === 100 && <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse drop-shadow-sm" />}
              </h3>
              <p className="text-xs text-muted-foreground">
                {strength >= 80 
                  ? "Your profile looks amazing! You have a very high chance of getting matched with top companies." 
                  : "Complete your profile to unlock better job matches and get noticed by recruiters."}
              </p>
              
              {suggestions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap justify-center sm:justify-start gap-2">
                  {suggestions.slice(0, 2).map((sugg, idx) => (
                    <div key={idx} className="flex items-start text-left gap-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1.5 rounded-md max-w-[400px]">
                      <span>{sugg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="w-full">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="mb-6 grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="profile">Profile Details</TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              {t("candidate.apps.resume_analysis")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* ── LEFT COLUMN: Basic Data & CV Upload ── */}
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
                      <select
                        multiple
                        className="flex h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={locations.split(',').map(s => s.trim()).filter(Boolean)}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setLocations(selected.join(', '));
                        }}
                      >
                        {VIETNAM_PROVINCES.map((prov) => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-muted-foreground">Hold Cmd/Ctrl to select multiple.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Preferred Domains / Industries</Label>
                      <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="e.g. Automotive, FinTech" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Preferred Work Mode</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={workModes}
                        onChange={(e) => setWorkModes(e.target.value)}
                      >
                        <option value="">Any</option>
                        <option value="On-site">On-site</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="Remote">Remote</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Preferred Employment Type</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={employmentTypes}
                        onChange={(e) => setEmploymentTypes(e.target.value)}
                      >
                        <option value="">Any</option>
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                        <option value="Internship">Internship</option>
                      </select>
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
        </TabsContent>

        <TabsContent value="analysis" className="space-y-5">
          <Card className="border-indigo-500/20 shadow-sm shadow-indigo-500/10">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg text-indigo-500">
                    <Sparkles className="h-5 w-5" />
                    AI Resume Enhancer
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t("resume.intro")}
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleAnalyzeResume} 
                  disabled={analyzingResume}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {analyzingResume ? (
                    <><BrainCircuit className="mr-2 h-4 w-4 animate-pulse" /> {t("resume.analyzing")}</>
                  ) : (
                    <><BrainCircuit className="mr-2 h-4 w-4" /> {t("resume.analyze_btn")}</>
                  )}
                </Button>
              </div>
            </CardHeader>
            {resumeAnalysis && (
              <CardContent className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                {/* Score */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{t("resume.score")}</h3>
                    <span className="text-sm font-bold text-indigo-500">{resumeAnalysis.score} / 100</span>
                  </div>
                  <Progress value={resumeAnalysis.score} className="h-2" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Formatting Issues */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-rose-500 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {t("resume.formatting_issues")}
                    </h3>
                    {resumeAnalysis.formatting_issues?.length > 0 ? (
                      <ul className="space-y-2">
                        {resumeAnalysis.formatting_issues.map((issue: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-emerald-500">{t("resume.no_issues")}</p>
                    )}
                  </div>

                  {/* Content Suggestions */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-amber-500 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t("resume.content_suggestions")}
                    </h3>
                    {resumeAnalysis.content_suggestions?.length > 0 ? (
                      <ul className="space-y-2">
                        {resumeAnalysis.content_suggestions.map((sugg: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                            <span>{sugg}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-emerald-500">{t("resume.no_suggestions")}</p>
                    )}
                  </div>
                </div>

                {/* Rewrites */}
                {resumeAnalysis.rewrites?.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <Separator />
                    <h3 className="text-sm font-semibold pt-2">{t("resume.rewrites")}</h3>
                    <div className="space-y-4">
                      {resumeAnalysis.rewrites.map((rw: any, i: number) => (
                        <div key={i} className="rounded-lg border p-3 space-y-2 text-sm">
                          <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                            <Badge variant="outline" className="text-rose-500 border-rose-500/30 justify-center">{t("resume.original")}</Badge>
                            <span className="text-muted-foreground">{rw.original}</span>
                          </div>
                          <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 justify-center">{t("resume.improved")}</Badge>
                            <span className="text-foreground font-medium">{rw.improved}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </TabsContent>
        </Tabs>
      </div>
      </div>
    </AppShell>
  );
}

// Add cn utility directly here if missing, otherwise use the imported one.
import { cn } from "@/lib/utils";
