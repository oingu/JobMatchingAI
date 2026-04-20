"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, RefreshCw, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import { getSession, setSession } from "@/lib/auth";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const session = typeof window !== "undefined" ? getSession() : null;

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.emailVerified) {
      router.replace(session.role === "recruiter" ? "/recruiter/dashboard" : "/candidate/feed");
    }
  }, [router, session]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join("");
    if (code.length !== 6) {
      toastError("Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("/auth/verify-email", {
        method: "POST",
        session,
        body: { otp: code },
      });
      setSuccess(true);
      if (session) {
        setSession({ ...session, emailVerified: true });
      }
      toastSuccess("Email verified successfully!");
      setTimeout(() => {
        router.replace(
          session?.role === "recruiter" ? "/recruiter/dashboard" : "/candidate/feed",
        );
      }, 1200);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Verification failed.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const res = await apiRequest<{ email_sent: boolean; already_verified?: boolean }>(
        "/auth/resend-otp",
        { method: "POST", session },
      );
      if (res.data.already_verified) {
        toastInfo("Your email is already verified!");
        if (session) setSession({ ...session, emailVerified: true });
        setTimeout(() => router.replace(session?.role === "recruiter" ? "/recruiter/dashboard" : "/candidate/feed"), 1000);
      } else if (res.data.email_sent) {
        toastSuccess("A new code has been sent to your email.");
      } else {
        toastInfo("SMTP not configured. Check server logs for the OTP code.");
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Resend failed.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            {success ? (
              <MailCheck className="h-5 w-5 text-primary-foreground" />
            ) : (
              <Zap className="h-5 w-5 text-primary-foreground" />
            )}
          </div>
          <CardTitle className="text-xl">
            {success ? "Email verified!" : "Verify your email"}
          </CardTitle>
          <CardDescription>
            {success
              ? "Redirecting you to the app..."
              : "Enter the 6-digit code sent to your email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* OTP inputs */}
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="h-12 w-11 rounded-lg border-2 border-input bg-transparent text-center text-xl font-bold transition-colors focus:border-primary focus:outline-none"
                  />
                ))}
              </div>


              <Button className="w-full" onClick={handleVerify} disabled={loading}>
                {loading ? "Verifying…" : "Verify Email"}
              </Button>

              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground"
                  onClick={handleResend}
                  disabled={resending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                  {resending ? "Sending…" : "Resend code"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
