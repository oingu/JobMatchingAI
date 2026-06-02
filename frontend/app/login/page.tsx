"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import { setSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await apiRequest<{ token: string; user_id: number; name: string; email: string; role: "candidate" | "recruiter" | "admin"; email_verified: boolean }>(
        "/auth/login",
        { method: "POST", body: { email, password } },
      );
      setSession({
        token: response.data.token,
        userId: response.data.user_id,
        name: response.data.name,
        email: response.data.email ?? email,
        role: response.data.role,
        emailVerified: response.data.email_verified,
      });
      toastSuccess("Signed in successfully!");
      if (!response.data.email_verified) {
        router.replace("/verify-email");
      } else {
        const dest = response.data.role === "admin" ? "/admin/dashboard" : response.data.role === "recruiter" ? "/recruiter/dashboard" : "/candidate/feed";
        router.replace(dest);
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-zinc-950 p-6 overflow-hidden select-none">
      {/* Decorative Emerald Ambient Glows */}
      <div className="emerald-glow-bg top-[-100px] left-[-100px] opacity-60"></div>
      <div className="emerald-glow-bg bottom-[-100px] right-[-100px] opacity-40"></div>

      {/* Main Login Card */}
      <div className="relative w-full max-w-[420px] rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xl p-8 shadow-2xl transition-all duration-300 hover:border-zinc-800">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-md">
            <Zap className="h-5 w-5 text-emerald-400 fill-emerald-400/10" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-zinc-800/80 bg-zinc-950/40 text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
            <Sparkles className="h-3 w-3 text-emerald-400" />
            <span>JobMatch AI Gateway</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Welcome back</h1>
          <p className="mt-1.5 text-sm text-zinc-400">Sign in to resume matching candidates</p>
        </div>

        {/* Login Form */}
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-zinc-950/50 border-zinc-800/80 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 text-zinc-100 placeholder:text-zinc-600 transition-all rounded-lg"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Password
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-zinc-950/50 border-zinc-800/80 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 text-zinc-100 placeholder:text-zinc-600 transition-all rounded-lg"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-zinc-50 hover:bg-zinc-200 text-zinc-950 hover:shadow-lg active:scale-[0.98] transition-all font-medium rounded-lg text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-800 border-t-transparent" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </Button>

          <div className="text-center pt-2">
            <p className="text-xs text-zinc-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-4 decoration-emerald-500/30 hover:decoration-emerald-400 transition-all">
                Create account
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
