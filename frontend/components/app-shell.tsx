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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const hasInitializedNotificationWatermark = useRef(false);
  const lastSeenNotificationId = useRef(0);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!session || role === "admin") {
      setAvatarUrl(null);
      return;
    }

    let active = true;

    async function fetchAvatar() {
      try {
        if (role === "candidate") {
          const res = await apiRequest<{ avatar_url?: string } | null>("/candidate-profiles/me", { session });
          if (active) {
            setAvatarUrl(res?.data?.avatar_url || null);
          }
        } else if (role === "recruiter") {
          const res = await apiRequest<{ avatar_url?: string } | null>("/recruiter-profiles/mine", { session });
          if (active) {
            setAvatarUrl(res?.data?.avatar_url || null);
          }
        }
      } catch {
        if (active) setAvatarUrl(null);
      }
    }

    void fetchAvatar();
    return () => {
      active = false;
    };
  }, [session, role, pathname]);

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
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-zinc-900/80 bg-zinc-950/50 backdrop-blur-md select-none">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 shadow-inner">
            <Zap className="h-4 w-4 text-emerald-400 fill-emerald-400/5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-zinc-100">JobMatch AI</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Matching Engine</p>
          </div>
        </div>

        <div className="h-[1px] bg-zinc-900/80 mx-5" />

        <ScrollArea className="flex-1 px-3 py-4">
          <p className="mb-2.5 px-2 text-[10px] font-mono uppercase tracking-widest text-zinc-600">
            {role === "recruiter" ? "Recruiter console" : "Candidate portal"}
          </p>
          <nav className="space-y-1">
            {links.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium border transition-all duration-200",
                    active
                      ? "bg-zinc-900 border-zinc-800 text-zinc-100 shadow-sm shadow-black/20"
                      : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40",
                  )}
                >
                  <span className={cn("transition-colors", active ? "text-emerald-400" : "text-zinc-500")}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400" />
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <main className="flex h-screen flex-1 flex-col overflow-hidden bg-zinc-950">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-900/80 bg-zinc-950/80 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-4 w-4 text-zinc-500" />
            <h1 className="text-sm font-semibold tracking-tight text-zinc-200">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="capitalize text-[10px] font-mono text-zinc-400 border-zinc-800 bg-zinc-900/30 px-2 py-0.5">
              {role}
            </Badge>
            {userName && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 cursor-pointer">
                  <span className="text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition-colors hidden sm:inline">{userName}</span>
                  <Avatar className="h-7 w-7 border border-zinc-800">
                    {avatarUrl && (
                      <AvatarImage src={avatarUrl} alt={userName} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-zinc-900 text-[10px] font-bold text-zinc-300">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-850 text-zinc-200">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <p className="text-xs font-bold text-zinc-200">{userName}</p>
                      <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{session?.email}</p>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer text-xs focus:bg-zinc-800 focus:text-zinc-100 hover:bg-zinc-800"
                      onClick={() => {
                        const dest = role === "admin" ? "/admin/settings" : role === "recruiter" ? "/recruiter/settings" : "/candidate/settings";
                        router.push(dest);
                      }}
                    >
                      <Settings className="h-3.5 w-3.5 text-zinc-550" />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer text-xs focus:bg-zinc-800 focus:text-zinc-100 hover:bg-zinc-800"
                      onClick={() => {
                        clearSession();
                        router.replace("/login");
                      }}
                    >
                      <LogOut className="h-3.5 w-3.5 text-zinc-550" />
                      Log out
                    </DropdownMenuItem>
                    {role !== "admin" && (
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer text-xs text-rose-450 focus:text-rose-400 focus:bg-rose-950/20 hover:bg-rose-950/10"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Account
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950 select-text">{children}</div>
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
