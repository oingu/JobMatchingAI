"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "next-view-transitions";
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
  CalendarDays,
  HelpCircle,
  Megaphone,
  Wand2,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUi } from "@/contexts/UiContext";

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
import { getSession, clearSession, subscribeSession, type UserRole } from "@/lib/auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const recruiterNav: NavItem[] = [
  { href: "/recruiter/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/recruiter/jobs/new", label: "My Posts", icon: <Megaphone className="h-4 w-4" /> },
  { href: "/recruiter/applications", label: "Applications", icon: <FileText className="h-4 w-4" /> },
  { href: "/recruiter/profile", label: "My Profile", icon: <User className="h-4 w-4" /> },
  { href: "/recruiter/verification", label: "Verification", icon: <ShieldCheck className="h-4 w-4" /> },
  { href: "/recruiter/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { href: "/recruiter/help", label: "Help & Support", icon: <HelpCircle className="h-4 w-4" /> },
];

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/verifications", label: "Verifications", icon: <ShieldCheck className="h-4 w-4" /> },
  { href: "/admin/recruiters", label: "Recruiters", icon: <Briefcase className="h-4 w-4" /> },
];

const candidateNav: NavItem[] = [
  { href: "/candidate/feed", label: "Job Feed", icon: <Rss className="h-4 w-4" /> },
  { href: "/candidate/applications", label: "My Applications", icon: <FileText className="h-4 w-4" /> },
  { href: "/candidate/interviews", label: "Interviews", icon: <CalendarDays className="h-4 w-4" /> },
  { href: "/candidate/saved", label: "Saved Jobs", icon: <Bookmark className="h-4 w-4" /> },
  { href: "/candidate/profile", label: "My Profile", icon: <User className="h-4 w-4" /> },
  { href: "/candidate/activity", label: "Activity", icon: <Activity className="h-4 w-4" /> },
  { href: "/candidate/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { href: "/candidate/help", label: "Help & Support", icon: <HelpCircle className="h-4 w-4" /> },
];

type AppShellProps = {
  role: UserRole;
  title: string;
  children: React.ReactNode;
};

// Persist the indicator position across remounts (page navigations)
let _prevIndicatorRect: { top: number; height: number } | null = null;

// Simple 30-second memory cache to prevent API spam on AppShell remounts during navigation
const appShellCache = new Map<string, { data: any; time: number }>();
async function fetchCached<T>(url: string, session: any) {
  const key = `${url}-${session?.token}`;
  const now = Date.now();
  const cached = appShellCache.get(key);
  if (cached && now - cached.time < 30000) {
    return cached.data as { data: T };
  }
  const res = await apiRequest<T>(url, { session });
  appShellCache.set(key, { data: res, time: now });
  return res;
}

function SlidingIndicator({ links, pathname }: { links: NavItem[]; pathname: string }) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const activeEl = document.querySelector(`[data-nav-href="${pathname}"]`) as HTMLElement | null;
    if (!activeEl) return;

    const nav = activeEl.closest("nav") as HTMLElement | null;
    if (!nav) return;

    const navRect = nav.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();

    const newTop = elRect.top - navRect.top;
    const newHeight = elRect.height;

    const pill = indicatorRef.current;
    const glow = glowRef.current;
    const edge = edgeRef.current;
    if (!pill || !glow || !edge) return;

    // If we have a previous position and it's different → slide from old to new
    if (_prevIndicatorRect && _prevIndicatorRect.top !== newTop && !hasAnimated.current) {
      // 1. Instantly set to the OLD position (no transition)
      const transition = "none";
      pill.style.transition = transition;
      glow.style.transition = transition;
      edge.style.transition = transition;

      pill.style.top = `${_prevIndicatorRect.top}px`;
      pill.style.height = `${_prevIndicatorRect.height}px`;
      glow.style.top = `${_prevIndicatorRect.top - 4}px`;
      glow.style.height = `${_prevIndicatorRect.height + 8}px`;
      edge.style.top = `${_prevIndicatorRect.top}px`;

      // 2. Force layout recalc, then animate to the NEW position
      pill.getBoundingClientRect(); // force reflow

      requestAnimationFrame(() => {
        const slide = "top 400ms cubic-bezier(0.34, 1.56, 0.64, 1), height 250ms ease";
        pill.style.transition = slide;
        glow.style.transition = slide;
        edge.style.transition = slide;

        pill.style.top = `${newTop}px`;
        pill.style.height = `${newHeight}px`;
        glow.style.top = `${newTop - 4}px`;
        glow.style.height = `${newHeight + 8}px`;
        edge.style.top = `${newTop}px`;
      });
    } else {
      // First load or same position — snap instantly
      pill.style.transition = "none";
      glow.style.transition = "none";
      edge.style.transition = "none";

      pill.style.top = `${newTop}px`;
      pill.style.height = `${newHeight}px`;
      glow.style.top = `${newTop - 4}px`;
      glow.style.height = `${newHeight + 8}px`;
      edge.style.top = `${newTop}px`;
    }

    hasAnimated.current = true;
    _prevIndicatorRect = { top: newTop, height: newHeight };
  }, [pathname, links]);

  return (
    <>
      {/* Glow layer */}
      <div
        ref={glowRef}
        className="absolute pointer-events-none rounded-xl"
        style={{
          left: -4,
          right: -4,
          opacity: 0.8,
          background: "radial-gradient(ellipse at 30% 50%, rgba(16,185,129,0.25) 0%, transparent 70%)",
          filter: "blur(10px)",
          zIndex: 0,
        }}
      />
      {/* Glass pill body */}
      <div
        ref={indicatorRef}
        className="absolute pointer-events-none rounded-lg"
        style={{
          left: 0,
          right: 0,
          opacity: 1,
          background: "linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--accent) / 0.85) 100%)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(16,185,129,0.3)",
          boxShadow: "0 2px 8px hsl(var(--foreground) / 0.08), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px hsl(var(--border))",
          zIndex: 0,
        }}
      />
      {/* Top edge highlight */}
      <div
        ref={edgeRef}
        className="absolute pointer-events-none rounded-t-lg"
        style={{
          left: 2,
          right: 2,
          height: 1,
          opacity: 0.9,
          background: "linear-gradient(90deg, transparent 5%, rgba(16,185,129,0.2) 30%, rgba(255,255,255,0.15) 50%, rgba(16,185,129,0.2) 70%, transparent 95%)",
          zIndex: 1,
        }}
      />
    </>
  );
}

