"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Sparkles, User, Briefcase, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"candidate" | "recruiter">("candidate");
  const [loading, setLoading] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      toastError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest<{
        token: string;
        user_id: number;
        name: string;
        role: "candidate" | "recruiter";
        email_verified: boolean;
        email_sent: boolean;
      }>("/auth/register", {
        method: "POST",
        body: { name, email, password, role },
      });

      setSession({
        token: response.data.token,
        userId: response.data.user_id,
        name: response.data.name,
        email,
        role: response.data.role,
        emailVerified: false,
      });

      toastSuccess("Account created! Please verify your email.");
      router.replace("/verify-email");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background p-6 overflow-hidden select-none">
      {/* Back button */}
      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center gap-2 rounded-lg border border-border/80 bg-card/40 px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-card/60 backdrop-blur-md transition-all duration-200 active:scale-[0.98] shadow-sm z-50 cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Home</span>
      </Link>

      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Decorative Emerald Ambient Glows */}
      <div className="emerald-glow-bg top-[-100px] left-[-100px] opacity-60"></div>
      <div className="emerald-glow-bg bottom-[-100px] right-[-100px] opacity-40"></div>

      {/* Main Register Card */}
      <div className="relative w-full max-w-[480px] rounded-2xl border border-border/80 bg-card/40 backdrop-blur-xl p-8 shadow-2xl transition-all duration-300 hover:border-border">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-card border border-border text-foreground shadow-md">
            <Zap className="h-5 w-5 text-emerald-500 fill-emerald-500/10" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border/80 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            <span>Join JobMatch AI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create an account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Discover smart matches tailored to your profile</p>
        </div>

        {/* Register Form */}
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
              Full Name
            </Label>
            <Input
              id="name"
              placeholder="Nguyen Van A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 bg-background/50 border-border/80 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 text-foreground placeholder:text-muted-foreground transition-all rounded-lg"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 bg-background/50 border-border/80 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 text-foreground placeholder:text-muted-foreground transition-all rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 bg-background/50 border-border/80 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 text-foreground placeholder:text-muted-foreground transition-all rounded-lg"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
                Confirm
              </Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 bg-background/50 border-border/80 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 text-foreground placeholder:text-muted-foreground transition-all rounded-lg"
                required
                minLength={6}
              />
            </div>
          </div>

          {/* Role selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">I am a</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("candidate")}
                className={`relative rounded-xl border p-3.5 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                  role === "candidate"
                    ? "border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/5"
                    : "border-border/60 bg-background/30 hover:border-border hover:bg-card/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <User className={`h-4 w-4 ${role === "candidate" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                  <p className="text-sm font-semibold text-foreground">Candidate</p>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">Looking for engineering roles</p>
              </button>

              <button
                type="button"
                onClick={() => setRole("recruiter")}
                className={`relative rounded-xl border p-3.5 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                  role === "recruiter"
                    ? "border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/5"
                    : "border-border/60 bg-background/30 hover:border-border hover:bg-card/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase className={`h-4 w-4 ${role === "recruiter" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                  <p className="text-sm font-semibold text-foreground">Recruiter</p>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">Hiring developer talent</p>
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-lg active:scale-[0.98] transition-all font-medium rounded-lg text-sm flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </Button>

          <div className="text-center pt-1.5">
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 underline underline-offset-4 decoration-emerald-500/30 hover:decoration-emerald-500 transition-all">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
