import {
  type ComponentType,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  TableProperties,
  User,
  Video,
  X,
  XCircle,
  Snowflake,
  Lock,
  AlertTriangle,
} from "lucide-react";
import AcademicCalendarView from "./pages/academic-calendar";
import AnalyticsPage from "./pages/analytics";
import { LandingPage } from "./components/LandingPage";
import {
  getCalendarDayInfo,
  SISTEC_OFFICIAL_HOLIDAYS,
  isTeachingDay,
  getTeachingDayNumber,
} from "./data/sistec-calendar";
import {
  auth,
  db,
  signUpStudent,
  signInStudent,
  resetStudentPassword,
  logOutStudent,
  ensureSistecTimetableLoaded,
  ensurePythonTrainingLoaded,
  syncTimetableSlotTimings,
  buildDefaultSistecData,
  saveCompleteAttendanceRecord,
  type CompleteAttendancePayload,
  markSessionPresent,
  markSessionAbsent,
  recordSessionErpStatus,
  updateSessionNote,
  freezeClassSession,
  unfreezeClassSession,
  cancelClassSession,
  finalizeExpiredSessionsForStudent,
  computeAttendanceStats,
  formatDateKey,
  getWeekdayIST,
  TIMEZONE,
  handleFirestoreError,
  OperationType,
  isSessionFrozen,
  storage,
  resolveSessionEvidenceUrl,
  type StudentProfile,
  type SubjectItem,
  type TimetableItem,
  type ClassSessionItem,
  type AttendanceEventItem,
} from "./lib/firebase";
import { dataManager } from "./lib/data-manager";
import { setCachedStore } from "./lib/idb-cache";
import { computeFullAnalytics } from "./lib/analytics-calculator";
import { useCamera } from "./hooks/useCamera";
import {
  registerStudent,
  loginStudent,
  logoutStudentUser,
  getStoredActiveSession,
  type AppStudentUser,
} from "./lib/auth-service";
import { SISTEC_METADATA, SISTEC_TIME_SLOTS, PYTHON_TRAINING_SUBJECT } from "./data/sistec-timetable";
import { Button } from "@workspace/attendwise-design-system/components/ui/button";
import { Badge } from "@workspace/attendwise-design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/attendwise-design-system/components/ui/card";
import { Progress } from "@workspace/attendwise-design-system/components/ui/progress";
import { Input } from "@workspace/attendwise-design-system/components/ui/input";
import { Label } from "@workspace/attendwise-design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/attendwise-design-system/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/attendwise-design-system/components/ui/dialog";
import { Skeleton } from "@workspace/attendwise-design-system/components/ui/skeleton";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/attendwise-design-system/components/ui/alert";
import { Separator } from "@workspace/attendwise-design-system/components/ui/separator";
import { TooltipProvider } from "@workspace/attendwise-design-system/components/ui/tooltip";
import { Toaster } from "@workspace/attendwise-design-system/components/ui/toaster";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
  setDoc,
} from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dateFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const timeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const safeDate = (val?: unknown): Date | null => {
  if (val === null || val === undefined || val === "") return null;
  try {
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }
    const d = new Date(val as any);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const formatDate = (val?: unknown) => {
  try {
    const d = safeDate(val);
    return d ? dateFmt.format(d) : "—";
  } catch {
    return "—";
  }
};

const formatDateTime = (val?: unknown) => {
  try {
    const d = safeDate(val);
    return d ? `${dateTimeFmt.format(d)} IST` : "—";
  } catch {
    return "—";
  }
};

const formatTime = (val?: unknown) => {
  try {
    const d = safeDate(val);
    return d ? `${timeFmt.format(d)} IST` : "—";
  } catch {
    return "—";
  }
};

const formatClock = (val?: unknown): string => {
  if (val === null || val === undefined || val === "") return "—";
  try {
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return "—";
      return timeFmt.format(val);
    }
    if (typeof val === "number") {
      const d = new Date(val);
      if (isNaN(d.getTime())) return "—";
      return timeFmt.format(d);
    }
    const str = String(val).trim();
    // Handle standard HH:mm or HH:mm:ss format with optional AM/PM
    const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const meridiem = timeMatch[3]?.toUpperCase();
      if (meridiem === "PM" && h < 12) h += 12;
      if (meridiem === "AM" && h === 12) h = 0;
      if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const period = h >= 12 ? "PM" : "AM";
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        const minuteStr = m < 10 ? `0${m}` : `${m}`;
        return `${hour12}:${minuteStr} ${period}`;
      }
    }
    const d = safeDate(str);
    if (d) {
      return timeFmt.format(d);
    }
    return str || "—";
  } catch {
    return String(val || "—");
  }
};