export function AppShell({ role, title, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { t } = useLanguage();
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
          const res = await fetchCached<{ avatar_url?: string } | null>("/candidate-profiles/me", session);
          if (active) {
            setAvatarUrl(res?.data?.avatar_url || null);
          }
        } else if (role === "recruiter") {
          const res = await fetchCached<{ avatar_url?: string } | null>("/recruiter-profiles/mine", session);
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

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const { glassMode, setGlassMode } = useUi();

  const { isConnected, lastMessage } = useWebSocket(session?.token || null);

  useEffect(() => {
    if (!session || role === "admin") return;
    let active = true;

    async function fetchUnreadCount() {
      try {
        const res = await fetchCached<{ unread_count: number }>("/messages/unread-count", session);
        if (active) setUnreadCount(res.data.unread_count || 0);
      } catch {
        // silent
      }
    }
    
    async function fetchUnreadNotifCount() {
      try {
        const res = await fetchCached<{ unread_count: number }>(`/notifications/${session!.userId}/unread-count`, session);
        if (active) setUnreadNotifCount(res.data.unread_count || 0);
      } catch {
        // silent
      }
    }

    void fetchUnreadCount();
    void fetchUnreadNotifCount();

    return () => {
      active = false;
    };
  }, [session, role]);

  useEffect(() => {
    if (lastMessage) {
      window.dispatchEvent(new CustomEvent('ws-message', { detail: lastMessage }));
      
      if (lastMessage.type === "new_message") {
        setUnreadCount((c) => c + 1);
        const target = role === "candidate" ? "/candidate/applications" : "/recruiter/applications";
        if (pathnameRef.current !== target && !pathnameRef.current.includes("messages")) {
          toast("New Message Received", "info", {
            actionLabel: "View",
            onAction: () => router.push(target),
          });
        }
      } else if (lastMessage.type === "new_notification") {
        setUnreadNotifCount((c) => c + 1);
        const target = role === "candidate" ? "/candidate/feed" : "/recruiter/dashboard";
        
        const n = lastMessage.notification;
        const isMatching =
            n.title.toLowerCase().includes("matching") ||
            n.title.toLowerCase().includes("matched");
            
        if (isMatching && pathnameRef.current !== target) {
          toast(n.title, "info", {
            actionLabel: "View",
            onAction: () => router.push(target),
          });
        }
      }
    }
  }, [lastMessage, role, router, toast]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground relative">
      {/* Animated Mesh Gradient Background */}
      {glassMode && (
        <div className="mesh-bg">
          <div className="mesh-blob animate-blob bg-emerald-500 w-96 h-96 top-0 -left-10 mix-blend-screen dark:mix-blend-color-dodge" />
          <div className="mesh-blob animate-blob animation-delay-2000 bg-indigo-500 w-[500px] h-[500px] top-[20%] left-[30%] mix-blend-screen dark:mix-blend-color-dodge" />
          <div className="mesh-blob animate-blob animation-delay-4000 bg-purple-500 w-[400px] h-[400px] -bottom-20 -right-20 mix-blend-screen dark:mix-blend-color-dodge" />
        </div>
      )}

      {/* Sidebar */}
      <aside className={cn(
        "sticky top-0 z-20 flex h-screen w-60 flex-col border-r border-border/40 select-none shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-colors duration-300",
        glassMode ? "bg-background/30 backdrop-blur-3xl" : "bg-transparent hover:bg-accent/5 border border-border/40"
      )}>
        <div className="relative flex h-16 shrink-0 items-center gap-2.5 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card border border-border shadow-inner">
            <Zap className="h-4 w-4 text-emerald-500 fill-emerald-500/10" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-foreground">JobMatch AI</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Matching Engine</p>
          </div>
          {/* The line */}
          <div className="absolute bottom-0 left-5 right-5 h-[1px] bg-border/80" />
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <p className="mb-2.5 px-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80">
            {role === "recruiter" ? t("role.recruiter") : role === "candidate" ? t("role.candidate") : t("role.admin")}
          </p>
          <nav className="relative space-y-1">
            <SlidingIndicator links={links} pathname={pathname} />
            {links.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-nav-href={item.href}
                  className={cn(
                    "relative z-10 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium border transition-colors duration-200",
                    active
                      ? "border-transparent text-accent-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40",
                  )}
                >
                  <span className={cn("transition-colors", active ? "text-emerald-500" : "text-muted-foreground")}>
                    {item.icon}
                  </span>
                  <span>
                    {item.label === "Dashboard" ? t("nav.dashboard") :
                     item.label === "Jobs" ? t("nav.jobs") :
                     item.label === "Applications" || item.label === "My Applications" ? t("nav.applications") :
                     item.label === "Messages" ? t("nav.messages") :
                     item.label === "Profile" || item.label === "My Profile" ? t("nav.profile") :
                     item.label === "Job Feed" ? t("nav.feed") :
                     item.label === "Interviews" ? t("nav.interviews") :
                     item.label === "Saved Jobs" ? t("nav.saved") :
                     item.label === "Activity" ? t("nav.activity") :
                     item.label === "Notifications" ? t("nav.notifications") :
                     item.label === "Help & Support" ? t("nav.help") :
                     item.label === "My Posts" ? t("nav.posts") :
                     item.label === "Verification" ? t("nav.verification") :
                     item.label === "Verifications" ? t("nav.verifications") :
                     item.label === "Recruiters" ? t("nav.recruiters") :
                     item.label === "Users" ? t("nav.users") :
                     item.label}
                  </span>
                  {(item.label === "My Applications" || item.label === "Applications") && unreadCount > 0 && (
                    <span className="ml-auto flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                  {item.label === "Notifications" && unreadNotifCount > 0 && (
                    <span className="ml-auto flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
                      {unreadNotifCount}
                    </span>
                  )}
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
      <main className="flex h-screen flex-1 flex-col overflow-hidden bg-transparent z-10 relative">
        <header className={cn(
          "sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-border/40 px-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-colors duration-300",
          glassMode ? "bg-background/30 backdrop-blur-3xl" : "bg-transparent hover:bg-accent/5 border border-border/40"
        )}>
          <div className="flex items-center gap-3">
            {links.find((l) => l.href === pathname)?.icon || <Briefcase className="h-5 w-5 text-muted-foreground" />}
            {/* The title prop is translated here using the same mapping as the sidebar */}
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              {title === "Dashboard" ? t("nav.dashboard") :
               title === "Jobs" ? t("nav.jobs") :
               title === "Applications" || title === "My Applications" ? t("nav.applications") :
               title === "Messages" ? t("nav.messages") :
               title === "Profile" || title === "My Profile" ? t("nav.profile") :
               title === "Job Feed" ? t("nav.feed") :
               title === "Interviews" ? t("nav.interviews") :
               title === "Saved Jobs" ? t("nav.saved") :
               title === "Activity" ? t("nav.activity") :
               title === "Notifications" ? t("nav.notifications") :
               title === "Help & Support" ? t("nav.help") :
               title === "My Posts" ? t("nav.posts") :
               title === "Verification" ? t("nav.verification") :
               title === "Verifications" ? t("nav.verifications") :
               title === "Recruiters" ? t("nav.recruiters") :
               title === "Users" ? t("nav.users") :
               title}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setGlassMode(!glassMode)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-transparent hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
              title={glassMode ? "Disable Glass Effects" : "Enable Glass Effects"}
            >
              <Wand2 className={cn("h-4 w-4", glassMode ? "text-emerald-500" : "")} />
              <span className="sr-only">Toggle Glass Mode</span>
            </button>
            <LanguageToggle />
            <ThemeToggle />
            <Badge variant="outline" className="capitalize text-xs font-mono text-muted-foreground border-border bg-muted/30 px-2.5 py-0.5">
              {role === "recruiter" ? t("role.recruiter") : role === "candidate" ? t("role.candidate") : t("role.admin")}
            </Badge>
            {userName && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 cursor-pointer">
                  <span className="text-sm font-semibold text-foreground/90 hover:text-foreground transition-colors hidden sm:inline">{userName}</span>
                  <Avatar className="h-9 w-9 border border-border">
                    {avatarUrl && (
                      <AvatarImage src={avatarUrl} alt={userName} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-muted text-[10px] font-bold text-muted-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover border-border text-popover-foreground">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{userName}</p>
                        <p className="text-[11px] leading-none text-muted-foreground capitalize">
                          {role === "recruiter" ? t("role.recruiter") : role === "candidate" ? t("role.candidate") : t("role.admin")}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-xs font-medium"
                      onClick={() => {
                        if (session?.userId) {
                          router.push(`/${role}/public/${session.userId}`);
                        } else {
                          router.push(`/${role}/profile`);
                        }
                      }}
                    >
                      <User className="mr-2 h-3.5 w-3.5" />
                      {t("nav.profile")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-xs font-medium"
                      onClick={() => {
                        router.push(`/${role}/settings`);
                      }}
                    >
                      <Settings className="mr-2 h-3.5 w-3.5" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-xs font-medium text-destructive"
                      onClick={() => {
                        clearSession();
                        router.push("/login");
                      }}
                    >
                      <LogOut className="mr-2 h-3.5 w-3.5" />
                      {t("ui.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuGroup>
                    {role !== "admin" && (
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/20 hover:bg-destructive/10"
                        onSelect={(e) => {
                          e.preventDefault();
                          setDeleteDialogOpen(true);
                        }}
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
        <div className="flex-1 overflow-y-auto p-6 bg-transparent select-text">{children}</div>
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
  const { t } = useLanguage();
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
            <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
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
