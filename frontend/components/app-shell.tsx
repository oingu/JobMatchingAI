"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bookmark,
  Briefcase,
  Bell,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  User,
  Users,
  Rss,
  Activity,
  LogOut,
  Trash2,
  Zap,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import { clearSession, getSession, subscribeSession, type UserRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const recruiterNav: NavItem[] = [
  { href: "/recruiter/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/recruiter/jobs/new", label: "My Posts", icon: <Briefcase className="h-4 w-4" /> },
  { href: "/recruiter/applications", label: "Applications", icon: <FileText className="h-4 w-4" /> },
  { href: "/recruiter/profile", label: "My Profile", icon: <User className="h-4 w-4" /> },
  { href: "/recruiter/verification", label: "Verification", icon: <ShieldCheck className="h-4 w-4" /> },
  { href: "/recruiter/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
];

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/verifications", label: "Verifications", icon: <ShieldCheck className="h-4 w-4" /> },
  { href: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
];

const candidateNav: NavItem[] = [
  { href: "/candidate/feed", label: "Job Feed", icon: <Rss className="h-4 w-4" /> },
  { href: "/candidate/applications", label: "My Applications", icon: <FileText className="h-4 w-4" /> },
  { href: "/candidate/saved", label: "Saved Jobs", icon: <Bookmark className="h-4 w-4" /> },
  { href: "/candidate/profile", label: "My Profile", icon: <User className="h-4 w-4" /> },
  { href: "/candidate/activity", label: "Activity", icon: <Activity className="h-4 w-4" /> },
  { href: "/candidate/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
];

type AppShellProps = {
  role: UserRole;
  title: string;
  children: React.ReactNode;
};

export function AppShell({ role, title, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const links = role === "admin" ? adminNav : role === "recruiter" ? recruiterNav : candidateNav;
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const userName = session?.name ?? "";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const hasInitializedNotificationWatermark = useRef(false);
  const lastSeenNotificationId = useRef(0);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!session || role === "admin") return;
    const currentSession = session;
    let cancelled = false;

    async function pollNotifications() {
      try {
        const res = await apiRequest<{ user_id: number; notifications: Array<{ id: number; title: string; body: string; status: string; created_at: string | null }> }>(
          `/notifications/${currentSession.userId}?limit=10`,
          { session: currentSession },
        );
        const list = res.data.notifications ?? [];
        const maxId = list.reduce((max, n) => (n.id > max ? n.id : max), 0);

        // First poll only sets baseline to avoid toast spam on reload/tab switch.
        if (!hasInitializedNotificationWatermark.current) {
          hasInitializedNotificationWatermark.current = true;
          lastSeenNotificationId.current = Math.max(lastSeenNotificationId.current, maxId);
          return;
        }

        const target = role === "candidate" ? "/candidate/feed" : "/recruiter/dashboard";
        for (const n of list) {
          if (n.id <= lastSeenNotificationId.current) continue;
          const isMatching =
            n.title.toLowerCase().includes("matching") ||
            n.title.toLowerCase().includes("matched");
          if (!isMatching) continue;
          if (pathnameRef.current === target) continue;
          toast(n.title, "info", {
            actionLabel: "View",
            onAction: () => router.push(target),
          });
        }
        lastSeenNotificationId.current = Math.max(lastSeenNotificationId.current, maxId);
      } catch {
        // silent
      }
    }

    void pollNotifications();
    const timer = window.setInterval(() => {
      if (!cancelled) void pollNotifications();
    }, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [role, router, session, toast]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 flex-col border-r bg-card">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">JobMatch AI</p>
            <p className="text-[11px] text-muted-foreground">Intelligent Matching</p>
          </div>
        </div>

        <Separator />

        <ScrollArea className="flex-1 px-3 py-3">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {role === "recruiter" ? "Recruiter" : "Candidate"}
          </p>
          <nav className="space-y-1">
            {links.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

      </aside>

      {/* Main content */}
      <main className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="capitalize">
              {role}
            </Badge>
            {userName && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
                  <span className="text-sm font-medium text-foreground">{userName}</span>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <p className="text-sm font-medium">{userName}</p>
                      <p className="text-xs text-muted-foreground">{session?.email}</p>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer"
                      onClick={() => {
                        const dest = role === "admin" ? "/admin/settings" : role === "recruiter" ? "/recruiter/settings" : "/candidate/settings";
                        router.push(dest);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer"
                      onClick={() => {
                        clearSession();
                        router.replace("/login");
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                    {role !== "admin" && (
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Account
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>

      {/* Delete Account Confirmation */}
      <DeleteAccountDialog
        session={session}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}

function DeleteAccountDialog({
  session,
  open,
  onOpenChange,
}: {
  session: ReturnType<typeof getSession>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiRequest("/auth/account", { method: "DELETE", session });
      toastSuccess("Account deleted.");
      clearSession();
      router.replace("/login");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to delete account.");
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This action is permanent and cannot be undone. All your data including
            profile, jobs, recommendations, and notifications will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : "Yes, delete my account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