// Continuous Live Clock synced to Indian Standard Time (IST)
function LiveServerClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  let timeStr = "";
  let dateStr = "";
  try {
    timeStr = new Intl.DateTimeFormat("en-IN", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(now);
    dateStr = new Intl.DateTimeFormat("en-IN", {
      timeZone: TIMEZONE,
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(now);
  } catch {
    timeStr = now.toLocaleTimeString("en-IN");
    dateStr = now.toLocaleDateString("en-IN");
  }

  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs"
        title="Live Indian Standard Time (IST)"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-mono text-xs font-semibold tracking-tight text-foreground">
          {timeStr}
        </span>
        <span className="text-[10px] text-muted-foreground font-semibold">IST</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-card/95 px-3 py-2 shadow-xs backdrop-blur-sm"
      title="Indian Standard Time (IST) - Authoritative Server Sync Clock"
    >
      <div className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Server Clock (IST)
          </span>
          <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
            REALTIME
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="font-mono text-xs sm:text-sm font-bold tracking-tight text-foreground">
            {timeStr}
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            · {dateStr}
          </span>
        </div>
      </div>
    </div>
  );
}

const asPct = (value: number | null | undefined) =>
  value === null || value === undefined ? "N/A" : `${Math.round(value)}%`;

const isSessionInWindow = (session: ClassSessionItem, nowMs: number = Date.now()) => {
  if (session.finalized || session.personalStatus === "cancelled" || isSessionFrozen(session)) return false;
  const startMs = new Date(session.scheduledStartAt).getTime();
  const endMs = new Date(session.scheduledEndAt).getTime();
  return !isNaN(startMs) && !isNaN(endMs) && nowMs >= startMs && nowMs < endMs;
};

const sessionStatusLabel = (session: ClassSessionItem, nowMs: number = Date.now()) => {
  if (isSessionFrozen(session)) return "Class Frozen (Excluded)";
  if (session.personalStatus === "cancelled") return "Cancelled";
  if (session.personalStatus === "present") return "Present";
  if (session.personalStatus === "absent") {
    return session.absentType === "manual_student" ? "Marked Absent by Student" : "Automatically Marked Absent";
  }
  if (isSessionInWindow(session, nowMs)) return "In Run";
  const endMs = new Date(session.scheduledEndAt).getTime();
  if (!isNaN(endMs) && nowMs >= endMs) {
    return "Automatically Marked Absent";
  }
  return "Upcoming";
};

function StateBadge({ status, children }: { status: string; children: ReactNode }) {
  const isFrozen = status === "frozen" || status === "Frozen" || status.includes("Frozen");
  const isPresent = status === "present" || status === "Present" || status === "match";
  const isAbsent = status === "absent" || status === "Absent" || status === "Automatically marked Absent" || status === "Marked Absent by Student" || status === "Automatically Marked Absent";
  const isInRun = status === "in_run" || status === "In Run";
  const isCancelled = status === "cancelled" || status === "Cancelled";
  const isDiscrepancy = status === "potential_discrepancy";

  const color = isFrozen
    ? "border-sky-500/40 bg-sky-500/15 text-sky-800 dark:text-sky-300 font-semibold"
    : isCancelled
    ? "border-slate-500/30 bg-slate-500/15 text-slate-700 dark:text-slate-300 font-medium"
    : isPresent
    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium"
    : isAbsent
    ? "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-400 font-medium"
    : isInRun
    ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold animate-pulse"
    : isDiscrepancy
    ? "border-chart-4/30 bg-chart-4/15 text-chart-4 font-medium"
    : "border-border bg-muted/40 text-muted-foreground";

  return <Badge variant="outline" className={color}>{children}</Badge>;
}

function LoadingBlock() {
  return (
    <div className="space-y-4" aria-label="Loading">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/40 px-5 py-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-primary">
        <BookOpen className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

// Protected Application Shell
function Shell({
  children,
  profile,
  onLogout,
}: {
  children: ReactNode;
  profile?: StudentProfile | null;
  onLogout: () => void;
}) {
  const [path] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const navItems = [
    { href: "/dashboard", title: "Dashboard", icon: LayoutDashboard },
    { href: "/analytics", title: "Analytics", icon: BarChart3 },
    { href: "/timetable", title: "My Timetable", icon: CalendarDays },
    { href: "/calendar", title: "Academic Calendar", icon: CalendarRange },
    { href: "/history", title: "Attendance History", icon: Activity },
    { href: "/subjects", title: "Subjects", icon: BookOpen },
    { href: "/comparison", title: "ERP Comparison", icon: TableProperties },
    { href: "/profile", title: "Profile & Settings", icon: Settings },
  ];

  const initials =
    profile?.displayName
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST";

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <aside
        className={`${
          mobileNav ? "block" : "hidden"
        } fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-800 bg-slate-950 p-6 md:sticky md:top-0 md:block md:h-screen md:w-64 md:shrink-0 flex flex-col justify-between`}
      >
        <div>
          <Link href="/dashboard" className="mb-10 flex items-center gap-3 font-semibold text-white" data-testid="link-brand">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
              <GraduationCap className="h-6 w-6 text-white" />
            </span>
            <div className="min-w-0">
              <span className="text-lg font-bold tracking-tight block leading-tight">AttendWise</span>
              <span className="block text-[11px] font-normal text-indigo-300 truncate">
                SISTec · AIDS 3 Sem
              </span>
            </div>
          </Link>
          <nav className="space-y-1.5" aria-label="Main navigation">
            {navItems.map(({ href, title, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileNav(false)}
                data-testid={`link-nav-${href.slice(1)}`}
                className={`flex min-h-11 items-center gap-3 rounded-2xl px-4 text-sm font-medium transition-all duration-200 ${
                  path === href || (href === "/history" && path.startsWith("/session/"))
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {title}
              </Link>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-medium text-emerald-400 mb-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Firebase Synced</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              Real-time Firestore storage. Timetable sourced from SISTec 16/10/2026 report.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-inner">
          <div className="min-w-0 flex-1 mr-2">
            <p className="truncate text-xs font-semibold text-white">{profile?.displayName || "Student"}</p>
            <p className="truncate text-[10px] text-slate-400">{profile?.email || "Authenticated"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            title="Sign out"
            onClick={onLogout}
            data-testid="button-exit-demo"
            className="text-slate-400 hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {mobileNav ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-foreground/30 md:hidden"
          onClick={() => setMobileNav(false)}
        />
      ) : null}

      <div className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden text-sm text-muted-foreground sm:block">
              AttendWise <span className="px-1">/</span>{" "}
              <span className="text-foreground font-medium">
                {navItems.find((item) => item.href === path)?.title ?? "Session details"}
              </span>
            </div>
            <Badge variant="outline" className="sm:hidden font-mono text-[10px]">
              SISTec AIDS
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <LiveServerClock compact />
            </div>
            <Link href="/profile" className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/20 text-sm font-semibold text-primary"
                aria-label="Student profile"
              >
                {initials}
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-7 sm:py-8 flex-1">{children}</main>
        <footer className="px-4 py-4 text-center text-xs text-muted-foreground sm:px-7 border-t">
          AttendWise is an authenticated student tracking companion for SISTec (AIDS 3rd Sem). Records do not replace official college ERP logs.
        </footer>
      </div>
    </div>
  );
}

// Authentication & Welcome Screen
function AuthWelcome({ onAuthSuccess }: { onAuthSuccess: (user?: any) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMsg("");
    setPending(true);
    try {
      let loggedUser = null;
      if (mode === "signup") {
        const res = await registerStudent(email, password, name);
        if (res.message) setInfoMsg(res.message);
        loggedUser = res.user;
      } else {
        const res = await loginStudent(email, password);
        if (res.message) setInfoMsg(res.message);
        loggedUser = res.user;
      }
      onAuthSuccess(loggedUser || auth.currentUser);
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Check your credentials.");
    } finally {
      setPending(false);
    }
  };

  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    try {
      await resetStudentPassword(resetEmail.trim());
      setResetMsg(`Password reset link sent to ${resetEmail}. Check your inbox.`);
    } catch (err: any) {
      setResetMsg(err?.message?.replace(/^Firebase:\s*/, "") || "Could not send reset email.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        <section className="order-2 text-center lg:order-1 lg:text-left">
          <div className="mb-6 inline-flex items-center gap-3 font-semibold">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <GraduationCap className="h-7 w-7" />
            </span>
            <div>
              <span className="text-2xl font-bold tracking-tight block">AttendWise</span>
              <span className="text-xs text-muted-foreground font-normal">College Attendance Companion</span>
            </div>
          </div>

          <Badge variant="outline" className="mb-4 bg-muted/50 border-secondary/30">
            SISTec Gandhinagar · AIDS 3 SEM 2 YR
          </Badge>

          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl text-foreground">
            Your attendance,<br className="hidden sm:block" /> organized and verified.
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-sm sm:text-base leading-relaxed text-muted-foreground lg:mx-0">
            Track daily class slots, log exact attendance during scheduled lecture intervals, and compare personal records with your college ERP.
          </p>

          <Card className="mt-8 text-left max-w-md mx-auto lg:mx-0 shadow-sm border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {mode === "signin" ? "Student Sign In" : "Create Student Account"}
                </CardTitle>
                <button
                  type="button"
                  className="text-xs text-primary font-medium hover:underline"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError("");
                    setInfoMsg("");
                  }}
                >
                  {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {error ? (
                <Alert variant="destructive" className="mb-4 py-2.5 text-xs">
                  <CircleAlert className="h-4 w-4" />
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              ) : null}

              {infoMsg ? (
                <Alert className="mb-4 py-2.5 text-xs bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <AlertDescription>{infoMsg}</AlertDescription>
                </Alert>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === "signup" ? (
                  <div className="space-y-1">
                    <Label htmlFor="auth-name" className="text-xs">Full Name</Label>
                    <Input
                      id="auth-name"
                      placeholder="e.g. Praneet Soni"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                ) : null}

                <div className="space-y-1">
                  <Label htmlFor="auth-email" className="text-xs">College Email</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder="student@sistec.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="auth-pass" className="text-xs">Password</Label>
                    {mode === "signin" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email);
                          setResetMsg("");
                          setResetOpen(true);
                        }}
                        className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    ) : null}
                  </div>
                  <Input
                    id="auth-pass"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                <Button type="submit" disabled={pending} className="w-full mt-3 font-medium">
                  {pending ? "Authenticating…" : mode === "signin" ? "Sign In with Email & Password" : "Sign Up with College Email"}
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="order-1 mx-auto w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm lg:order-2">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">SISTec Bhopal</p>
              <p className="text-sm font-medium">AIDS 3 SEM 2 YR Schedule</p>
            </div>
            <CalendarDays className="h-5 w-5 text-secondary" />
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="rounded-lg bg-muted/60 p-3 text-xs">
              <span className="font-semibold text-foreground">6 Slots per Day · IST:</span>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>• P1: 9:35 AM – 10:35 AM</li>
                <li>• P2: 10:35 AM – 11:35 AM</li>
                <li>• P3: 11:35 AM – 12:35 PM</li>
                <li>• P4: 12:35 PM – 1:35 PM</li>
                <li>• Lunch Break: 1:35 PM – 2:10 PM</li>
                <li>• P5: 2:10 PM – 3:10 PM</li>
                <li>• P6: 3:10 PM – 4:10 PM</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border bg-card p-2.5 text-xs">
                <div>
                  <span className="font-semibold">AD-302</span> Probability & Statistics
                  <span className="block text-[11px] text-muted-foreground">Theory · Mon/Tue/Wed/Thu</span>
                </div>
                <Badge variant="outline" className="text-[10px]">Theory</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-card p-2.5 text-xs">
                <div>
                  <span className="font-semibold">AD-305</span> Object Oriented Programming
                  <span className="block text-[11px] text-muted-foreground">Practical · Consecutive slots</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-secondary/10 text-secondary">Practical</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-card p-2.5 text-xs">
                <div>
                  <span className="font-semibold">AD-304</span> Artificial Intelligence
                  <span className="block text-[11px] text-muted-foreground">Theory & Practical labs</span>
                </div>
                <Badge variant="outline" className="text-[10px]">Theory / Lab</Badge>
              </div>
            </div>
          </div>

          <p className="mt-5 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            Your data is stored securely in Firebase under your authenticated student account.
          </p>
        </section>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your college email address to receive a secure password reset link from Firebase.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="student@sistec.ac.in"
                required
              />
            </div>
            {resetMsg ? (
              <p className="text-xs text-muted-foreground leading-relaxed">{resetMsg}</p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                Close
              </Button>
              <Button type="submit">Send Reset Email</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

// Summary metric card
function SummaryCard({
  title,
  percentage,
  note,
  icon: Icon,
  color,
}: {
  title: string;
  percentage: number | null;
  note: string;
  icon: typeof Activity;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{asPct(percentage)}</p>
          </div>
          <span className={`rounded-lg p-2.5 ${color}`}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
        {percentage !== null ? (
          <Progress className="mt-4" value={percentage} aria-label={`${title} progress`} />
        ) : (
          <p className="mt-4 text-xs font-medium text-muted-foreground">No finalized classes yet</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function SessionLink({ session }: { session: ClassSessionItem }) {
  const status = sessionStatusLabel(session);
  return (
    <Link
      href={`/session/${session.id}`}
      className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60"
      data-testid={`link-session-${session.id}`}
    >
      <div className="hidden h-9 w-1 shrink-0 rounded-full bg-secondary sm:block" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="truncate text-sm font-semibold">{session.subjectName}</p>
          <Badge variant="outline" className="text-[10px] font-mono">
            {session.subjectCode}
          </Badge>
          {session.academicDayNumber ? (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              Day {session.academicDayNumber}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {session.slot ? `${session.slot} · ` : ""}
          {formatDate(session.scheduledDate)} · {formatTime(session.scheduledStartAt)} –{" "}
          {formatTime(session.scheduledEndAt)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <StateBadge status={session.personalStatus}>{status}</StateBadge>
        {session.erpStatus ? (
          <Badge
            variant="outline"
            className={
              session.erpStatus === "Present"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[10px] font-medium"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 text-[10px] font-medium"
            }
          >
            ERP {session.erpStatus}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground">ERP Not Recorded</span>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// Durable evidence snapshot thumbnail with capture timestamp for attendance cards
function EvidenceSnapshotThumbnail({
  session,
  onViewImage,
}: {
  session: ClassSessionItem;
  onViewImage?: (url: string, captureTime?: string | null, session?: ClassSessionItem) => void;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(session.photoDataUrl || null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (session.photoDataUrl && (session.photoDataUrl.startsWith("http") || session.photoDataUrl.startsWith("data:"))) {
      setResolvedUrl(session.photoDataUrl);
      return;
    }
    if ((session.evidenceStoragePath || session.evidenceAvailable) && !resolvedUrl) {
      setLoading(true);
      resolveSessionEvidenceUrl(session.studentId || auth.currentUser?.uid || "", session)
        .then((url) => {
          if (isMounted) {
            if (url) {
              setResolvedUrl(url);
            } else {
              setLoadError(true);
            }
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setLoadError(true);
            setLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [session.id, session.photoDataUrl, session.evidenceStoragePath, session.evidenceAvailable]);

  const hasEvidence = Boolean(
    session.evidenceAvailable || session.photoDataUrl || session.evidenceStoragePath || resolvedUrl
  );

  if (!hasEvidence) return null;

  const captureTime = session.clientCaptureAt || session.serverReceiptAt;
  const timeFormatted = captureTime ? `${formatTime(captureTime)}` : "Verified time";

  return (
    <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-2 text-xs">
      {loading ? (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/15">
          <Camera className="h-4 w-4 animate-pulse text-emerald-600" />
        </div>
      ) : resolvedUrl && !loadError ? (
        <img
          src={resolvedUrl}
          alt="Verified camera snapshot"
          className="h-12 w-12 shrink-0 rounded-md object-cover border border-emerald-500/30 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onViewImage?.(resolvedUrl, captureTime, session)}
          onError={() => setLoadError(true)}
          title="Click to view full photo evidence"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/15 text-emerald-700">
          <Camera className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
          <Camera className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">Camera Snapshot Evidence</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          Captured: <strong className="text-foreground font-medium">{timeFormatted}</strong>
        </p>
      </div>
      {resolvedUrl && !loadError ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[10px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
          onClick={() => onViewImage?.(resolvedUrl, captureTime, session)}
        >
          View
        </Button>
      ) : null}
    </div>
  );
}

// Compact photo evidence indicator with timestamp for table/list views
function EvidenceSnapshotRow({
  session,
  onViewImage,
}: {
  session: ClassSessionItem;
  onViewImage?: (url: string, captureTime?: string | null, session?: ClassSessionItem) => void;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(session.photoDataUrl || null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (session.photoDataUrl && (session.photoDataUrl.startsWith("http") || session.photoDataUrl.startsWith("data:"))) {
      setResolvedUrl(session.photoDataUrl);
      return;
    }
    if ((session.evidenceStoragePath || session.evidenceAvailable) && !resolvedUrl) {
      resolveSessionEvidenceUrl(session.studentId || auth.currentUser?.uid || "", session)
        .then((url) => {
          if (isMounted && url) setResolvedUrl(url);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [session.id, session.photoDataUrl, session.evidenceStoragePath, session.evidenceAvailable]);

  const hasEvidence = Boolean(
    session.evidenceAvailable || session.photoDataUrl || session.evidenceStoragePath || resolvedUrl
  );
  if (!hasEvidence) return null;

  const captureTime = session.clientCaptureAt || session.serverReceiptAt;

  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      {resolvedUrl && !loadError ? (
        <img
          src={resolvedUrl}
          alt="Evidence thumbnail"
          className="h-8 w-8 rounded object-cover border border-emerald-500/30 cursor-pointer shrink-0 hover:opacity-90"
          onClick={() => onViewImage?.(resolvedUrl, captureTime, session)}
          onError={() => setLoadError(true)}
          title="Click to view photo evidence"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/15 text-emerald-700">
          <Camera className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
        <Camera className="h-3 w-3 text-emerald-600" />
        <span>Photo Proof</span>
        {captureTime ? (
          <span className="text-muted-foreground font-normal">
            · {formatTime(captureTime)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

// Full view dialog for photo evidence
function PhotoEvidenceModal({
  photoInfo,
  onClose,
}: {
  photoInfo: { url: string; captureTime?: string | null; session?: ClassSessionItem } | null;
  onClose: () => void;
}) {
  if (!photoInfo) return null;

  return (
    <Dialog open={Boolean(photoInfo)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 sm:rounded-2xl overflow-hidden">
        <DialogHeader className="p-4 bg-muted/30 border-b">
          <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-emerald-600" />
            Verified Camera Snapshot Evidence
          </DialogTitle>
          {photoInfo.session && (
            <DialogDescription className="text-xs text-muted-foreground">
              {photoInfo.session.subjectName} ({photoInfo.session.slot}) · {formatDate(photoInfo.session.scheduledDate)}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="p-4 space-y-3">
          <img
            src={photoInfo.url}
            alt="Verified attendance snapshot proof"
            className="w-full max-h-80 object-contain rounded-xl border bg-black/5"
          />
          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Capture Instant:</span>
              <span className="font-semibold text-foreground">
                {photoInfo.captureTime ? formatDateTime(photoInfo.captureTime) : "Recorded at attendance time"}
              </span>
            </div>
            {photoInfo.session?.room && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium text-foreground">Room {photoInfo.session.room}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Integrity:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Permanent Firebase Storage
              </span>
            </div>
          </div>
        </div>
        <DialogFooter className="p-3 border-t bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Interactive Attendance Card Dialog matching "Live Class Attendance" & "Attendance Details" mockup
function AttendanceCardDialog({
  open,
  onOpenChange,
  session: initialSession,
  sessions,
  user,
  onRecordErp,
  onMarkPresent,
  onMarkAbsent,
  onFreezeClass,
  onSaveCompleteAttendance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ClassSessionItem | null;
  sessions?: ClassSessionItem[];
  user: { uid: string; email?: string | null; displayName?: string | null };
  onRecordErp?: (sessionId: string, status: "Present" | "Absent") => Promise<void>;
  onMarkPresent?: (sessionId: string, photoUrl?: string, note?: string, capturedAt?: string) => Promise<void>;
  onMarkAbsent?: (sessionId: string, note?: string) => Promise<void>;
  onFreezeClass?: (sessionId: string, reason?: string) => Promise<void>;
  onSaveCompleteAttendance?: (sessionId: string, payload: CompleteAttendancePayload) => Promise<void>;
}) {
  // Always derive the most authoritative, live session state from the parent sessions listener
  const session = initialSession
    ? (sessions?.find((s) => s.id === initialSession.id) || initialSession)
    : null;

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<AttendanceEventItem[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState(session?.note || "");
  const [freezeReasonInput, setFreezeReasonInput] = useState(session?.freezeReason || "");
  const [evidencePhotoUrl, setEvidencePhotoUrl] = useState<string | null>(null);
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedPhotoAt, setCapturedPhotoAt] = useState<string | null>(null);
  const prevSessionIdRef = useRef<string | null>(null);
  
  const { 
    videoRef, 
    stream, 
    startCamera, 
    stopCamera, 
    cameraError, 
    isLoading: cameraLoading 
  } = useCamera({ idealFacingMode: "user" });

  useEffect(() => {
    if (!open || !session) {
      setEvidencePhotoUrl(null);
      return;
    }
    // Directly use photo data URL from document if available
    if (session.photoDataUrl) {
      setEvidencePhotoUrl(session.photoDataUrl);
      return;
    }
    if (!session.evidenceAvailable && !session.evidenceStoragePath) {
      setEvidencePhotoUrl(null);
      return;
    }
    if (!user || !auth.currentUser) return;

    const fetchEvidence = async () => {
      try {
        const resolved = await resolveSessionEvidenceUrl(user.uid, session);
        if (resolved) {
          setEvidencePhotoUrl(resolved);
          return;
        }
        const metaSnap = await getDoc(doc(db, "users", user.uid, "evidenceMetadata", `meta-${session.id}`));
        if (metaSnap.exists()) {
          const data = metaSnap.data();
          if (data?.dataUrl) {
            setEvidencePhotoUrl(data.dataUrl);
          }
        }
      } catch (e) {
        console.warn("Could not load evidence metadata:", e);
      }
    };
    fetchEvidence();
  }, [open, session?.id, session?.photoDataUrl, session?.evidenceAvailable, session?.evidenceStoragePath, user?.uid]);

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(videoRef.current.videoWidth || 320, 320);
    canvas.height = Math.min(videoRef.current.videoHeight || 240, 240);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
      const captureInstant = new Date().toISOString();
      setCapturedPhotoUrl(dataUrl);
      setCapturedPhotoAt(captureInstant);
    }
    stopCamera();
  };

  const [stagedPersonalStatus, setStagedPersonalStatus] = useState<string | null>(null);
  const [stagedErpStatus, setStagedErpStatus] = useState<string | null>(null);
  const [stagedNote, setStagedNote] = useState<string>("");

  useEffect(() => {
    if (!open) {
      prevSessionIdRef.current = null;
      setCapturedPhotoUrl(null);
      setCapturedPhotoAt(null);
      setStagedPersonalStatus(null);
      setStagedErpStatus(null);
      setStagedNote("");
      setFreezeReasonInput("");
      setConfirmFreeze(false);
      stopCamera();
      return;
    }

    if (session && session.id !== prevSessionIdRef.current) {
      prevSessionIdRef.current = session.id;
      setCapturedPhotoUrl(session.photoDataUrl || null);
      setCapturedPhotoAt(session.clientCaptureAt || null);
      setStagedPersonalStatus(session.personalStatus);
      setStagedErpStatus(session.erpStatus);
      setStagedNote(session.note || "");
      setNoteInput(session.note || "");
      setFreezeReasonInput(session.freezeReason || "");
      setConfirmFreeze(false);
    }
  }, [open, session?.id, stopCamera]);

  const todayKey = formatDateKey(new Date());
  const nowMs = Date.now();
  const startMs = session ? new Date(session.scheduledStartAt).getTime() : 0;
  const endMs = session ? new Date(session.scheduledEndAt).getTime() : 0;
  const isP7 = session?.slot === "P7" || session?.subjectCode === "TEST-P7" || session?.subjectId === "sub-test-class-p7";
  const isToday = session?.scheduledDate === todayKey || (isP7 && nowMs >= startMs && nowMs < endMs);

  const isFrozen = stagedPersonalStatus === "frozen" || isSessionFrozen(session);
  const isPresentAlready = session?.personalStatus === "present";
  const isHistoricalTraining = Boolean(session?.isSpecialTraining || session?.subjectId === PYTHON_TRAINING_SUBJECT.id);
  const inWindow = Boolean(
    session && !session.finalized && !isPresentAlready && (
      isHistoricalTraining || ((isToday || isP7) && nowMs >= startMs && nowMs < endMs)
    )
  );
  const isWindowOverdue = Boolean(
    session && !isPresentAlready && !isHistoricalTraining && (session.personalStatus === "absent" || ((isToday || isP7) && nowMs >= endMs))
  );

  // Active window countdown
  useEffect(() => {
    if (!open || !session || !inWindow) {
      setSecondsRemaining(null);
      return;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [open, session?.id, inWindow, endMs]);

  // Clean camera stream on modal close
  useEffect(() => {
    if (!open) {
      stopCamera();
      setNotice(null);
      setError(null);
      setCapturedPhotoUrl(null);
      setCapturedPhotoAt(null);
    }
  }, [open, stopCamera]);

  // Listen to authoritative attendance events in Firestore
  useEffect(() => {
    if (!open || !session || !user || !auth.currentUser) return;
    const q = collection(db, "users", user.uid, "attendanceEvents");
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AttendanceEventItem[] = [];
        snap.forEach((d) => {
          const item = d.data() as AttendanceEventItem;
          if (item.sessionId === session.id) list.push(item);
        });
        list.sort(
          (a, b) => new Date(b.serverTimestamp).getTime() - new Date(a.serverTimestamp).getTime()
        );
        setEvents(list);
      },
      () => {}
    );
    return () => unsub();
  }, [open, session?.id, user?.uid]);

  const handleStagePresent = () => {
    if (isPresentAlready) return;
    setStagedPersonalStatus("present");
    setNotice("Staged: AttendWise attendance marked Present. Click 'Save Status' below to commit.");
    setError(null);
  };

  const handleStageAbsent = () => {
    if (isPresentAlready) return;
    setStagedPersonalStatus("absent");
    setNotice("Staged: AttendWise attendance marked Absent by student. Click 'Save Status' below to commit.");
    setError(null);
  };

  const handleStageErp = (status: "Present" | "Absent") => {
    if (session?.erpStatus) return;
    setStagedErpStatus(status);
    setNotice(`Staged: ERP status recorded as ${status}. Click 'Save Status' below to commit.`);
    setError(null);
  };

  const handleStageNote = () => {
    if (!noteInput.trim()) return;
    setStagedNote(noteInput.trim());
    setNotice("Staged: Keynote note added. Click 'Save Status' below to commit.");
    setError(null);
  };

  const handleSaveAllStatus = async () => {
    if (!session || !user) return;
    setBusy(true);
    setError(null);
    setNotice("Committing attendance, photo proof & ERP to Cloud Firestore...");
    try {
      const finalNote = stagedNote.trim() || noteInput.trim() || undefined;

      // Determine target personal status:
      // If student actively staged "present" and it wasn't already present, send "present".
      // If student actively staged "absent" and it wasn't already absent, send "absent".
      // If session was ALREADY "present", keep "present".
      // If session was ALREADY "absent", keep "absent".
      // If student did NOT select/stage personal attendance (e.g. only saving keynote or ERP), send undefined!
      let targetPersonalStatus: "present" | "absent" | undefined = undefined;
      if (stagedPersonalStatus === "present" && session.personalStatus !== "present") {
        targetPersonalStatus = "present";
      } else if (stagedPersonalStatus === "absent" && session.personalStatus !== "absent") {
        targetPersonalStatus = "absent";
      } else if (session.personalStatus === "present") {
        targetPersonalStatus = "present";
      } else if (session.personalStatus === "absent") {
        targetPersonalStatus = "absent";
      }

      const payload: CompleteAttendancePayload = {
        personalStatus: targetPersonalStatus,
        erpStatus: (stagedErpStatus as any) || undefined,
        note: finalNote,
        photoDataUrl: capturedPhotoUrl || undefined,
        clientCapturedAt: capturedPhotoAt || undefined,
      };

      if (onSaveCompleteAttendance) {
        await onSaveCompleteAttendance(session.id, payload);
      } else {
        await saveCompleteAttendanceRecord(user.uid, session.id, payload);
      }

      setNotice("Cloud Verified: Attendance, photo proof & ERP permanently saved in Firestore!");
      setTimeout(() => {
        onOpenChange(false);
      }, 700);
    } catch (err: any) {
      setError(err?.message || "Could not save attendance to cloud.");
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  const countdownText =
    secondsRemaining !== null
      ? `${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s`
      : null;

  const currentStatusLabel = isFrozen ? "Class Frozen (Excluded)" : sessionStatusLabel(session);

  // Each of the 4 inputs can independently trigger unsaved changes:
  // 1. Personal status (AttendWise) staged
  // 2. ERP status staged
  // 3. Note / keynote typed or staged
  // 4. Photo captured
  const hasPersonalStatusChange = Boolean(
    stagedPersonalStatus &&
    stagedPersonalStatus !== session.personalStatus &&
    (!isPresentAlready || stagedPersonalStatus === "present") &&
    (stagedPersonalStatus === "present" || stagedPersonalStatus === "absent")
  );
  const hasErpStatusChange = Boolean(
    stagedErpStatus &&
    stagedErpStatus !== session.erpStatus &&
    session.erpStatus === null
  );
  const currentNoteVal = (stagedNote.trim() || noteInput.trim());
  const hasNoteChange = Boolean(
    currentNoteVal &&
    currentNoteVal !== (session.note || "").trim() &&
    !session.note
  );
  const hasPhotoChange = Boolean(
    capturedPhotoUrl &&
    capturedPhotoUrl !== session.photoDataUrl
  );

  const hasUnsavedChanges = Boolean(
    hasPersonalStatusChange || hasErpStatusChange || hasNoteChange || hasPhotoChange
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-2xl">
        {/* Header matching Live Class Attendance mockup */}
        <div className="border-b bg-muted/30 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex h-6 w-9 items-center justify-center rounded-md bg-primary/10 text-primary font-mono font-bold text-xs">
                  {session.slot}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {session.category} · {session.room ? `Room ${session.room}` : "SISTec Campus"}
                </span>
              </div>
              <DialogTitle className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight">
                {session.subjectName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                <span className="font-mono">{session.subjectCode}</span>
                <span>·</span>
                <span>Scheduled: {formatClock(session.scheduledStartAt)} – {formatClock(session.scheduledEndAt)} IST</span>
              </DialogDescription>
            </div>
            <div className="shrink-0">
              <StateBadge status={currentStatusLabel}>{currentStatusLabel}</StateBadge>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {notice ? (
            <Alert className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="font-medium">{notice}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="text-xs">
              <CircleAlert className="h-4 w-4" />
              <AlertDescription className="font-medium">{error}</AlertDescription>
            </Alert>
          ) : null}

          {/* Live countdown or status banner */}
          {isFrozen ? null : isPresentAlready ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-xs sm:text-sm">
                <Check className="h-4 w-4 text-emerald-600" />
                Attendance Finalized & Locked (Present)
              </div>
              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                Authoritative server timestamp verified: <strong>{session.serverReceiptAt ? `${formatClock(session.serverReceiptAt)} IST` : "Verified"}</strong>
              </p>
            </div>
          ) : inWindow ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                Live Class Active (In Run)
              </div>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Live countdown until the window closes: <strong className="font-mono text-sm">{countdownText}</strong>
              </p>
            </div>
          ) : isToday && !session.finalized && nowMs < startMs ? (
            <div className="rounded-xl border bg-muted/40 p-3.5 text-center text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              Upcoming class · Attendance window opens at <strong>{formatClock(session.scheduledStartAt)} IST</strong>
            </div>
          ) : null}

          {/* AttendWise Application Attendance */}
          <div className="rounded-xl border p-4 bg-card/60 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold">AttendWise Application Attendance</h4>
                  <p className="text-[11px] text-muted-foreground">Authoritative verified attendance record</p>
                </div>
              </div>
              <div>
                {isFrozen ? (
                  <Badge className="bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30 text-xs">
                    <Snowflake className="h-3 w-3 mr-1" /> Class Frozen (Excluded)
                  </Badge>
                ) : session.personalStatus === "present" ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                    <Check className="h-3 w-3 mr-1" /> Present (Locked)
                  </Badge>
                ) : stagedPersonalStatus === "present" ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                    <Check className="h-3 w-3 mr-1" /> Present (Staged / Locked)
                  </Badge>
                ) : stagedPersonalStatus === "absent" ? (
                  <Badge variant="destructive" className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs">
                    <X className="h-3 w-3 mr-1" /> Marked Absent by Student (Staged)
                  </Badge>
                ) : session.personalStatus === "absent" || isWindowOverdue ? (
                  <Badge variant="destructive" className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs">
                    <X className="h-3 w-3 mr-1" /> {session.absentType === "manual_student" ? "Marked Absent by Student" : "Automatically Marked Absent"}
                  </Badge>
                ) : inWindow ? (
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-xs animate-pulse">
                    In Run · Window Open
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Upcoming
                  </Badge>
                )}
              </div>
            </div>

            {/* If class is frozen, show permanent cancellation notice */}
            {isFrozen ? (
              <div className="rounded-xl border p-4 bg-sky-50/80 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Snowflake className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  <span>Class Is Freezed (Permanently Cancelled)</span>
                </div>
                <p className="text-xs text-sky-800/90 dark:text-sky-300/90 leading-relaxed">
                  This class session is frozen and treated as cancelled. It has been completely excluded from all attendance calculations, percentages, subject totals, and college dashboards.
                </p>
                <div className="flex items-center gap-2 text-[11px] font-medium text-sky-700 dark:text-sky-400 pt-1 border-t border-sky-200/60 dark:border-sky-800/60">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Permanent & Immutable · No further attendance or ERP changes allowed</span>
                </div>
              </div>
            ) : session.personalStatus === "present" ? (
              <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs space-y-2.5">
                <p className="font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5 text-sm">
                  <Check className="h-4 w-4 text-emerald-600" /> Attendance Receipt Recorded & Permanently Locked
                </p>
                <p className="text-emerald-700 dark:text-emerald-300">
                  Server IST Receipt: <strong>{session.serverReceiptAt ? `${formatClock(session.serverReceiptAt)} IST` : "Recorded"}</strong>
                  {session.scheduledDate ? ` · Date: ${formatDate(session.scheduledDate)}` : ""}
                </p>
                {(session.photoDataUrl || evidencePhotoUrl || session.evidenceAvailable) ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
                      <span className="flex items-center gap-1.5">
                        <Camera className="h-3.5 w-3.5" /> Live Captured Proof Snapshot:
                      </span>
                      {(session.clientCaptureAt || session.serverReceiptAt) && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Captured: {formatClock(session.clientCaptureAt || session.serverReceiptAt!)} IST
                        </span>
                      )}
                    </div>
                    <img
                      src={session.photoDataUrl || evidencePhotoUrl || ""}
                      alt="Captured live proof"
                      className="w-full h-40 object-cover rounded-md border"
                    />
                  </div>
                ) : null}
                <p className="text-[11px] text-muted-foreground pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  Authoritative server receipt logged. This record is permanent, strictly one-time, and cannot be edited, overwritten, or changed to absent.
                </p>
              </div>
            ) : inWindow ? (
              <div className="space-y-3 pt-2">
                {/* Optional live camera capture matching image */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 text-primary" /> Capture Live Photo (Optional)
                    </span>
                    <span className="text-[10px] text-muted-foreground">Snapshot proof stored with record</span>
                  </div>

                  {stream ? (
                    <div className="space-y-2">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-44 object-cover rounded-lg border bg-black"
                      />
                      <Button size="sm" onClick={snapPhoto} className="w-full text-xs">
                        <Camera className="h-3.5 w-3.5 mr-1.5" /> Snap Photo
                      </Button>
                    </div>
                  ) : capturedPhotoUrl ? (
                    <div className="space-y-2">
                      <img
                        src={capturedPhotoUrl}
                        alt="Captured proof"
                        className="w-full h-36 object-cover rounded-lg border"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setCapturedPhotoUrl(null); setCapturedPhotoAt(null); startCamera(); }}
                        className="w-full text-xs"
                      >
                        Retake / Remove Photo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cameraError && (
                        <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded">{cameraError}</p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={startCamera}
                        className="w-full text-xs"
                      >
                        <Camera className="h-3.5 w-3.5 mr-1.5" /> {cameraError ? "Retry Camera" : "Enable Live Camera (Optional)"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    className={`w-full font-semibold text-xs h-9 shadow-xs ${
                      stagedPersonalStatus === "present"
                        ? "bg-emerald-600 text-white"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    }`}
                    disabled={busy}
                    onClick={handleStagePresent}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> {stagedPersonalStatus === "present" ? "Present (Staged)" : "Mark Present"}
                  </Button>
                  <Button
                    variant="outline"
                    className={`w-full text-xs h-9 ${
                      stagedPersonalStatus === "absent"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                    }`}
                    disabled={busy}
                    onClick={handleStageAbsent}
                  >
                    <X className="h-4 w-4 mr-1.5" /> {stagedPersonalStatus === "absent" ? "Absent by Student (Staged)" : "Mark Absent"}
                  </Button>
                </div>
              </div>
            ) : isWindowOverdue ? (
              <div className="rounded-lg bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3 text-xs space-y-1">
                <p className="font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                  <X className="h-3.5 w-3.5" /> {session.absentType === "manual_student" ? "Marked Absent by Student" : "Attendance Window Closed — Automatically Marked Absent"}
                </p>
                <p className="text-rose-700 dark:text-rose-300">
                  {session.absentType === "manual_student"
                    ? "Recorded as Absent by student explicitly during the class session."
                    : `Class interval (${formatClock(session.scheduledStartAt)} – ${formatClock(session.scheduledEndAt)} IST) elapsed without a valid Present mark. Automatically finalized as Absent on AttendWise.`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Finalized on AttendWise and uneditable.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Attendance window has not opened yet. Marking opens at {formatClock(session.scheduledStartAt)} IST.
              </p>
            )}
          </div>

          {/* College ERP Attendance Section - Independent and recordable before, during, or after class */}
          <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <TableProperties className="h-3.5 w-3.5 text-primary" />
                  Mark Attendance on ERP
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Record official college ERP portal status (independent from AttendWise)
                </p>
              </div>
              {session.erpStatus ? (
                <Badge
                  variant="outline"
                  className={
                    session.erpStatus === "Present"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-xs font-medium"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 text-xs font-medium"
                  }
                >
                  ERP: {session.erpStatus} (Locked)
                </Badge>
              ) : stagedErpStatus ? (
                <Badge variant="outline" className="text-xs text-primary border-primary/30">
                  ERP: {stagedErpStatus} (Staged)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  ERP: Not Recorded
                </Badge>
              )}
            </div>

            {/* ERP uneditable check once entered */}
            {!isFrozen && session.erpStatus !== null ? (
              <div className="rounded-lg bg-card p-3 border text-xs">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" /> ERP Record Finalized
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  ERP status has been permanently recorded as <strong>{session.erpStatus}</strong> and cannot be altered or overwritten.
                </p>
              </div>
            ) : !isFrozen ? (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`text-xs font-medium ${
                      stagedErpStatus === "Present"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-emerald-500/40 hover:bg-emerald-50 text-emerald-700 dark:hover:bg-emerald-950/30"
                    }`}
                    disabled={busy}
                    onClick={() => handleStageErp("Present")}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Present on ERP
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`text-xs font-medium ${
                      stagedErpStatus === "Absent"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "border-rose-500/40 hover:bg-rose-50 text-rose-700 dark:hover:bg-rose-950/30"
                    }`}
                    disabled={busy}
                    onClick={() => handleStageErp("Absent")}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" /> Absent on ERP
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  ERP attendance can be recorded before, during, or after class. Once saved, it is locked and immutable.
                </p>
              </div>
            ) : null}
          </div>

          {/* Note / Keynote Section (One-time save, immutable & read-only once saved) */}
          {session.note ? (
            <div className="rounded-xl border p-4 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  Message / Keynote (Locked & Immutable)
                </h4>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary">
                  Saved & Read-Only
                </Badge>
              </div>
              <p className="text-xs font-semibold text-foreground bg-card p-2.5 rounded border">
                &quot;{session.note}&quot;
              </p>
              <p className="text-[10px] text-muted-foreground">
                Keynote is permanently bounded to this class record and cannot be altered.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border p-4 bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  Message / Keynote (Optional)
                </h4>
                <span className="text-[10px] text-muted-foreground">e.g., Expert lecture in EC Audi</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Add a note or explanation regarding class session or topic. Once saved, it becomes permanent, immutable, and uneditable.
              </p>
              <div className="flex gap-2">
                <Input
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Write keynote / note here..."
                  className="text-xs h-8"
                  disabled={busy}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 shrink-0"
                  disabled={busy || !noteInput.trim()}
                  onClick={handleStageNote}
                >
                  Stage Keynote
                </Button>
              </div>
            </div>
          )}

          {/* Freeze Class Option */}
          {isFrozen ? (
            <div className="rounded-xl border p-4 bg-sky-500/10 border-sky-500/20 text-sky-900 dark:text-sky-200 text-xs space-y-1 text-center">
              <div className="flex items-center justify-center gap-2 font-semibold">
                <Snowflake className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Class Is Frozen (Permanently Excluded)
              </div>
              {session.freezeReason ? (
                <p className="text-[11px] text-sky-800 dark:text-sky-300 italic">
                  Reason: &quot;{session.freezeReason}&quot;
                </p>
              ) : null}
              {session.frozenAt ? (
                <p className="text-[10px] text-muted-foreground">
                  Frozen on {formatDate(session.frozenAt.slice(0, 10))} at {formatClock(session.frozenAt)} IST
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border p-4 bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <Snowflake className="h-4 w-4 text-rose-600" /> Freeze Class (Cancel & Exclude)
                </h4>
                <Badge variant="outline" className="text-[10px] text-rose-700 border-rose-200 dark:border-rose-800">
                  1-Time Immutable
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Freezing this class permanently treats it as cancelled and excludes it from all attendance calculations, percentages, and totals. Once frozen, it can <strong>never be altered or counted</strong>.
              </p>

              {confirmFreeze ? (
                <div className="rounded-lg border border-rose-300 bg-rose-100/70 dark:bg-rose-950/60 p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-600" /> Confirm Permanent Class Freeze?
                  </p>
                  <p className="text-[11px] text-rose-800 dark:text-rose-300">
                    This class will be permanently removed from all calculations, regardless of prior attendance or ERP records.
                  </p>
                  <Input
                    value={freezeReasonInput}
                    onChange={(e) => setFreezeReasonInput(e.target.value)}
                    placeholder="Reason for freezing (e.g. Faculty on leave, College event, Medical)"
                    className="text-xs h-8 bg-background"
                    disabled={busy}
                  />
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError(null);
                        try {
                          setStagedPersonalStatus("frozen");
                          const reasonToSave = freezeReasonInput.trim() || undefined;
                          if (onFreezeClass) {
                            await onFreezeClass(session.id, reasonToSave);
                          } else {
                            await freezeClassSession(user.uid, session.id, reasonToSave);
                          }
                          setNotice("Class successfully frozen and permanently removed from all calculations.");
                          setConfirmFreeze(false);
                        } catch (err: any) {
                          setError(err?.message || "Could not freeze class.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? "Freezing..." : "Yes, Permanently Freeze Class"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      disabled={busy}
                      onClick={() => setConfirmFreeze(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs text-rose-700 border-rose-200 hover:bg-rose-100 hover:text-rose-800 dark:text-rose-400 dark:border-rose-800"
                  onClick={() => setConfirmFreeze(true)}
                  disabled={busy}
                >
                  <Snowflake className="h-3.5 w-3.5 mr-1.5 text-rose-600" /> Permanently Freeze Class
                </Button>
              )}
            </div>
          )}

          {/* Attendance Details Table & Event Timeline */}
          <div className="rounded-xl border p-4 bg-card/60 space-y-3">
            <h4 className="text-xs font-semibold text-foreground">Attendance Details & Audit Log</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-muted-foreground block text-[10px] uppercase font-medium">Subject</span>
                <span className="font-semibold truncate block mt-0.5">{session.subjectName}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{session.subjectCode}</span>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-muted-foreground block text-[10px] uppercase font-medium">Date</span>
                <span className="font-semibold block mt-0.5">{formatDate(session.scheduledDate)}</span>
                <span className="text-[10px] text-muted-foreground">Day {session.academicDayNumber || "—"}</span>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-muted-foreground block text-[10px] uppercase font-medium">Time Interval</span>
                <span className="font-semibold block mt-0.5">{formatClock(session.scheduledStartAt)} – {formatClock(session.scheduledEndAt)}</span>
                <span className="text-[10px] text-muted-foreground">{session.slot}</span>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-muted-foreground block text-[10px] uppercase font-medium">Personal (AttendWise)</span>
                <span className="font-semibold block mt-0.5 capitalize">{isFrozen ? "Class Frozen (Excluded)" : session.personalStatus}</span>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-muted-foreground block text-[10px] uppercase font-medium">ERP Status</span>
                <span className="font-semibold block mt-0.5">{session.erpStatus ?? "Not Entered"}</span>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-muted-foreground block text-[10px] uppercase font-medium">Finalization</span>
                <span className="font-semibold block mt-0.5">{isFrozen ? "Frozen & Cancelled" : session.finalized ? "Finalized" : "Pending"}</span>
              </div>
            </div>

            {/* Event Timeline */}
            <div className="pt-2 border-t">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Event Timeline
              </span>
              {events.length ? (
                <ol className="space-y-2.5">
                  {events.map((ev) => (
                    <li key={ev.id} className="flex items-start gap-2 text-xs">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                        <Check className="h-3 w-3" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{ev.message}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDateTime(ev.serverTimestamp)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Scheduled time: {formatDateTime(session.scheduledStartAt)}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-5 border-t bg-muted/20 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
          {!isFrozen && hasUnsavedChanges ? (
            <Button
              size="sm"
              className="text-xs font-semibold bg-primary text-primary-foreground shadow-xs gap-1.5"
              disabled={busy}
              onClick={handleSaveAllStatus}
            >
              <Check className="h-4 w-4" /> Save Status
            </Button>
          ) : !isFrozen && isPresentAlready && session.erpStatus !== null ? (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> All Records Locked & Synced
            </span>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Dashboard with Today's Schedule and embedded Attendance History Dashboard
function Dashboard({
  user,
  profile,
  sessions,
  subjects,
  sessionsInitialLoading = false,
  onRecordErp,
  onMarkPresent,
  onMarkAbsent,
  onFreezeClass,
  onSaveCompleteAttendance,
}: {
  user: FirebaseUser;
  profile?: StudentProfile | null;
  sessions: ClassSessionItem[];
  subjects?: SubjectItem[];
  sessionsInitialLoading?: boolean;
  onRecordErp?: (sessionId: string, status: "Present" | "Absent") => Promise<void>;
  onMarkPresent?: (sessionId: string, photoUrl?: string, note?: string, capturedAt?: string) => Promise<void>;
  onMarkAbsent?: (sessionId: string, note?: string) => Promise<void>;
  onFreezeClass?: (sessionId: string, reason?: string) => Promise<void>;
  onSaveCompleteAttendance?: (sessionId: string, payload: CompleteAttendancePayload) => Promise<void>;
}) {
  const [selectedCardSession, setSelectedCardSession] = useState<ClassSessionItem | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [photoModalInfo, setPhotoModalInfo] = useState<{ url: string; captureTime?: string | null; session?: ClassSessionItem } | null>(null);

  // Filters for the Attendance History dashboard embedded on the page
  const [filters, setFilters] = useState({
    subjectId: "",
    category: "",
    personalStatus: "",
    comparisonStatus: "",
    from: "",
    to: "",
  });

  const patchFilter = (k: string, v: string) => setFilters((prev) => ({ ...prev, [k]: v }));
  const resetFilters = () =>
    setFilters({
      subjectId: "",
      category: "",
      personalStatus: "",
      comparisonStatus: "",
      from: "",
      to: "",
    });

  const stats = useMemo(() => computeAttendanceStats(sessions), [sessions]);

  const [currentTick, setCurrentTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const nowMs = currentTick;

  // Today's classes (including P7 if currently running across midnight)
  const todayKey = formatDateKey(new Date());
  const todaySessions = useMemo(
    () =>
      sessions
        .filter((s) => {
          if (s.scheduledDate === todayKey) return true;
          if (s.slot === "P7" || s.subjectCode === "TEST-P7" || s.subjectId === "sub-test-class-p7") {
            const start = new Date(s.scheduledStartAt).getTime();
            const end = new Date(s.scheduledEndAt).getTime();
            return nowMs >= start && nowMs < end;
          }
          return false;
        })
        .sort((a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime()),
    [sessions, todayKey, nowMs]
  );

  const todayCalendarInfo = useMemo(() => getCalendarDayInfo(todayKey), [todayKey]);
  const nextHoliday = useMemo(() => {
    return SISTEC_OFFICIAL_HOLIDAYS.find((h) => h.startDate >= todayKey);
  }, [todayKey]);

  // Filtered sessions for Attendance History Dashboard
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filters.subjectId && s.subjectId !== filters.subjectId) return false;
      if (filters.category && s.category !== filters.category) return false;
      if (filters.personalStatus) {
        if (filters.personalStatus === "in_run") {
          if (!isSessionInWindow(s, nowMs)) return false;
        } else if (filters.personalStatus === "upcoming") {
          if (s.personalStatus !== "upcoming" || isSessionInWindow(s, nowMs)) return false;
        } else if (s.personalStatus !== filters.personalStatus) {
          return false;
        }
      }
      if (filters.from && s.scheduledDate < filters.from) return false;
      if (filters.to && s.scheduledDate > filters.to) return false;
      if (filters.comparisonStatus) {
        if (filters.comparisonStatus === "erp_not_entered" && s.erpStatus !== null) return false;
        if (filters.comparisonStatus === "match") {
          const personal = s.personalStatus === "present" ? "Present" : "Absent";
          if (s.erpStatus !== personal) return false;
        }
        if (filters.comparisonStatus === "potential_discrepancy") {
          const personal = s.personalStatus === "present" ? "Present" : "Absent";
          if (!s.erpStatus || s.erpStatus === personal) return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime());
  }, [sessions, filters, nowMs]);

  const handleOpenAttendanceCard = (session: ClassSessionItem) => {
    setSelectedCardSession(session);
    setCardDialogOpen(true);
  };

  return (
    <>
      {/* Header Area matching reference design */}
      <div className="mb-8 p-6 sm:p-8 rounded-3xl bg-indigo-950 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight">
              Good day, {profile?.displayName?.split(" ")[0] || "Student"}.
            </h1>
            <p className="text-indigo-200 text-sm">
              Your SISTec college attendance and class session dashboard.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LiveServerClock />
            <Badge variant="secondary" className="bg-indigo-800 text-indigo-100 hover:bg-indigo-700 border-none font-mono text-xs h-9 px-4">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-yellow-300" /> SISTec AIDS 3 Sem
            </Badge>
          </div>
        </div>
        
        {/* Decorative elements - book graphic */}
        <div className="absolute right-6 bottom-6 opacity-10">
          <BookOpen size={140} />
        </div>
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-indigo-800 rounded-full blur-3xl opacity-30"></div>
      </div>

      {actionNotice ? (
        <Alert className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription className="text-xs font-medium">{actionNotice}</AlertDescription>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive" className="mb-4">
          <CircleAlert className="h-4 w-4" />
          <AlertDescription className="text-xs font-medium">{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {/* SISTec GN Academic Calendar Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold">SISTec Academic Calendar</span>
              {todayCalendarInfo.type === "teaching" ? (
                <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold">
                  Instructional Day {todayCalendarInfo.dayNumber} of 57
                </Badge>
              ) : todayCalendarInfo.type === "holiday" ? (
                <Badge variant="destructive" className="text-[10px] font-semibold">
                  Holiday: {todayCalendarInfo.title}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  {todayCalendarInfo.title}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {todayCalendarInfo.type === "teaching"
                ? "Official teaching day · Scheduled classes count towards your personal attendance record."
                : "No classes scheduled today · Official holidays do not count in attendance totals."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {nextHoliday ? (
            <span className="text-[11px] text-muted-foreground hidden lg:inline">
              Upcoming: <strong className="text-destructive font-medium">{nextHoliday.name}</strong> ({nextHoliday.startDate})
            </span>
          ) : null}
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/60 px-3 py-1.5 text-xs font-medium hover:bg-muted text-foreground"
          >
            Full Academic Calendar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Today's Schedule with direct Attendance Card entry */}
      <Card className="mb-6 shadow-xs border-primary/20">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" /> Today&apos;s Schedule
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en-IN", {
                timeZone: TIMEZONE,
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}{" "}
              · Enter attendance card for today&apos;s lectures below
            </p>
          </div>
          <Link
            href="/timetable"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            Timetable <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {todaySessions.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {todaySessions.map((session) => {
                const startMs = new Date(session.scheduledStartAt).getTime();
                const endMs = new Date(session.scheduledEndAt).getTime();
                const isFrozen = session.personalStatus === "frozen";
                const inWindow = !isFrozen && !session.finalized && nowMs >= startMs && nowMs < endMs;
                const isWindowOverdue = !isFrozen && (nowMs >= endMs || session.personalStatus === "absent");
                const statusLabel = sessionStatusLabel(session);

                return (
                  <div
                    key={session.id}
                    className={`rounded-xl border p-4 transition-all hover:border-primary/50 bg-card flex flex-col justify-between gap-3 shadow-xs ${
                      isFrozen
                        ? "border-sky-500/30 bg-sky-500/5 dark:bg-sky-950/20"
                        : inWindow
                        ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                        : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex h-6 w-8 items-center justify-center rounded-md bg-primary/10 text-primary font-mono font-bold text-xs">
                          {session.slot}
                        </span>
                        {sessionsInitialLoading && session.personalStatus !== "present" && session.personalStatus !== "frozen" ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground animate-pulse">
                            Syncing cloud...
                          </Badge>
                        ) : (
                          <StateBadge status={statusLabel}>{statusLabel}</StateBadge>
                        )}
                      </div>

                      <h4 className="mt-2 font-semibold text-sm line-clamp-1">{session.subjectName}</h4>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {session.subjectCode} · {session.category} {session.room ? `· Room ${session.room}` : ""}
                      </p>

                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Clock3 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{formatClock(session.scheduledStartAt)} – {formatClock(session.scheduledEndAt)} IST</span>
                      </div>

                      <div className="mt-2 pt-2 border-t flex items-center justify-between gap-2 text-xs">
                        <span className="text-[11px] text-muted-foreground">ERP Status:</span>
                        {session.erpStatus ? (
                          <Badge
                            variant="outline"
                            className={
                              session.erpStatus === "Present"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium"
                                : "bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-medium"
                            }
                          >
                            ERP: {session.erpStatus} (Locked)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            ERP: Not Recorded
                          </Badge>
                        )}
                      </div>

                      {session.personalStatus === "present" && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                          <Check className="h-3 w-3" />
                          <span>Present Locked {session.serverReceiptAt ? `· ${formatClock(session.serverReceiptAt)} IST` : ""}</span>
                        </div>
                      )}
                      {(session.photoDataUrl || session.evidenceStoragePath || session.evidenceAvailable) ? (
                        <EvidenceSnapshotThumbnail
                          session={session}
                          onViewImage={(url, time, s) => setPhotoModalInfo({ url, captureTime: time, session: s })}
                        />
                      ) : null}
                      {session.note ? (
                        <div className="mt-1 flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 truncate">
                          💬 Keynote: {session.note}
                        </div>
                      ) : null}
                    </div>

                    <Button
                      size="sm"
                      variant={isFrozen ? "outline" : "default"}
                      className={`w-full text-xs font-semibold h-8 shadow-xs gap-1.5 ${
                        isFrozen
                          ? "border-sky-500/40 text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                      onClick={() => handleOpenAttendanceCard(session)}
                    >
                      {isFrozen ? (
                        <>
                          <Snowflake className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> View Frozen Card
                        </>
                      ) : (
                        <>
                          <TableProperties className="h-3.5 w-3.5" /> Enter Attendance Card
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No classes scheduled today"
              detail="Today has no timetable entries scheduled. Enjoy your academic self-study time."
              action={
                <Link href="/timetable" className="text-xs font-semibold text-primary hover:underline">
                  Open full timetable
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Attendance History Dashboard (replaced the analytics section as requested) */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Attendance History Dashboard
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              All sessions with real-time In Run, Upcoming, and Finalized attendance states.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-foreground">
              {filteredSessions.length} Session{filteredSessions.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Bar */}
          <div className="grid gap-2.5 p-3.5 rounded-xl bg-muted/40 border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 text-xs">
            <div className="space-y-1">
              <Label htmlFor="dh-sub" className="text-xs">Subject</Label>
              <Select value={filters.subjectId || "all"} onValueChange={(v) => patchFilter("subjectId", v === "all" ? "" : v)}>
                <SelectTrigger id="dh-sub" className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dh-cat" className="text-xs">Category</Label>
              <Select value={filters.category || "all"} onValueChange={(v) => patchFilter("category", v === "all" ? "" : v)}>
                <SelectTrigger id="dh-cat" className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="Theory">Theory</SelectItem>
                  <SelectItem value="Practical">Practical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dh-status" className="text-xs">Status</Label>
              <Select
                value={filters.personalStatus || "all"}
                onValueChange={(v) => patchFilter("personalStatus", v === "all" ? "" : v)}
              >
                <SelectTrigger id="dh-status" className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="in_run">In Run (Active Window)</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="frozen">Class Frozen (Excluded)</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dh-comp" className="text-xs">ERP Comparison</Label>
              <Select
                value={filters.comparisonStatus || "all"}
                onValueChange={(v) => patchFilter("comparisonStatus", v === "all" ? "" : v)}
              >
                <SelectTrigger id="dh-comp" className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Comparisons</SelectItem>
                  <SelectItem value="match">Match</SelectItem>
                  <SelectItem value="potential_discrepancy">Potential Discrepancy</SelectItem>
                  <SelectItem value="erp_not_entered">ERP Not Entered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dh-from" className="text-xs">From Date</Label>
              <Input
                id="dh-from"
                type="date"
                className="h-8 text-xs bg-background"
                value={filters.from}
                onChange={(e) => patchFilter("from", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="dh-to" className="text-xs">To Date</Label>
              <div className="flex gap-1.5">
                <Input
                  id="dh-to"
                  type="date"
                  className="h-8 text-xs bg-background"
                  value={filters.to}
                  onChange={(e) => patchFilter("to", e.target.value)}
                />
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={resetFilters} aria-label="Clear filters">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Session Cards Listing */}
          {filteredSessions.length ? (
            <div className="divide-y rounded-xl border">
              {filteredSessions.map((session) => {
                const statusLabel = sessionStatusLabel(session);
                const isTodaySession = session.scheduledDate === todayKey;

                return (
                  <div
                    key={session.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex h-5 w-7 items-center justify-center rounded bg-primary/10 text-primary font-mono font-bold text-[11px]">
                          {session.slot}
                        </span>
                        <p className="font-semibold text-sm truncate">{session.subjectName}</p>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {session.subjectCode}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {session.category}
                        </Badge>
                        {session.academicDayNumber ? (
                          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                            Day {session.academicDayNumber}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{formatDate(session.scheduledDate)}</span>
                        <span>·</span>
                        <span>{formatClock(session.scheduledStartAt)} – {formatClock(session.scheduledEndAt)} IST</span>
                        {session.room ? <span>· Room: {session.room}</span> : null}
                      </div>
                      {(session.photoDataUrl || session.evidenceStoragePath || session.evidenceAvailable || session.note) ? (
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {(session.photoDataUrl || session.evidenceStoragePath || session.evidenceAvailable) && (
                            <EvidenceSnapshotRow
                              session={session}
                              onViewImage={(url, time, s) => setPhotoModalInfo({ url, captureTime: time, session: s })}
                            />
                          )}
                          {session.note && (
                            <span className="text-[11px] text-primary font-medium bg-primary/5 px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1">
                              💬 Keynote: {session.note}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                      {sessionsInitialLoading && session.personalStatus !== "present" && session.personalStatus !== "frozen" ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground animate-pulse">
                          Syncing cloud...
                        </Badge>
                      ) : (
                        <StateBadge status={statusLabel}>{statusLabel}</StateBadge>
                      )}

                      {session.erpStatus ? (
                        <Badge
                          variant="outline"
                          className={
                            session.erpStatus === "Present"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium"
                              : "bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-medium"
                          }
                        >
                          ERP: {session.erpStatus} (Locked)
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">ERP Not Entered</span>
                      )}

                      <Button
                        size="sm"
                        variant={isTodaySession ? "default" : "outline"}
                        className={`text-xs h-7 gap-1 shadow-xs font-medium ${
                          isTodaySession ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""
                        }`}
                        onClick={() => handleOpenAttendanceCard(session)}
                      >
                        <TableProperties className="h-3 w-3" />
                        {isTodaySession ? "Enter Attendance Card" : "View Card"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No class records match these filters"
              detail="No scheduled classes found matching your current filter criteria."
              action={
                <Button variant="outline" onClick={resetFilters} size="sm">
                  Clear filters
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Interactive Attendance Card Modal */}
      <AttendanceCardDialog
        open={cardDialogOpen}
        onOpenChange={setCardDialogOpen}
        session={selectedCardSession}
        sessions={sessions}
        user={user}
        onRecordErp={onRecordErp}
        onMarkPresent={onMarkPresent}
        onMarkAbsent={onMarkAbsent}
        onSaveCompleteAttendance={onSaveCompleteAttendance}
        onFreezeClass={async (sid) => {
          if (onFreezeClass) {
            await onFreezeClass(sid);
          }
          setSelectedCardSession((prev) =>
            prev && prev.id === sid
              ? {
                  ...prev,
                  personalStatus: "frozen",
                  finalized: true,
                  frozenAt: new Date().toISOString(),
                  finalizedAt: new Date().toISOString(),
                }
              : prev
          );
        }}
      />
      <PhotoEvidenceModal photoInfo={photoModalInfo} onClose={() => setPhotoModalInfo(null)} />
    </>
  );
}

// Timetable View
function Timetable({
  user,
  timetable,
  subjects,
}: {
  user: FirebaseUser;
  timetable: TimetableItem[];
  subjects: SubjectItem[];
}) {
  const [day, setDay] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableItem | null>(null);
  const [error, setError] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [category, setCategory] = useState<"Theory" | "Practical">("Theory");
  const [startTime, setStartTime] = useState("09:35");
  const [endTime, setEndTime] = useState("10:35");
  const [slot, setSlot] = useState("P1");
  const [room, setRoom] = useState("");
  const [entryDay, setEntryDay] = useState(1);
  const [busy, setBusy] = useState(false);

  const dayEntries = useMemo(
    () =>
      timetable
        .filter((entry) => entry.dayOfWeek === day && entry.active)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [timetable, day]
  );

  const openForm = (entry?: TimetableItem) => {
    setEditing(entry ?? null);
    setEntryDay(entry?.dayOfWeek ?? day);
    setSubjectId(entry?.subjectId ?? subjects[0]?.id ?? "");
    setCategory(entry?.category ?? "Theory");
    setStartTime(entry?.startTime ?? "09:35");
    setEndTime(entry?.endTime ?? "10:35");
    setSlot(entry?.slot ?? "P1");
    setRoom(entry?.room ?? "");
    setError("");
    setDialogOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!subjectId) {
      setError("Please choose a subject.");
      return;
    }
    if (startTime >= endTime) {
      setError("End time must be later than start time.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const selectedSub = subjects.find((s) => s.id === subjectId);
      const data = {
        subjectId,
        subjectName: selectedSub?.name || "Subject",
        subjectCode: selectedSub?.code || "CODE",
        slot,
        dayOfWeek: entryDay,
        startTime,
        endTime,
        category,
        room: room || null,
        updatedAt: new Date().toISOString(),
      };

      if (editing) {
        const ref = doc(db, "users", user.uid, "timetableEntries", editing.id);
        await updateDoc(ref, data);
      } else {
        const newRef = doc(collection(db, "users", user.uid, "timetableEntries"));
        await setDoc(newRef, {
          ...data,
          id: newRef.id,
          studentId: user.uid,
          active: true,
          sourceId: "manual-entry",
          createdAt: new Date().toISOString(),
        });
      }
      setDialogOpen(false);
    } catch (err: any) {
      setError(err?.message || "Could not save timetable entry.");
    } finally {
      setBusy(false);
    }
  };

  const removeEntry = async (entry: TimetableItem) => {
    if (window.confirm(`Remove ${entry.subjectName} (${entry.slot}) from recurring timetable?`)) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "timetableEntries", entry.id));
      } catch (err: any) {
        setError(err?.message || "Could not delete class entry.");
      }
    }
  };

  return (
    <>
      <PageHeading
        title="Weekly Timetable"
        description="SISTec AIDS 3rd Semester weekly recurring schedule (Asia/Kolkata IST)."
        action={
          <Button onClick={() => openForm()} data-testid="button-add-class" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Class
          </Button>
        }
      />

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-lg border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary shrink-0" />
          <span>Timetable slots only execute on approved teaching days per the SISTec Academic Calendar. Holidays and non-working days have 0 classes.</span>
        </div>
        <Link href="/calendar" className="text-primary font-medium hover:underline shrink-0 flex items-center gap-1">
          Open Academic Calendar <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Select day">
        {WEEK_DAYS.map((name, index) => (
          <Button
            key={name}
            role="tab"
            aria-selected={day === index + 1}
            variant={day === index + 1 ? "default" : "outline"}
            size="sm"
            onClick={() => setDay(index + 1)}
            data-testid={`tab-day-${name.toLowerCase()}`}
          >
            {name}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{WEEK_DAYS[day - 1]} Schedule</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              6 Slots (P1 to P6) · Lunch Break 1:35 PM – 2:10 PM
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {dayEntries.length} Slots
          </Badge>
        </CardHeader>
        <CardContent>
          {dayEntries.length ? (
            <div className="space-y-3">
              {dayEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center"
                  data-testid={`card-timetable-${entry.id}`}
                >
                  <div className="flex min-w-44 items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono font-bold text-xs">
                      {entry.slot}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{formatClock(entry.startTime)}</p>
                      <p className="text-xs text-muted-foreground">to {formatClock(entry.endTime)}</p>
                    </div>
                  </div>

                  <Separator orientation="vertical" className="hidden h-10 sm:block" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{entry.subjectName}</p>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {entry.subjectCode}
                      </Badge>
                      {entry.subjectName.includes("/ Sa") || entry.subjectName.includes("Computer Workshop/I") ? (
                        <span className="text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                          PDF abbreviation
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className={entry.category === "Practical" ? "bg-secondary/15 text-secondary border-secondary/30" : ""}
                      >
                        {entry.category}
                      </Badge>
                      {entry.room ? <span className="text-muted-foreground">· {entry.room}</span> : null}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openForm(entry)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeEntry(entry)}>
                      Remove
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No classes scheduled"
              detail="No classes are currently scheduled for this day in your timetable."
              action={
                <Button variant="outline" onClick={() => openForm()} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Class
                </Button>
              }
            />
          )}
          {error && !dialogOpen ? (
            <Alert variant="destructive" className="mt-4">
              <CircleAlert className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Full week grid">
        {WEEK_DAYS.map((name, index) => {
          const slots = timetable
            .filter((entry) => entry.dayOfWeek === index + 1 && entry.active)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <Card key={name} className={day === index + 1 ? "border-primary" : ""}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold">{name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setDay(index + 1)} className="text-xs h-7">
                  Focus
                </Button>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {slots.length ? (
                  slots.map((entry) => (
                    <div key={entry.id} className="rounded-md border-l-2 border-primary bg-muted/30 px-2.5 py-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate">{entry.subjectCode}</span>
                        <span className="text-[10px] text-muted-foreground">{entry.slot}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{entry.subjectName}</p>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-muted-foreground text-center">No classes</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Timetable Class" : "Add Timetable Class"}</DialogTitle>
            <DialogDescription>
              Update your recurring college schedule. Changes sync automatically to Firebase.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="class-sub">Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger id="class-sub">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.name} ({s.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="class-day">Day</Label>
                <Select value={String(entryDay)} onValueChange={(v) => setEntryDay(Number(v))}>
                  <SelectTrigger id="class-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEK_DAYS.map((name, i) => (
                      <SelectItem key={name} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class-slot">Slot</Label>
                <Select value={slot} onValueChange={setSlot}>
                  <SelectTrigger id="class-slot">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SISTEC_TIME_SLOTS.map((s) => (
                      <SelectItem key={s.slot} value={s.slot}>
                        {s.slot} ({s.start} - {s.end})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="class-start">Start Time (IST)</Label>
                <Input
                  id="class-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-end">End Time (IST)</Label>
                <Input
                  id="class-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="class-cat">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                  <SelectTrigger id="class-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Theory">Theory</SelectItem>
                    <SelectItem value="Practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-room">Room / Lab (optional)</Label>
                <Input
                  id="class-room"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. Lab 3 / B-204"
                />
              </div>
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : editing ? "Save Changes" : "Add to Timetable"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Attendance History View
function AttendanceHistory({
  user,
  sessions,
  subjects,
  sessionsInitialLoading = false,
  onRecordErp,
  onMarkPresent,
  onMarkAbsent,
  onFreezeClass,
  onSaveCompleteAttendance,
}: {
  user?: FirebaseUser | null;
  sessions: ClassSessionItem[];
  subjects: SubjectItem[];
  sessionsInitialLoading?: boolean;
  onRecordErp?: (sessionId: string, status: "Present" | "Absent") => Promise<void>;
  onMarkPresent?: (sessionId: string, photoUrl?: string, note?: string, capturedAt?: string) => Promise<void>;
  onMarkAbsent?: (sessionId: string, note?: string) => Promise<void>;
  onFreezeClass?: (sessionId: string, reason?: string) => Promise<void>;
  onSaveCompleteAttendance?: (sessionId: string, payload: CompleteAttendancePayload) => Promise<void>;
}) {
  const [selectedSession, setSelectedSession] = useState<ClassSessionItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [photoModalInfo, setPhotoModalInfo] = useState<{ url: string; captureTime?: string | null; session?: ClassSessionItem } | null>(null);

  const [filters, setFilters] = useState({
    subjectId: "",
    category: "",
    personalStatus: "",
    comparisonStatus: "",
    from: "",
    to: "",
  });

  const patch = (k: string, v: string) => setFilters((prev) => ({ ...prev, [k]: v }));
  const reset = () =>
    setFilters({
      subjectId: "",
      category: "",
      personalStatus: "",
      comparisonStatus: "",
      from: "",
      to: "",
    });

  const [currentTick, setCurrentTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const nowMs = currentTick;
  const todayKey = formatDateKey(new Date());

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filters.subjectId && s.subjectId !== filters.subjectId) return false;
      if (filters.category && s.category !== filters.category) return false;
      if (filters.personalStatus) {
        if (filters.personalStatus === "in_run") {
          if (!isSessionInWindow(s, nowMs)) return false;
        } else if (filters.personalStatus === "upcoming") {
          if (s.personalStatus !== "upcoming" || isSessionInWindow(s, nowMs)) return false;
        } else if (s.personalStatus !== filters.personalStatus) {
          return false;
        }
      }
      if (filters.from && s.scheduledDate < filters.from) return false;
      if (filters.to && s.scheduledDate > filters.to) return false;
      if (filters.comparisonStatus) {
        if (filters.comparisonStatus === "erp_not_entered" && s.erpStatus !== null) return false;
        if (filters.comparisonStatus === "match") {
          const personal = s.personalStatus === "present" ? "Present" : "Absent";
          if (s.erpStatus !== personal) return false;
        }
        if (filters.comparisonStatus === "potential_discrepancy") {
          const personal = s.personalStatus === "present" ? "Present" : "Absent";
          if (!s.erpStatus || s.erpStatus === personal) return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime());
  }, [sessions, filters, nowMs]);

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Attendance History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Authentic attendance records logged in Firebase. Track active and past classes.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <LiveServerClock />
        </div>
      </div>

      <Card className="mb-5">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 text-xs">
          <div className="space-y-1">
            <Label htmlFor="f-sub" className="text-xs">Subject</Label>
            <Select value={filters.subjectId || "all"} onValueChange={(v) => patch("subjectId", v === "all" ? "" : v)}>
              <SelectTrigger id="f-sub">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-cat" className="text-xs">Category</Label>
            <Select value={filters.category || "all"} onValueChange={(v) => patch("category", v === "all" ? "" : v)}>
              <SelectTrigger id="f-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="Theory">Theory</SelectItem>
                <SelectItem value="Practical">Practical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-status" className="text-xs">Personal Status</Label>
            <Select
              value={filters.personalStatus || "all"}
              onValueChange={(v) => patch("personalStatus", v === "all" ? "" : v)}
            >
              <SelectTrigger id="f-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="in_run">In Run (Active Window)</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="frozen">Class Frozen (Excluded)</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-comp" className="text-xs">ERP Comparison</Label>
            <Select
              value={filters.comparisonStatus || "all"}
              onValueChange={(v) => patch("comparisonStatus", v === "all" ? "" : v)}
            >
              <SelectTrigger id="f-comp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Comparisons</SelectItem>
                <SelectItem value="match">Match</SelectItem>
                <SelectItem value="potential_discrepancy">Potential Discrepancy</SelectItem>
                <SelectItem value="erp_not_entered">ERP Not Entered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-from" className="text-xs">From Date</Label>
            <Input id="f-from" type="date" value={filters.from} onChange={(e) => patch("from", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-to" className="text-xs">To Date</Label>
            <div className="flex gap-2">
              <Input id="f-to" type="date" value={filters.to} onChange={(e) => patch("to", e.target.value)} />
              <Button variant="outline" size="icon" onClick={reset} aria-label="Clear filters">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredSessions.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {filteredSessions.length} Class Session{filteredSessions.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredSessions.map((session) => {
                const statusLabel = sessionStatusLabel(session);
                const isToday = session.scheduledDate === todayKey;

                return (
                  <div
                    key={session.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex h-5 w-7 items-center justify-center rounded bg-primary/10 text-primary font-mono font-bold text-[11px]">
                          {session.slot}
                        </span>
                        <p className="font-semibold text-sm truncate">{session.subjectName}</p>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {session.subjectCode}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {session.category}
                        </Badge>
                        {session.academicDayNumber ? (
                          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                            Day {session.academicDayNumber}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{formatDate(session.scheduledDate)}</span>
                        <span>·</span>
                        <span>{formatClock(session.scheduledStartAt)} – {formatClock(session.scheduledEndAt)} IST</span>
                        {session.room ? <span>· Room: {session.room}</span> : null}
                      </div>
                      {(session.photoDataUrl || session.evidenceStoragePath || session.evidenceAvailable || session.note) ? (
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {(session.photoDataUrl || session.evidenceStoragePath || session.evidenceAvailable) && (
                            <EvidenceSnapshotRow
                              session={session}
                              onViewImage={(url, time, s) => setPhotoModalInfo({ url, captureTime: time, session: s })}
                            />
                          )}
                          {session.note && (
                            <span className="text-[11px] text-primary font-medium bg-primary/5 px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1">
                              💬 Keynote: {session.note}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                      {sessionsInitialLoading && session.personalStatus !== "present" && session.personalStatus !== "frozen" ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground animate-pulse">
                          Syncing cloud...
                        </Badge>
                      ) : (
                        <StateBadge status={statusLabel}>{statusLabel}</StateBadge>
                      )}

                      {session.erpStatus ? (
                        <Badge
                          variant="outline"
                          className={
                            session.erpStatus === "Present"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium"
                              : "bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-medium"
                          }
                        >
                          ERP: {session.erpStatus} (Locked)
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">ERP Not Recorded</span>
                      )}

                      <Button
                        size="sm"
                        variant={isToday ? "default" : "outline"}
                        className={`text-xs h-7 gap-1 shadow-xs font-medium ${
                          isToday ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""
                        }`}
                        onClick={() => {
                          setSelectedSession(session);
                          setDialogOpen(true);
                        }}
                      >
                        <TableProperties className="h-3 w-3" />
                        {isToday ? "Enter Attendance Card" : "View Card"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No class records match these filters"
          detail="All seeded dummy history has been removed. Genuine sessions will accumulate as classes occur."
          action={
            <Button variant="outline" onClick={reset} size="sm">
              Clear filters
            </Button>
          }
        />
      )}

      {user ? (
        <AttendanceCardDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          session={selectedSession}
          sessions={sessions}
          user={user}
          onRecordErp={onRecordErp}
          onMarkPresent={onMarkPresent}
          onMarkAbsent={onMarkAbsent}
          onSaveCompleteAttendance={onSaveCompleteAttendance}
          onFreezeClass={async (sid) => {
            if (onFreezeClass) {
              await onFreezeClass(sid);
            }
            setSelectedSession((prev) =>
              prev && prev.id === sid
                ? {
                    ...prev,
                    personalStatus: "frozen",
                    finalized: true,
                    frozenAt: new Date().toISOString(),
                    finalizedAt: new Date().toISOString(),
                  }
                : prev
            );
          }}
        />
      ) : null}
      <PhotoEvidenceModal photoInfo={photoModalInfo} onClose={() => setPhotoModalInfo(null)} />
    </>
  );
}

// Subjects View
function Subjects({
  user,
  subjects,
  sessions,
}: {
  user: FirebaseUser;
  subjects: SubjectItem[];
  sessions: ClassSessionItem[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectItem | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<"Theory" | "Practical">("Theory");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [currentTick, setCurrentTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const analytics = useMemo(() => computeFullAnalytics(sessions, currentTick), [sessions, currentTick]);

  const startEdit = (s?: SubjectItem) => {
    setEditing(s ?? null);
    setName(s?.name ?? "");
    setCode(s?.code ?? "");
    setCategory(s?.category ?? "Theory");
    setError("");
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a subject name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = {
        name: name.trim(),
        code: code.trim().toUpperCase() || "SUB",
        category,
        updatedAt: new Date().toISOString(),
      };
      if (editing) {
        await updateDoc(doc(db, "users", user.uid, "subjects", editing.id), data);
      } else {
        const newRef = doc(collection(db, "users", user.uid, "subjects"));
        await setDoc(newRef, {
          ...data,
          id: newRef.id,
          studentId: user.uid,
          iconKey: "book",
          createdAt: new Date().toISOString(),
        });
      }
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || "Could not save subject.");
    } finally {
      setBusy(false);
    }
  };

  const removeSubject = async (sub: SubjectItem) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "subjects", sub.id));
    } catch (err: any) {
      setError(err?.message || "Could not delete subject.");
    }
  };

  return (
    <>
      <PageHeading
        title="College Subjects & Attendance"
        description="Official SISTec AIDS 3rd Semester subjects. AttendWise & ERP attendance calculated using eligible classes till present server timing."
        action={
          <Button onClick={() => startEdit()} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Subject
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {subjects.map((sub) => {
          const subAna = analytics.subjects.find((s) => s.subjectId === sub.id) || {
            subjectId: sub.id,
            subjectName: sub.name,
            subjectCode: sub.code,
            category: sub.category,
            totalEligible: 0,
            attendwise: { percentage: null, presentCount: 0, absentCount: 0, totalEligible: 0 },
            erp: { percentage: null, presentCount: 0, absentCount: 0, notEnteredCount: 0, totalEligible: 0 },
          };

          const frozenCount = sessions.filter((s) => s.subjectId === sub.id && s.personalStatus === "frozen").length;

          return (
            <Card key={sub.id} className="shadow-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-base">{sub.name}</h2>
                      <Badge variant="outline" className="font-mono text-xs">
                        {sub.code}
                      </Badge>
                      {frozenCount > 0 ? (
                        <span className="text-[10px] text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300 px-1.5 py-0.5 rounded border border-sky-200 flex items-center gap-1">
                          <Snowflake className="h-2.5 w-2.5" /> {frozenCount} Frozen
                        </span>
                      ) : null}
                      {sub.reviewNeeded ? (
                        <span className="text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200">
                          PDF abbreviation
                        </span>
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      className={`mt-1.5 text-xs ${
                        sub.category === "Practical" ? "bg-secondary/10 text-secondary" : ""
                      }`}
                    >
                      {sub.category}
                    </Badge>
                  </div>
                </div>

                {/* AttendWise & ERP Attendance Comparison Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* AttendWise Section */}
                  <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> AttendWise
                      </span>
                      <span className="text-xl font-bold">{asPct(subAna.attendwise.percentage)}</span>
                    </div>
                    {subAna.attendwise.percentage !== null ? (
                      <Progress value={subAna.attendwise.percentage} className="h-1.5" aria-label="AttendWise attendance" />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No eligible sessions yet</p>
                    )}
                    <div className="grid grid-cols-3 gap-1 pt-1 text-center text-[11px]">
                      <div className="rounded bg-background/60 p-1">
                        <p className="font-semibold text-emerald-600">{subAna.attendwise.presentCount}</p>
                        <p className="text-[10px] text-muted-foreground">Present</p>
                      </div>
                      <div className="rounded bg-background/60 p-1">
                        <p className="font-semibold text-rose-600">{subAna.attendwise.absentCount}</p>
                        <p className="text-[10px] text-muted-foreground">Absent</p>
                      </div>
                      <div className="rounded bg-background/60 p-1">
                        <p className="font-semibold">{subAna.attendwise.totalEligible}</p>
                        <p className="text-[10px] text-muted-foreground">Eligible</p>
                      </div>
                    </div>
                  </div>

                  {/* College ERP Section */}
                  <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-chart-2 flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" /> College ERP
                      </span>
                      <span className="text-xl font-bold">{asPct(subAna.erp.percentage)}</span>
                    </div>
                    {subAna.erp.percentage !== null ? (
                      <Progress value={subAna.erp.percentage} className="h-1.5" aria-label="ERP attendance" />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No eligible sessions yet</p>
                    )}
                    <div className="grid grid-cols-3 gap-1 pt-1 text-center text-[11px]">
                      <div className="rounded bg-background/60 p-1">
                        <p className="font-semibold text-emerald-600">{subAna.erp.presentCount}</p>
                        <p className="text-[10px] text-muted-foreground">Present</p>
                      </div>
                      <div className="rounded bg-background/60 p-1">
                        <p className="font-semibold text-rose-600">{subAna.erp.absentCount}</p>
                        <p className="text-[10px] text-muted-foreground">Absent</p>
                      </div>
                      <div className="rounded bg-background/60 p-1">
                        <p className="font-semibold">{subAna.erp.notEnteredCount}</p>
                        <p className="text-[10px] text-muted-foreground">Not Set</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-2" />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Total Eligible Classes: <strong className="text-foreground">{subAna.totalEligible}</strong></span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startEdit(sub)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => removeSubject(sub)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Subject" : "Add Subject"}</DialogTitle>
            <DialogDescription>Manage subject naming and classification.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-name">Subject Name</Label>
              <Input
                id="sub-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Operating Systems"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sub-code">Subject Code</Label>
                <Input
                  id="sub-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. AD-304"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-cat">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                  <SelectTrigger id="sub-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Theory">Theory</SelectItem>
                    <SelectItem value="Practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save Subject"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ERP Comparison View (Read-only comparison; marking is done exclusively from the Attendance Card)
function Comparison({
  user,
  sessions,
  onRecordErp,
  onFreezeClass,
}: {
  user: FirebaseUser;
  sessions: ClassSessionItem[];
  onRecordErp?: (sessionId: string, status: "Present" | "Absent") => Promise<void>;
  onFreezeClass?: (sessionId: string, reason?: string) => Promise<void>;
}) {
  const [selectedSession, setSelectedSession] = useState<ClassSessionItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const stats = useMemo(() => computeAttendanceStats(sessions), [sessions]);

  // Eligible finalized sessions (strictly excluding all frozen sessions)
  const eligibleSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.finalized && !isSessionFrozen(s) && (s.personalStatus === "present" || s.personalStatus === "absent"))
        .sort((a, b) => new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime()),
    [sessions]
  );

  return (
    <>
      <PageHeading
        title="ERP Comparison"
        description="Compare your personal AttendWise record with what you manually observe in your college ERP."
      />

      <Alert className="mb-5 bg-muted/40">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertTitle className="text-xs font-semibold">Attendance Card Exclusivity</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          ERP attendance marking must be performed exclusively from the Attendance Card on the Dashboard for today&apos;s scheduled lectures. Once entered, ERP records are permanent and uneditable.
        </AlertDescription>
      </Alert>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Matches</p>
            <p className="mt-1 text-3xl font-bold">{stats.matchCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Potential Discrepancies</p>
            <p className="mt-1 text-3xl font-bold text-chart-4">{stats.discrepancyCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">ERP Not Entered</p>
            <p className="mt-1 text-3xl font-bold text-muted-foreground">{stats.erpNotEnteredCount}</p>
          </CardContent>
        </Card>
      </div>

      {eligibleSessions.length ? (
        <div className="space-y-3">
          {eligibleSessions.map((session) => {
            const personal = session.personalStatus === "present" ? "Present" : "Absent";
            const comparisonStatus =
              session.erpStatus === null
                ? "erp_not_entered"
                : session.erpStatus === personal
                ? "match"
                : "potential_discrepancy";

            const label =
              comparisonStatus === "match"
                ? "Match"
                : comparisonStatus === "potential_discrepancy"
                ? "Potential Discrepancy"
                : "ERP Not Entered";

            return (
              <Card key={session.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">{session.subjectName}</p>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {session.subjectCode}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {session.category}
                      </Badge>
                      {session.slot ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary font-mono">
                          {session.slot}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(session.scheduledDate)} · {formatClock(session.scheduledStartAt)} – {formatClock(session.scheduledEndAt)} IST
                    </p>
                    {session.note ? (
                      <p className="mt-1.5 text-xs text-primary font-medium bg-primary/5 px-2 py-1 rounded border border-primary/20 inline-block">
                        💬 Keynote: {session.note}
                      </p>
                    ) : null}
                    <div className="mt-2.5 flex flex-wrap gap-4 text-xs">
                      <span>
                        AttendWise Record: <strong>{personal}</strong>
                      </span>
                      <span>
                        College ERP:{" "}
                        <strong className={session.erpStatus ? "text-foreground font-semibold" : "text-muted-foreground"}>
                          {session.erpStatus ? `${session.erpStatus} (Locked)` : "Not Entered"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <StateBadge status={comparisonStatus}>{label}</StateBadge>
                    <div className="flex items-center gap-2">
                      {session.erpStatus ? (
                        <Badge
                          variant="outline"
                          className={
                            session.erpStatus === "Present"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium"
                              : "bg-rose-50 text-rose-700 border-rose-200 text-xs font-medium"
                          }
                        >
                          ERP: {session.erpStatus} (Locked)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          ERP Not Recorded
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={() => {
                          setSelectedSession(session);
                          setDialogOpen(true);
                        }}
                      >
                        <TableProperties className="h-3 w-3" /> View Card
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No finalized sessions for comparison"
          detail="Once sessions pass their scheduled interval and attendance is recorded, they will appear here for manual ERP comparison."
        />
      )}

      <AttendanceCardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={selectedSession}
        sessions={sessions}
        user={user}
        onRecordErp={onRecordErp}
        onFreezeClass={async (sid) => {
          if (onFreezeClass) {
            await onFreezeClass(sid);
          }
          setSelectedSession((prev) =>
            prev && prev.id === sid
              ? {
                  ...prev,
                  personalStatus: "frozen",
                  finalized: true,
                  frozenAt: new Date().toISOString(),
                  finalizedAt: new Date().toISOString(),
                }
              : prev
          );
        }}
      />
    </>
  );
}

// Dedicated Analytics Page View
function _LegacyInlineAnalyticsPage({
  user,
  sessions,
  subjects,
  onRecordErp,
  onFreezeClass,
}: {
  user: FirebaseUser;
  sessions: ClassSessionItem[];
  subjects: SubjectItem[];
  onRecordErp?: (sessionId: string, status: "Present" | "Absent") => Promise<void>;
  onFreezeClass?: (sessionId: string) => Promise<void>;
}) {
  const [selectedSession, setSelectedSession] = useState<ClassSessionItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const stats = useMemo(() => computeAttendanceStats(sessions), [sessions]);

  // Filtered subjects breakdown
  const filteredSubjects = useMemo(() => {
    return subjects.filter((sub) => {
      if (subjectFilter !== "all" && sub.id !== subjectFilter) return false;
      if (categoryFilter !== "all" && sub.category !== categoryFilter) return false;
      return true;
    });
  }, [subjects, subjectFilter, categoryFilter]);

  const frozenSessionsCount = sessions.filter((s) => s.personalStatus === "frozen").length;
  const cancelledSessionsCount = sessions.filter((s) => s.personalStatus === "cancelled").length;
  const upcomingSessionsCount = sessions.filter((s) => !s.finalized && s.personalStatus === "upcoming").length;

  return (
    <>
      <PageHeading
        title="Attendance Analytics"
        description="Real-time authoritative statistics, semester-to-date metrics, and comparison between AttendWise and College ERP."
      />

      {/* Top Two Prominent Percentage Cards */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Card A: AttendWise Attendance */}
        <Card className="border-primary/30 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-primary/5">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" /> My AttendWise Attendance
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Authoritative personal verified record</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs font-semibold px-2.5 py-1">
              {stats.overall.percentage !== null ? `${stats.overall.percentage}%` : "N/A"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-extrabold tracking-tight">
                {stats.overall.percentage !== null ? `${stats.overall.percentage}%` : "N/A"}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Target: 75% Required
              </span>
            </div>

            {stats.overall.percentage !== null ? (
              <Progress value={stats.overall.percentage} className="h-2.5" aria-label="AttendWise attendance percentage" />
            ) : null}

            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-500/10 p-2.5 border border-emerald-500/20">
                <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{stats.overall.presentCount}</p>
                <p className="text-[11px] text-muted-foreground">Present</p>
              </div>
              <div className="rounded-lg bg-rose-500/10 p-2.5 border border-rose-500/20">
                <p className="font-bold text-rose-700 dark:text-rose-400 text-sm">{stats.overall.absentCount}</p>
                <p className="text-[11px] text-muted-foreground">Absent</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 border">
                <p className="font-bold text-foreground text-sm">{stats.overall.totalEligible}</p>
                <p className="text-[11px] text-muted-foreground">Eligible Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card B: College ERP Attendance */}
        <Card className="border-chart-2/30 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-secondary/5">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TableProperties className="h-5 w-5 text-secondary-foreground" /> My College ERP Attendance
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Corrected denominator across all eligible classes</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs font-semibold px-2.5 py-1">
              {stats.erp.percentage !== null ? `${stats.erp.percentage}%` : "N/A"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-extrabold tracking-tight">
                {stats.erp.percentage !== null ? `${stats.erp.percentage}%` : "N/A"}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Same Shared Denominator
              </span>
            </div>

            {stats.erp.percentage !== null ? (
              <Progress value={stats.erp.percentage} className="h-2.5" aria-label="ERP attendance percentage" />
            ) : null}

            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-500/10 p-2.5 border border-emerald-500/20">
                <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{stats.erp.presentCount}</p>
                <p className="text-[11px] text-muted-foreground">ERP Present</p>
              </div>
              <div className="rounded-lg bg-rose-500/10 p-2.5 border border-rose-500/20">
                <p className="font-bold text-rose-700 dark:text-rose-400 text-sm">{stats.erp.absentCount}</p>
                <p className="text-[11px] text-muted-foreground">ERP Absent</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/20">
                <p className="font-bold text-amber-700 dark:text-amber-400 text-sm">{stats.erpNotEnteredCount}</p>
                <p className="text-[11px] text-muted-foreground">Not Entered</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Semester-to-Date Overview & Metrics */}
      <Card className="mb-8 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-bold">Semester-to-Date Overview</CardTitle>
          <p className="text-xs text-muted-foreground">
            Aggregated statistics for all finalized completed sessions up to current trusted server time in IST.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="rounded-xl border bg-muted/30 p-3.5 space-y-1">
              <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Eligible Completed</span>
              <p className="text-2xl font-bold text-foreground">{stats.totalFinalized}</p>
              <p className="text-[10px] text-muted-foreground">Included in denominator</p>
            </div>
            <div className="rounded-xl border bg-sky-500/10 border-sky-500/20 p-3.5 space-y-1">
              <span className="text-sky-800 dark:text-sky-300 text-[11px] font-medium uppercase tracking-wider">Frozen (Excluded)</span>
              <p className="text-2xl font-bold text-sky-900 dark:text-sky-200">{frozenSessionsCount}</p>
              <p className="text-[10px] text-sky-700/80 dark:text-sky-400">Permanently cancelled</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3.5 space-y-1">
              <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Cancelled</span>
              <p className="text-2xl font-bold text-foreground">{cancelledSessionsCount}</p>
              <p className="text-[10px] text-muted-foreground">Excluded from totals</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3.5 space-y-1">
              <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Upcoming / In-Run</span>
              <p className="text-2xl font-bold text-foreground">{upcomingSessionsCount}</p>
              <p className="text-[10px] text-muted-foreground">Awaiting eligibility</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subject-Wise Analytics Breakdown */}
      <Card className="mb-8 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold">Subject-Wise Analytics Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">
              Detailed attendance breakdown for each subject using the shared eligible class denominator.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Theory">Theory</SelectItem>
                <SelectItem value="Practical">Practical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.code} — {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredSubjects.map((sub) => {
              const subSessions = sessions.filter(
                (s) => s.subjectId === sub.id && s.finalized && s.personalStatus !== "frozen" && (s.personalStatus === "present" || s.personalStatus === "absent")
              );
              const present = subSessions.filter((s) => s.personalStatus === "present").length;
              const total = subSessions.length;
              const pct = total === 0 ? null : Math.round((present / total) * 1000) / 10;
              
              const subErp = subSessions.filter((s) => s.erpStatus === "Present" || s.erpStatus === "Absent");
              const erpPresent = subErp.filter((s) => s.erpStatus === "Present").length;
              const erpPct = total === 0 ? null : Math.round((erpPresent / total) * 1000) / 10;
              const erpNotEntered = subSessions.filter((s) => s.erpStatus === null).length;
              const frozenCount = sessions.filter((s) => s.subjectId === sub.id && s.personalStatus === "frozen").length;

              return (
                <Card key={sub.id} className="border bg-card">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm">{sub.name}</h4>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {sub.code}
                          </Badge>
                          {frozenCount > 0 ? (
                            <span className="text-[10px] text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300 px-1.5 py-0.5 rounded border border-sky-200 flex items-center gap-1">
                              <Snowflake className="h-2.5 w-2.5" /> {frozenCount} Frozen
                            </span>
                          ) : null}
                        </div>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {sub.category}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">{pct !== null ? `${pct}%` : "N/A"}</span>
                        <p className="text-[10px] text-muted-foreground">AttendWise</p>
                      </div>
                    </div>

                    {pct !== null ? (
                      <Progress value={pct} className="h-2" aria-label={`${sub.name} attendance`} />
                    ) : (
                      <p className="text-xs text-muted-foreground">No finalized sessions yet</p>
                    )}

                    <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
                      <div className="rounded bg-muted/40 p-1.5">
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">{present}</p>
                        <p className="text-[10px] text-muted-foreground">Present</p>
                      </div>
                      <div className="rounded bg-muted/40 p-1.5">
                        <p className="font-semibold">{total}</p>
                        <p className="text-[10px] text-muted-foreground">Eligible</p>
                      </div>
                      <div className="rounded bg-muted/40 p-1.5">
                        <p className="font-semibold text-secondary-foreground">{erpPct !== null ? `${erpPct}%` : "N/A"}</p>
                        <p className="text-[10px] text-muted-foreground">ERP %</p>
                      </div>
                      <div className="rounded bg-muted/40 p-1.5">
                        <p className="font-semibold text-amber-700 dark:text-amber-400">{erpNotEntered}</p>
                        <p className="text-[10px] text-muted-foreground">No ERP</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ERP Comparison Breakdown Summary */}
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-bold">ERP & Record Comparison Summary</CardTitle>
          <p className="text-xs text-muted-foreground">
            Breakdown of matching records, potential discrepancies, and unentered ERP states.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl border p-4 bg-muted/30">
              <p className="text-muted-foreground text-xs font-medium">Matching Records</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.matchCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">AttendWise matches ERP observation</p>
            </div>
            <div className="rounded-xl border p-4 bg-muted/30">
              <p className="text-muted-foreground text-xs font-medium">Potential Discrepancies</p>
              <p className="mt-1 text-2xl font-bold text-chart-4">{stats.discrepancyCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">AttendWise and ERP differ</p>
            </div>
            <div className="rounded-xl border p-4 bg-muted/30">
              <p className="text-muted-foreground text-xs font-medium">ERP Not Entered</p>
              <p className="mt-1 text-2xl font-bold text-muted-foreground">{stats.erpNotEnteredCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Included in shared denominator</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AttendanceCardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={selectedSession}
        user={user}
        onRecordErp={onRecordErp}
        onFreezeClass={async (sid) => {
          if (onFreezeClass) {
            await onFreezeClass(sid);
          }
          setSelectedSession((prev) =>
            prev && prev.id === sid
              ? {
                  ...prev,
                  personalStatus: "frozen",
                  finalized: true,
                  frozenAt: new Date().toISOString(),
                  finalizedAt: new Date().toISOString(),
                }
              : prev
          );
        }}
      />
    </>
  );
}

// Session Detail View with Camera Capture
function SessionDetail({
  user,
  sessionId,
  sessions,
  onRecordErp,
  onMarkPresent,
}: {
  user: FirebaseUser;
  sessionId: string;
  sessions: ClassSessionItem[];
  onRecordErp?: (sessionId: string, status: "Present" | "Absent") => Promise<void>;
  onMarkPresent?: (sessionId: string, photoUrl?: string, note?: string, capturedAt?: string) => Promise<void>;
}) {
  const session = sessions.find((s) => s.id === sessionId);
  const [events, setEvents] = useState<AttendanceEventItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Live Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedPhotoAt, setCapturedPhotoAt] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Listen to attendance events for this session
  useEffect(() => {
    const q = collection(db, "users", user.uid, "attendanceEvents");
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AttendanceEventItem[] = [];
        snap.forEach((d) => {
          const item = d.data() as AttendanceEventItem;
          if (item.sessionId === sessionId) {
            list.push(item);
          }
        });
        list.sort((a, b) => new Date(b.serverTimestamp).getTime() - new Date(a.serverTimestamp).getTime());
        setEvents(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/attendanceEvents`);
      }
    );
    return () => unsub();
  }, [user.uid, sessionId]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (e: any) {
      setError("Camera permission denied or camera not found. You can still mark attendance without a photo.");
      setCameraActive(false);
    }
  };

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(videoRef.current.videoWidth || 320, 320);
    canvas.height = Math.min(videoRef.current.videoHeight || 240, 240);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
      const captureInstant = new Date().toISOString();
      setCapturedPhotoUrl(dataUrl);
      setCapturedPhotoAt(captureInstant);
    }
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleMarkPresent = async () => {
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (onMarkPresent) {
        await onMarkPresent(session.id, capturedPhotoUrl || undefined, undefined, capturedPhotoAt || undefined);
        setMessage("Attendance marked Present on AttendWise.");
      } else {
        const res = await markSessionPresent(user.uid, session.id, capturedPhotoUrl || undefined, undefined, capturedPhotoAt || undefined);
        setMessage(res.message);
      }
    } catch (err: any) {
      setError(err?.message || "Attendance could not be marked.");
    } finally {
      setBusy(false);
    }
  };

  const handleRecordErpDirect = async (status: "Present" | "Absent") => {
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (onRecordErp) {
        await onRecordErp(session.id, status);
      } else {
        await recordSessionErpStatus(user.uid, session.id, status);
      }
      setMessage(`ERP attendance status successfully recorded as ${status}.`);
    } catch (err: any) {
      setError(err?.message || "Could not record ERP status.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await cancelClassSession(user.uid, session.id);
      setConfirmCancel(false);
      setMessage("Class cancelled. It will not count toward attendance denominators.");
    } catch (err: any) {
      setError(err?.message || "Could not cancel class.");
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <EmptyState
        title="Class session not found"
        detail="The requested class session could not be located in your schedule."
        action={
          <Link href="/timetable" className="text-xs font-semibold text-primary hover:underline">
            Back to timetable
          </Link>
        }
      />
    );
  }

  const nowMs = Date.now();
  const startMs = new Date(session.scheduledStartAt).getTime();
  const endMs = new Date(session.scheduledEndAt).getTime();
  const inWindow = !session.finalized && nowMs >= startMs && nowMs < endMs;

  return (
    <>
      <PageHeading
        title={session.subjectName}
        description={`${session.subjectCode} (${session.category}) · ${formatDate(session.scheduledDate)}`}
        action={
          <Link href="/history" className="text-xs text-primary hover:underline">
            Back to history
          </Link>
        }
      />

      {message ? (
        <Alert className="mb-4">
          <CheckCircle2 className="h-4 w-4 text-accent-foreground" />
          <AlertDescription className="text-xs">{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <CircleAlert className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Session Details</CardTitle>
              <StateBadge status={session.personalStatus}>{sessionStatusLabel(session)}</StateBadge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Scheduled Interval · IST
                  </p>
                  <p className="mt-2 font-semibold text-sm">{formatDate(session.scheduledStartAt)}</p>
                  <p className="mt-1 text-xs">
                    {formatTime(session.scheduledStartAt)} – {formatTime(session.scheduledEndAt)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Server Receipt · IST
                  </p>
                  <p className="mt-2 font-semibold text-sm">
                    {session.serverReceiptAt ? formatDateTime(session.serverReceiptAt) : "Not recorded"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Authoritative server timestamps validate eligibility.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div>
                  <p className="text-muted-foreground">ERP Status</p>
                  <p className="mt-1 font-semibold">{session.erpStatus ?? "ERP Not Entered"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Finalization</p>
                  <p className="mt-1 font-semibold">
                    {session.finalizedAt ? formatDateTime(session.finalizedAt) : session.finalized ? "Finalized" : "Pending"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Room / Lab</p>
                  <p className="mt-1 font-semibold">{session.room ?? "SISTec Campus"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Optional Photo Evidence</p>
                  <p className="mt-1 font-semibold">
                    {(session.photoDataUrl || session.evidenceAvailable) ? "Photo Context Saved" : "No photo attached"}
                  </p>
                </div>
              </div>

              {(session.photoDataUrl || session.evidenceStoragePath || session.evidenceAvailable) ? (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5" /> Captured Proof Photo (Locked)
                    </span>
                    {(session.clientCaptureAt || session.serverReceiptAt) && (
                      <span className="text-[11px] font-mono text-muted-foreground font-normal">
                        Captured: {formatClock(session.clientCaptureAt || session.serverReceiptAt!)} IST
                      </span>
                    )}
                  </div>
                  {session.photoDataUrl ? (
                    <img src={session.photoDataUrl} alt="Captured proof" className="w-full h-44 object-cover rounded-md border" />
                  ) : (
                    <EvidenceSnapshotThumbnail session={session} />
                  )}
                </div>
              ) : null}

              {session.note ? (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary" /> Keynote / Explanation (Locked)
                  </p>
                  <p className="text-xs text-foreground bg-card p-2.5 rounded border font-medium">&quot;{session.note}&quot;</p>
                </div>
              ) : null}

              <Alert className="text-xs bg-muted/30">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <AlertDescription>
                  Attendance window is strictly enforced: marks are accepted only between the scheduled start and end instant.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance Event Timeline</CardTitle>
              <p className="text-xs text-muted-foreground">Authoritative audit log stored in Firestore.</p>
            </CardHeader>
            <CardContent>
              {events.length ? (
                <ol className="space-y-4">
                  {events.map((ev) => (
                    <li key={ev.id} className="flex gap-3 text-xs">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-primary mt-0.5">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{ev.message}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(ev.serverTimestamp)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  title="No timeline events"
                  detail="Events will be logged automatically as actions occur on this session."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Session Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inWindow ? (
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Class interval active: {formatTime(session.scheduledStartAt)} – {formatTime(session.scheduledEndAt)}.
                  </p>

                  {/* Optional Camera Capture Section */}
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold">Optional Photo Context</p>

                    {cameraActive ? (
                      <div className="space-y-2">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-40 object-cover rounded-lg border bg-black"
                        />
                        <Button size="sm" onClick={snapPhoto} className="w-full text-xs">
                          <Camera className="h-3.5 w-3.5 mr-1.5" /> Snap Photo
                        </Button>
                      </div>
                    ) : capturedPhotoUrl ? (
                      <div className="space-y-2">
                        <img
                          src={capturedPhotoUrl}
                          alt="Captured photo preview"
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCapturedPhotoUrl(null)}
                          className="w-full text-xs"
                        >
                          Retake / Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={startCamera}
                        className="w-full text-xs"
                      >
                        <Camera className="h-3.5 w-3.5 mr-1.5" /> Enable Live Camera (Optional)
                      </Button>
                    )}
                  </div>

                  <Button
                    className="w-full mt-2 font-medium"
                    disabled={busy}
                    onClick={handleMarkPresent}
                  >
                    {busy ? "Validating & Recording…" : "Mark Present"}
                    <CheckCircle2 className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground leading-relaxed">
                  {session.personalStatus === "present"
                    ? "Attendance marked Present on AttendWise. Verified by server timestamp."
                    : session.personalStatus === "cancelled"
                    ? "This session was cancelled and is excluded from attendance percentages."
                    : session.personalStatus === "absent" || Date.now() >= new Date(session.scheduledEndAt).getTime()
                    ? `Attendance window is closed (${formatTime(session.scheduledStartAt)} – ${formatTime(session.scheduledEndAt)} IST). Automatically recorded as Absent on AttendWise.`
                    : `Attendance window is not open yet. Scheduled: ${formatTime(session.scheduledStartAt)} – ${formatTime(session.scheduledEndAt)} IST.`}
                </div>
              )}

              {/* College ERP Attendance Section - always visible and enabled even when class timing is gone */}
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <TableProperties className="h-3.5 w-3.5 text-primary" />
                      Mark Attendance on ERP
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Record status observed on college ERP portal.
                    </p>
                  </div>
                  {session.erpStatus ? (
                    <Badge
                      variant="outline"
                      className={
                        session.erpStatus === "Present"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs font-medium"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 text-xs font-medium"
                      }
                    >
                      ERP: {session.erpStatus} (Locked)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      ERP: Not Recorded
                    </Badge>
                  )}
                </div>

                {session.erpStatus !== null ? (
                  <div className="rounded-lg bg-card p-3 border text-xs">
                    <p className="font-medium text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-primary" /> ERP Record Finalized
                    </p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      ERP status has been permanently recorded as <strong>{session.erpStatus}</strong> and cannot be altered.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs font-medium border-emerald-500/40 hover:bg-emerald-600 hover:text-white"
                        disabled={busy}
                        onClick={() => handleRecordErpDirect("Present")}
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" /> Mark Present on ERP
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs font-medium border-rose-500/40 hover:bg-rose-600 hover:text-white"
                        disabled={busy}
                        onClick={() => handleRecordErpDirect("Absent")}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" /> Mark Absent on ERP
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      ERP attendance can be recorded before, during, or after class. Once recorded, it is permanent and uneditable.
                    </p>
                  </div>
                )}
              </div>

              {!session.finalized && session.personalStatus === "upcoming" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancel this class
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Class Session?</DialogTitle>
            <DialogDescription>
              Cancelled classes are not counted as absences and are excluded from attendance denominators.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep Class
            </Button>
            <Button variant="destructive" disabled={busy} onClick={handleCancel}>
              {busy ? "Cancelling…" : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Profile & Settings View
function ProfileView({
  user,
  profile,
  onLogout,
}: {
  user: FirebaseUser;
  profile?: StudentProfile | null;
  onLogout: () => void;
}) {
  const [target, setTarget] = useState(profile?.attendanceTarget ?? 75);
  const [saved, setSaved] = useState(false);

  const saveTarget = async () => {
    try {
      await updateDoc(doc(db, "users", user.uid), {
        attendanceTarget: Number(target),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <PageHeading title="Profile & Settings" description="Your authenticated SISTec student account information." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Student Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/20 text-lg font-bold text-primary">
                {profile?.displayName?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ST"}
              </span>
              <div>
                <p className="font-bold text-base">{profile?.displayName || "Student"}</p>
                <p className="text-xs text-muted-foreground">{profile?.email || user.email}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">
                  SISTec Student
                </Badge>
              </div>
            </div>

            <Separator />

            <dl className="space-y-3.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Institution</dt>
                <dd className="font-medium text-right">{SISTEC_METADATA.institution}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Course & Semester</dt>
                <dd className="font-medium">{SISTEC_METADATA.course}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Academic Session</dt>
                <dd className="font-medium">{SISTEC_METADATA.session}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Timezone</dt>
                <dd className="font-medium">India Standard Time (Asia/Kolkata)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Student UID</dt>
                <dd className="font-mono text-[11px] text-muted-foreground">{user.uid}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Target</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target-input" className="text-xs">
                  Personal Target Percentage
                </Label>
                <div className="flex gap-3">
                  <Input
                    id="target-input"
                    type="number"
                    min={50}
                    max={100}
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                  />
                  <Button onClick={saveTarget} size="sm">
                    Save Target
                  </Button>
                </div>
                {saved ? <p className="text-xs text-accent-foreground font-medium">Target updated successfully!</p> : null}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The standard SISTec college recommendation is 75%. This goal is used to measure your progress on the dashboard.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account & Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Signed in with Firebase Authentication. To sign out of your account on this device:
              </p>
              <Button variant="outline" size="sm" onClick={onLogout} className="text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// Router and Main Application
export default function App() {
  const [user, setUser] = useState<AppStudentUser | FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [sessions, setSessions] = useState<ClassSessionItem[]>([]);
  const [sessionsInitialLoading, setSessionsInitialLoading] = useState(true);
  const [, setLocation] = useLocation();

  // Listen to Firebase Auth state
  useEffect(() => {
    const sessionActive =
      localStorage.getItem("attendwise_session_active") ||
      sessionStorage.getItem("attendwise_session_active");

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        localStorage.setItem("attendwise_session_active", "true");
        sessionStorage.setItem("attendwise_session_active", "true");
        setUser((prev) => (prev?.uid === currentUser.uid ? prev : currentUser));
      } else {
        // If not in Firebase Auth, check local student session
        const localActive = getStoredActiveSession();
        if (localActive && sessionActive) {
          localStorage.setItem("attendwise_session_active", "true");
          sessionStorage.setItem("attendwise_session_active", "true");
          setUser((prev) => (prev?.uid === localActive.uid ? prev : localActive));
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to Firestore data when user is authenticated with Firebase, or initialize local SISTec data
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setSubjects([]);
      setTimetable([]);
      setSessions([]);
      setSessionsInitialLoading(true);
      return;
    }

    // 1. UNIVERSAL DEFAULT SEEDING:
    // Build default authentic SISTec data immediately for this student (all 13 subjects, 36 timetable slots, and all 492 sessions)
    // This guarantees that ANY user account (existing, newly created, or created in the future) starts with the exact same
    // universal denominator of 192 (66 Python training sessions Sept 7–19 + 126 regular classes held so far) with 0 present (no pre-assumed present).
    const defaultData = buildDefaultSistecData(user.uid);

    // If local student session overrides exist in localStorage, restore them
    const localStoreKey = `attendwise_student_sessions_${user.uid}`;
    let initialSessions = defaultData.sessions;
    let hasConfirmedLocalData = false;
    try {
      const stored = localStorage.getItem(localStoreKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, Partial<ClassSessionItem>>;
        if (Object.keys(parsed).length > 0) {
          hasConfirmedLocalData = true;
          initialSessions = defaultData.sessions.map((s) => {
            if (parsed[s.id]) {
              return { ...s, ...parsed[s.id] };
            }
            return s;
          });
        }
      }
    } catch (e) {
      console.warn("Failed to load student local session overrides:", e);
    }

    setSubjects(defaultData.subjects);
    setTimetable(defaultData.timetable);
    setSessions(initialSessions);

    setProfile({
      id: user.uid,
      displayName: user.displayName || "Student",
      email: user.email || "",
      timezone: TIMEZONE,
      attendanceTarget: 75,
      institution: SISTEC_METADATA.institution,
      course: SISTEC_METADATA.course,
      createdAt: new Date().toISOString(),
    });

    if (auth.currentUser && auth.currentUser.uid === user.uid) {
      // Ensure Firestore has all SISTec subjects, timetable slots, and Python training seeded
      ensureSistecTimetableLoaded(user.uid).catch((err) => {
        console.warn("Firestore timetable sync background notice:", err);
      });

      // 1. Profile listener
      const unsubProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as StudentProfile);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      );

      // 2. Subjects listener
      const unsubSubjects = onSnapshot(
        collection(db, "users", user.uid, "subjects"),
        (snap) => {
          if (!snap.empty) {
            const list: SubjectItem[] = [];
            snap.forEach((d) => list.push(d.data() as SubjectItem));
            // Ensure Python Training subject is always present
            if (!list.some((s) => s.id === PYTHON_TRAINING_SUBJECT.id)) {
              const pySub = defaultData.subjects.find((s) => s.id === PYTHON_TRAINING_SUBJECT.id);
              if (pySub) list.push(pySub);
            }
            setSubjects(list);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}/subjects`);
        }
      );

      // 3. Timetable listener
      const unsubTimetable = onSnapshot(
        collection(db, "users", user.uid, "timetableEntries"),
        (snap) => {
          if (!snap.empty) {
            const list: TimetableItem[] = [];
            snap.forEach((d) => list.push(d.data() as TimetableItem));
            setTimetable(list);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}/timetableEntries`);
        }
      );

      // 4. Class sessions listener (Cloud-First authoritative source of truth)
      const unsubSessions = onSnapshot(
        collection(db, "users", user.uid, "classSessions"),
        (snap) => {
          if (snap.empty) {
            ensureSistecTimetableLoaded(user.uid).catch(console.warn);
            setSessionsInitialLoading(false);
            return;
          }

          const firestoreMap = new Map<string, ClassSessionItem>();
          const slotMap = new Map<string, ClassSessionItem>();

          snap.forEach((d) => {
            const data = d.data() as ClassSessionItem;
            const item: ClassSessionItem = { ...data, id: d.id || data.id };
            firestoreMap.set(d.id, item);
            if (item.id) {
              firestoreMap.set(item.id, item);
            }
            if (item.scheduledDate && item.slot) {
              slotMap.set(`${item.scheduledDate}_${item.slot}`, item);
            }
          });

          let missingTrainingCount = 0;
          const mergedList: ClassSessionItem[] = defaultData.sessions.map((defaultSession) => {
            const fsSession =
              firestoreMap.get(defaultSession.id) ||
              slotMap.get(`${defaultSession.scheduledDate}_${defaultSession.slot}`);
            if (fsSession) {
              return fsSession;
            }
            if (defaultSession.subjectId === "sub-python-training") {
              missingTrainingCount++;
            }
            return defaultSession;
          });

          firestoreMap.forEach((fsSession, fsId) => {
            if (
              !mergedList.some(
                (ds) =>
                  ds.id === fsId ||
                  (ds.scheduledDate === fsSession.scheduledDate && ds.slot === fsSession.slot)
              )
            ) {
              mergedList.push(fsSession);
            }
          });

          setSessions(mergedList);
          setSessionsInitialLoading(false);

          if (missingTrainingCount > 0) {
            ensurePythonTrainingLoaded(user.uid).catch(console.warn);
          }

          void finalizeExpiredSessionsForStudent(user.uid, mergedList);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}/classSessions`);
        }
      );

      return () => {
        try { unsubProfile(); } catch {}
        try { unsubSubjects(); } catch {}
        try { unsubTimetable(); } catch {}
        try { unsubSessions(); } catch {}
      };
    }
  }, [user?.uid]);

  const handleLogout = async () => {
    localStorage.removeItem("attendwise_session_active");
    sessionStorage.removeItem("attendwise_session_active");
    await logoutStudentUser();
    await logOutStudent().catch(() => {});
    setUser(null);
    setProfile(null);
    setSubjects([]);
    setTimetable([]);
    setSessions([]);
    setSessionsInitialLoading(true);
    setLocation("/");
  };

  // Helper to persist student session modifications to local storage for instant offline resilience
  const persistLocalSessionOverride = (sessionId: string, patch: Partial<ClassSessionItem>) => {
    if (!user) return;
    try {
      const key = `attendwise_student_sessions_${user.uid}`;
      const existing = localStorage.getItem(key);
      const parsed = existing ? JSON.parse(existing) : {};
      // Preserve compressed thumbnail photoDataUrl (<100KB) in local storage for instant reloads
      const safePatch = { ...patch };
      if (safePatch.photoDataUrl && safePatch.photoDataUrl.length > 100000) {
        delete safePatch.photoDataUrl;
      }
      parsed[sessionId] = { ...(parsed[sessionId] || {}), ...safePatch };
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch (e) {
      console.warn("Failed to persist local session override:", e);
    }
  };

  // Real-time optimistic action handlers using functional state updates (Zero stale-closure risk)
  const handleSaveCompleteAttendance = async (
    sessionId: string,
    payload: CompleteAttendancePayload
  ) => {
    if (!user || !auth.currentUser || auth.currentUser.uid !== user.uid) {
      throw new Error("You must be logged in as an authenticated student to record attendance.");
    }
    const prevSession = sessions.find((s) => s.id === sessionId);
    const nowIso = new Date().toISOString();
    const finalCapturedAt = payload.clientCapturedAt || (payload.photoDataUrl ? nowIso : undefined);
    const cleanNote = payload.note !== undefined ? (payload.note?.trim() || null) : undefined;

    // 1. Instant optimistic update using functional state updater
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const newPersonalStatus =
          payload.personalStatus !== undefined && payload.personalStatus !== null
            ? payload.personalStatus
            : s.personalStatus;
        const isStatusFinalized = Boolean(
          s.finalized ||
          newPersonalStatus === "present" ||
          newPersonalStatus === "absent" ||
          newPersonalStatus === "frozen" ||
          newPersonalStatus === "cancelled"
        );
        return {
          ...s,
          personalStatus: newPersonalStatus,
          absentType: newPersonalStatus === "absent" ? ("manual_student" as const) : s.absentType,
          finalized: isStatusFinalized,
          finalizedAt: newPersonalStatus === "present" || newPersonalStatus === "absent" ? (s.finalizedAt || nowIso) : s.finalizedAt,
          serverReceiptAt: newPersonalStatus === "present" ? (s.serverReceiptAt || nowIso) : s.serverReceiptAt,
          clientCaptureAt: newPersonalStatus === "present" || payload.photoDataUrl ? (finalCapturedAt || s.clientCaptureAt || nowIso) : s.clientCaptureAt,
          photoDataUrl: payload.photoDataUrl !== undefined ? payload.photoDataUrl : s.photoDataUrl,
          evidenceAvailable: Boolean(payload.photoDataUrl || s.photoDataUrl || s.evidenceAvailable),
          note: cleanNote !== undefined ? cleanNote : s.note,
          erpStatus: payload.erpStatus !== undefined && payload.erpStatus !== null ? payload.erpStatus : s.erpStatus,
          erpRecordedAt: payload.erpStatus && !s.erpStatus ? nowIso : s.erpRecordedAt,
        };
      });
      void setCachedStore("sessions", updated).catch(() => {});
      return updated;
    });

    // 2. Persist complete record atomically to Cloud Firestore
    try {
      const result = await saveCompleteAttendanceRecord(user.uid, sessionId, payload);

      persistLocalSessionOverride(sessionId, {
        personalStatus: result.session.personalStatus,
        erpStatus: result.session.erpStatus,
        note: result.session.note,
        evidenceAvailable: result.session.evidenceAvailable,
        photoDataUrl: result.session.photoDataUrl,
        evidenceStoragePath: result.session.evidenceStoragePath,
        finalized: result.session.finalized,
        finalizedAt: result.session.finalizedAt,
        serverReceiptAt: result.session.serverReceiptAt,
        clientCaptureAt: result.session.clientCaptureAt,
      });

      // Update state with server confirmed session
      setSessions((prev) => {
        const confirmed = prev.map((s) => (s.id === sessionId ? { ...s, ...result.session } : s));
        void setCachedStore("sessions", confirmed).catch(() => {});
        return confirmed;
      });
    } catch (err) {
      if (prevSession) {
        setSessions((prev) => {
          const reverted = prev.map((s) => (s.id === sessionId ? prevSession : s));
          void setCachedStore("sessions", reverted).catch(() => {});
          return reverted;
        });
      }
      throw err;
    }
  };

  const handleRecordErp = async (sessionId: string, status: "Present" | "Absent") => {
    if (!user || !auth.currentUser || auth.currentUser.uid !== user.uid) {
      throw new Error("You must be logged in as an authenticated student to record ERP attendance.");
    }
    const prevSession = sessions.find((s) => s.id === sessionId);

    // 1. Instant optimistic update using functional updater
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, erpStatus: status } : s));
      void setCachedStore("sessions", updated).catch(() => {});
      return updated;
    });

    // 2. Persist to Firestore with rollback on error:
    try {
      await recordSessionErpStatus(user.uid, sessionId, status);
      persistLocalSessionOverride(sessionId, { erpStatus: status });
    } catch (err) {
      if (prevSession) {
        setSessions((prev) => {
          const reverted = prev.map((s) => (s.id === sessionId ? prevSession : s));
          void setCachedStore("sessions", reverted).catch(() => {});
          return reverted;
        });
      }
      throw err;
    }
  };

  const handleMarkPresentQuick = async (sessionId: string, photoUrl?: string, note?: string, capturedAt?: string) => {
    if (!user || !auth.currentUser || auth.currentUser.uid !== user.uid) {
      throw new Error("You must be logged in as an authenticated student to record attendance.");
    }
    const prevSession = sessions.find((s) => s.id === sessionId);
    const nowIso = new Date().toISOString();
    const finalCapturedAt = capturedAt || (photoUrl ? nowIso : undefined);

    // 1. Instant optimistic update using functional updater
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              personalStatus: "present" as const,
              finalized: true,
              finalizedAt: nowIso,
              serverReceiptAt: nowIso,
              clientCaptureAt: finalCapturedAt || s.clientCaptureAt,
              photoDataUrl: photoUrl || s.photoDataUrl,
              evidenceAvailable: Boolean(photoUrl || s.photoDataUrl || s.evidenceAvailable),
              note: note !== undefined ? note : s.note,
            }
          : s
      );
      void setCachedStore("sessions", updated).catch(() => {});
      return updated;
    });

    // 2. Persist to Firestore with rollback on error:
    try {
      await markSessionPresent(user.uid, sessionId, photoUrl, note, finalCapturedAt);
      persistLocalSessionOverride(sessionId, {
        personalStatus: "present",
        finalized: true,
        finalizedAt: nowIso,
        serverReceiptAt: nowIso,
        clientCaptureAt: finalCapturedAt || prevSession?.clientCaptureAt,
        evidenceAvailable: Boolean(photoUrl || prevSession?.photoDataUrl || prevSession?.evidenceAvailable),
        ...(note !== undefined ? { note } : {}),
      });
    } catch (err) {
      if (prevSession) {
        setSessions((prev) => {
          const reverted = prev.map((s) => (s.id === sessionId ? prevSession : s));
          void setCachedStore("sessions", reverted).catch(() => {});
          return reverted;
        });
      }
      throw err;
    }
  };

  const handleMarkAbsentQuick = async (sessionId: string, note?: string) => {
    if (!user || !auth.currentUser || auth.currentUser.uid !== user.uid) {
      throw new Error("You must be logged in as an authenticated student to record attendance.");
    }
    const prevSession = sessions.find((s) => s.id === sessionId);
    const nowIso = new Date().toISOString();

    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              personalStatus: "absent" as const,
              absentType: "manual_student" as const,
              finalized: true,
              finalizedAt: nowIso,
              note: note !== undefined ? note : s.note,
            }
          : s
      );
      void setCachedStore("sessions", updated).catch(() => {});
      return updated;
    });

    try {
      await markSessionAbsent(user.uid, sessionId, note);
      persistLocalSessionOverride(sessionId, {
        personalStatus: "absent",
        absentType: "manual_student",
        finalized: true,
        finalizedAt: nowIso,
        ...(note !== undefined ? { note } : {}),
      });
    } catch (err) {
      if (prevSession) {
        setSessions((prev) => {
          const reverted = prev.map((s) => (s.id === sessionId ? prevSession : s));
          void setCachedStore("sessions", reverted).catch(() => {});
          return reverted;
        });
      }
      throw err;
    }
  };

  const handleFreezeClassQuick = async (sessionId: string, reason?: string) => {
    const nowIso = new Date().toISOString();
    const cleanReason = reason?.trim() || null;
    const currentS = sessions.find((s) => s.id === sessionId);
    const targetStatus = currentS?.personalStatus === "present" ? ("present" as const) : ("frozen" as const);
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              isFrozen: true,
              frozenAt: nowIso,
              freezeReason: cleanReason,
              finalized: true,
              finalizedAt: nowIso,
              personalStatus: s.personalStatus === "present" ? ("present" as const) : ("frozen" as const),
              previousPersonalStatus: s.personalStatus !== "frozen" ? s.personalStatus : "absent",
              previousErpStatus: s.erpStatus ?? null,
            }
          : s
      );
      void setCachedStore("sessions", updated).catch(() => {});
      return updated;
    });
    persistLocalSessionOverride(sessionId, {
      isFrozen: true,
      frozenAt: nowIso,
      freezeReason: cleanReason,
      personalStatus: targetStatus,
      finalized: true,
      finalizedAt: nowIso,
      previousPersonalStatus: currentS && currentS.personalStatus !== "frozen" ? currentS.personalStatus : "absent",
      previousErpStatus: currentS?.erpStatus ?? null,
    });
    if (user) {
      await freezeClassSession(user.uid, sessionId, cleanReason || undefined);
    }
  };

  const handleUnfreezeClassQuick = async (sessionId: string) => {
    const currentS = sessions.find((s) => s.id === sessionId);
    const restoredStatus =
      (currentS as any)?.previousPersonalStatus === "present" ? "present" : "absent";
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          isFrozen: false,
          frozenAt: null,
          freezeReason: null,
          personalStatus: restoredStatus as const,
          finalized: true,
        };
      });
      void setCachedStore("sessions", updated).catch(() => {});
      return updated;
    });
    persistLocalSessionOverride(sessionId, {
      isFrozen: false,
      frozenAt: null,
      freezeReason: null,
      personalStatus: restoredStatus,
      finalized: true,
    });
    if (user) {
      await unfreezeClassSession(user.uid, sessionId);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingBlock />
      </div>
    );
  }

  if (!user) {
    return <LandingPage onAuthSuccess={(loggedInUser) => {
      localStorage.setItem("attendwise_session_active", "true");
      sessionStorage.setItem("attendwise_session_active", "true");
      const active = loggedInUser || auth.currentUser || getStoredActiveSession();
      if (active) {
        setUser(active);
        setLocation("/dashboard");
      }
    }} />;
  }

  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Shell profile={profile} onLogout={handleLogout}>
          <ErrorBoundary>
            <Switch>
              <Route
                path="/"
                component={() => (
                  <Dashboard
                    user={user}
                    profile={profile}
                    sessions={sessions}
                    subjects={subjects}
                    sessionsInitialLoading={sessionsInitialLoading}
                    onRecordErp={handleRecordErp}
                    onMarkPresent={handleMarkPresentQuick}
                    onMarkAbsent={handleMarkAbsentQuick}
                    onFreezeClass={handleFreezeClassQuick}
                    onSaveCompleteAttendance={handleSaveCompleteAttendance}
                  />
                )}
              />
              <Route
                path="/dashboard"
                component={() => (
                  <Dashboard
                    user={user}
                    profile={profile}
                    sessions={sessions}
                    subjects={subjects}
                    sessionsInitialLoading={sessionsInitialLoading}
                    onRecordErp={handleRecordErp}
                    onMarkPresent={handleMarkPresentQuick}
                    onMarkAbsent={handleMarkAbsentQuick}
                    onFreezeClass={handleFreezeClassQuick}
                    onSaveCompleteAttendance={handleSaveCompleteAttendance}
                  />
                )}
              />
              <Route
                path="/analytics"
                component={() => (
                  <AnalyticsPage
                    user={user}
                    profile={profile}
                    sessions={sessions}
                    subjects={subjects}
                    onRecordErp={handleRecordErp}
                    onFreezeClass={handleFreezeClassQuick}
                    onUnfreezeClass={handleUnfreezeClassQuick}
                  />
                )}
              />
              <Route
                path="/timetable"
                component={() => <Timetable user={user} timetable={timetable} subjects={subjects} />}
              />
              <Route path="/calendar" component={AcademicCalendarView} />
              <Route
                path="/history"
                component={() => (
                  <AttendanceHistory
                    user={user}
                    sessions={sessions}
                    subjects={subjects}
                    sessionsInitialLoading={sessionsInitialLoading}
                    onRecordErp={handleRecordErp}
                    onMarkPresent={handleMarkPresentQuick}
                    onMarkAbsent={handleMarkAbsentQuick}
                    onFreezeClass={handleFreezeClassQuick}
                    onSaveCompleteAttendance={handleSaveCompleteAttendance}
                  />
                )}
              />
              <Route
                path="/subjects"
                component={() => <Subjects user={user} subjects={subjects} sessions={sessions} />}
              />
              <Route
                path="/comparison"
                component={() => (
                  <Comparison user={user} sessions={sessions} onRecordErp={handleRecordErp} onFreezeClass={handleFreezeClassQuick} />
                )}
              />
              <Route
                path="/profile"
                component={() => <ProfileView user={user} profile={profile} onLogout={handleLogout} />}
              />
              <Route path="/session/:sessionId">
                {(params) => (
                  <SessionDetail
                    user={user}
                    sessionId={params.sessionId}
                    sessions={sessions}
                    onRecordErp={handleRecordErp}
                    onMarkPresent={handleMarkPresentQuick}
                  />
                )}
              </Route>
              <Route component={NotFound} />
            </Switch>
          </ErrorBoundary>
        </Shell>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}
