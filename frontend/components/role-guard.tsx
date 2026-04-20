"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSession, subscribeSession, type UserRole, type SessionData } from "@/lib/auth";

type RoleGuardProps = {
  allowedRole: UserRole;
  children: (session: SessionData) => React.ReactNode;
};

export function RoleGuard({ allowedRole, children }: RoleGuardProps) {
  const router = useRouter();
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const missingToken = !session || !session.token;

  useEffect(() => {
    if (!session || !session.token) return;
    if (session.role !== "admin" && !session.emailVerified) {
      router.replace("/verify-email");
      return;
    }
    if (session.role !== allowedRole) {
      const dest = session.role === "admin" ? "/admin/dashboard" : session.role === "recruiter" ? "/recruiter/dashboard" : "/candidate/feed";
      router.replace(dest);
      return;
    }
  }, [allowedRole, router, session]);

  if (missingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertTitle>Phiên đăng nhập không tồn tại</AlertTitle>
          <AlertDescription>
            Bạn chưa đăng nhập hoặc token đã hết hạn. Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.
          </AlertDescription>
          <div className="mt-3">
            <Button onClick={() => router.push("/login")}>Đăng nhập</Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!session || session.role !== allowedRole) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }
  return <>{children(session)}</>;
}
