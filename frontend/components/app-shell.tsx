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
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/contexts/LanguageContext";

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
  { href: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
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

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const { isConnected, lastMessage } = useWebSocket(session?.token || null);

  useEffect(() => {
    if (!session || role === "admin") return;
    let active = true;

    async function fetchUnreadCount() {
      try {
        const res = await apiRequest<{ unread_count: number }>("/messages/unread-count", { session });
        if (active) setUnreadCount(res.data.unread_count || 0);
      } catch {
        // silent
      }
    }
    
    async function fetchUnreadNotifCount() {
      try {
        const res = await apiRequest<{ unread_count: number }>(`/notifications/${session!.userId}/unread-count`, { session });
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-border/80 bg-background/50 backdrop-blur-md select-none">
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
                      ? "bg-accent border-border text-accent-foreground shadow-sm shadow-foreground/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40",
                  )}
                >
                  <span className={cn("transition-colors", active ? "text-emerald-500" : "text-muted-foreground")}>
                    {item.icon}
                  </span>
                  <span>
                    {/* Map English labels to keys manually or just use a generic mapping if possible,
                        but to be safe I will map them inline or let's assume we use keys in labels?
                        Wait, nav labels are hardcoded in the array above. Let's use a mapping function. 
                        Actually, let's map them by their English label. */}
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
      <main className="flex h-screen flex-1 flex-col overflow-hidden bg-background">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-background/80 px-6 backdrop-blur-md">
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
          <div className="flex items-center gap-4">
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
        <div className="flex-1 overflow-y-auto p-6 bg-background select-text">{children}</div>
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
