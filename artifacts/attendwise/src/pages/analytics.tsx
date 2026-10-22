import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Snowflake,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowRight,
  Filter,
  Info,
  Check,
  X,
  Layers,
  ChevronRight,
  Sparkles,
  HelpCircle,
  BookOpen,
  CalendarDays,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/attendwise-design-system/components/ui/card";
import { Badge } from "@workspace/attendwise-design-system/components/ui/badge";
import { Button } from "@workspace/attendwise-design-system/components/ui/button";
import { Progress } from "@workspace/attendwise-design-system/components/ui/progress";
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
import { Separator } from "@workspace/attendwise-design-system/components/ui/separator";
import {
  computeFullAnalytics,
  type FullAnalyticsSummary,
  type SessionLike,
  type SubjectAnalyticsItem,
} from "../lib/analytics-calculator";
import {
  TIMEZONE,
  type ClassSessionItem,
  type SubjectItem,
  type StudentProfile,
} from "../lib/firebase";
import { SISTEC_METADATA } from "../data/sistec-timetable";
import { isTeachingDay } from "../data/sistec-calendar";

interface AnalyticsPageProps {
  user: { uid: string; email?: string | null; displayName?: string | null };
  profile?: StudentProfile | null;
  sessions: ClassSessionItem[];
  subjects: SubjectItem[];
  isLoading?: boolean;
  onRecordErp?: (sessionId: string, status: "Present" | "Absent") => Promise<void>;
  onFreezeClass?: (sessionId: string) => Promise<void>;
  onUnfreezeClass?: (sessionId: string) => Promise<void>;
}

const timeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatClock(isoString?: string | null) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return isNaN(d.getTime()) ? "—" : timeFmt.format(d);
  } catch {
    return "—";
  }
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T12:00:00+05:30");
    return isNaN(d.getTime()) ? dateStr : dateFmt.format(d);
  } catch {
    return dateStr;
  }
}

export default function AnalyticsPage({
  user,
  profile,
  sessions,
  subjects,
  isLoading = false,
  onRecordErp,
  onFreezeClass,
  onUnfreezeClass,
}: AnalyticsPageProps) {
  // Real-time tick to keep current server time accurate
  const [currentTick, setCurrentTick] = useState(() => Date.now());
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [selectedSessionForAction, setSelectedSessionForAction] = useState<ClassSessionItem | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Centralized calculations using authoritative trusted time
  const analytics: FullAnalyticsSummary = useMemo(() => {
    return computeFullAnalytics(sessions, currentTick);
  }, [sessions, currentTick]);

  const targetPercentage = profile?.attendanceTarget ?? 75;

  // Filtered subjects for subject-wise section
  const filteredSubjects = useMemo(() => {
    return analytics.subjects.filter((sub) => {
      if (categoryFilter !== "all" && sub.category !== categoryFilter) return false;
      if (subjectFilter !== "all" && sub.subjectId !== subjectFilter) return false;
      return true;
    });
  }, [analytics.subjects, categoryFilter, subjectFilter]);

  // Discrepancy sessions (where ERP status is entered but differs from personal status)
  const discrepancySessions = useMemo(() => {
    return analytics.eligibleSessions.filter((s) => {
      if (s.erpStatus !== "Present" && s.erpStatus !== "Absent") return false;
      const personalAsErp = s.personalStatus === "present" ? "Present" : "Absent";
      return s.erpStatus !== personalAsErp;
    });
  }, [analytics.eligibleSessions]);

  // Unentered ERP eligible sessions
  const unenteredErpSessions = useMemo(() => {
    return analytics.eligibleSessions.filter(
      (s) => s.erpStatus === null || s.erpStatus === undefined
    );
  }, [analytics.eligibleSessions]);

  // Frozen sessions
  const frozenSessions = useMemo(() => {
    return sessions.filter((s) => s.personalStatus === "frozen");
  }, [sessions]);

  const handleRecordErpDirect = async (sessionId: string, status: "Present" | "Absent") => {
    if (!onRecordErp) return;
    setActionBusy(true);
    setActionFeedback(null);
    try {
      await onRecordErp(sessionId, status);
      setActionFeedback(`ERP status recorded as ${status}.`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (e: any) {
      setActionFeedback(e?.message || "Failed to record ERP status.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleFreezeToggle = async (session: ClassSessionItem) => {
    setActionBusy(true);
    setActionFeedback(null);
    try {
      if (session.personalStatus === "frozen") {
        if (onUnfreezeClass) {
          await onUnfreezeClass(session.id);
          setActionFeedback("Class unfrozen and restored to attendance calculations.");
        }
      } else {
        if (onFreezeClass) {
          await onFreezeClass(session.id);
          setActionFeedback("Class frozen and permanently excluded from calculations.");
        }
      }
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (e: any) {
      setActionFeedback(e?.message || "Action failed.");
    } finally {
      setActionBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-label="Loading analytics">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const hasEligibleClasses = analytics.overview.totalEligibleCompleted > 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analytics Dashboard</h1>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs font-semibold">
              Real-Time IST
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Semester-to-date attendance metrics for {SISTEC_METADATA.course} · {SISTEC_METADATA.session}.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFormulaModal(true)}
            className="text-xs h-9 gap-1.5"
          >
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            Calculation Rules
          </Button>
          <div className="rounded-lg border bg-card px-3 py-1.5 text-right shadow-xs hidden sm:block">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              Academic Target
            </span>
            <span className="text-xs font-bold text-primary">{targetPercentage}% Attendance</span>
          </div>
        </div>
      </div>

      {actionFeedback ? (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs font-medium text-primary flex items-center justify-between">
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="text-primary hover:opacity-80">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* =========================================================================
          PART 7.1 — TWO PROMINENT ATTENDANCE CARDS
          AttendWise and ERP must display identical totalEligible shared denominator
      ========================================================================= */}
      <section aria-labelledby="primary-metrics-heading">
        <h2 id="primary-metrics-heading" className="sr-only">
          Primary Attendance Percentages
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* CARD A: My AttendWise Attendance */}
          <Card className="relative overflow-hidden border-2 border-primary/20 bg-card shadow-sm transition-all hover:border-primary/40">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-indigo-500 to-primary/80" />
            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base font-semibold">My AttendWise Attendance</CardTitle>
                    <CardDescription className="text-xs">
                      Authoritative student check-ins verified inside scheduled class intervals
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono bg-muted/40">
                  Target: {targetPercentage}%
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                    {analytics.overall.percentage !== null
                      ? `${analytics.overall.percentage}%`
                      : "N/A"}
                  </span>
                  {analytics.overall.percentage !== null ? (
                    <span
                      className={`ml-2 text-xs font-semibold ${
                        analytics.overall.percentage >= targetPercentage
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {analytics.overall.percentage >= targetPercentage
                        ? `(+${(analytics.overall.percentage - targetPercentage).toFixed(1)}% above target)`
                        : `(-${(targetPercentage - analytics.overall.percentage).toFixed(1)}% below target)`}
                    </span>
                  ) : null}
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Eligible Completed Classes</span>
                  <span className="text-lg font-bold font-mono text-foreground">
                    {analytics.overall.totalEligible}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <Progress
                  value={analytics.overall.percentage ?? 0}
                  className={`h-2.5 rounded-full ${
                    (analytics.overall.percentage ?? 0) >= targetPercentage
                      ? "[&>div]:bg-emerald-600"
                      : "[&>div]:bg-rose-500"
                  }`}
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>0%</span>
                  <span className="font-medium text-foreground">Target {targetPercentage}%</span>
                  <span>100%</span>
                </div>
              </div>

              <Separator />

              {/* Granular count stats */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-emerald-500/10 p-2.5 border border-emerald-500/20">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                    Present
                  </span>
                  <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                    {analytics.overall.presentCount}
                  </span>
                </div>
                <div className="rounded-lg bg-rose-500/10 p-2.5 border border-rose-500/20">
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">
                    Absent
                  </span>
                  <span className="text-lg font-bold text-rose-800 dark:text-rose-300">
                    {analytics.overall.absentCount}
                  </span>
                </div>
                <div className="rounded-lg bg-muted/60 p-2.5 border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Denominator
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {analytics.overall.totalEligible}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  Formula: {analytics.overall.presentCount} Present ÷ {analytics.overall.totalEligible} Eligible Classes ={" "}
                  <strong>{analytics.overall.percentage !== null ? `${analytics.overall.percentage}%` : "N/A"}</strong>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* CARD B: My College ERP Attendance */}
          <Card className="relative overflow-hidden border-2 border-indigo-500/20 bg-card shadow-sm transition-all hover:border-indigo-500/40">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-600" />
            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base font-semibold">My College ERP Attendance</CardTitle>
                    <CardDescription className="text-xs">
                      Official status observed on the SISTec student portal
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-[11px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                >
                  Shared Denominator
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                    {analytics.erp.percentage !== null ? `${analytics.erp.percentage}%` : "N/A"}
                  </span>
                  {analytics.erp.percentage !== null ? (
                    <span
                      className={`ml-2 text-xs font-semibold ${
                        analytics.erp.percentage >= targetPercentage
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {analytics.erp.percentage >= targetPercentage
                        ? `(+${(analytics.erp.percentage - targetPercentage).toFixed(1)}% above target)`
                        : `(-${(targetPercentage - analytics.erp.percentage).toFixed(1)}% below target)`}
                    </span>
                  ) : null}
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Shared Class Denominator</span>
                  <span className="text-lg font-bold font-mono text-foreground">
                    {analytics.erp.totalEligible}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <Progress
                  value={analytics.erp.percentage ?? 0}
                  className={`h-2.5 rounded-full ${
                    (analytics.erp.percentage ?? 0) >= targetPercentage
                      ? "[&>div]:bg-indigo-600"
                      : "[&>div]:bg-amber-500"
                  }`}
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>0%</span>
                  <span className="font-medium text-foreground">Target {targetPercentage}%</span>
                  <span>100%</span>
                </div>
              </div>

              <Separator />

              {/* Four count boxes showing Present, Absent, Not Entered, and Common Denominator */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-lg bg-emerald-500/10 p-2 border border-emerald-500/20">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                    ERP Present
                  </span>
                  <span className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                    {analytics.erp.presentCount}
                  </span>
                </div>
                <div className="rounded-lg bg-rose-500/10 p-2 border border-rose-500/20">
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">
                    ERP Absent
                  </span>
                  <span className="text-base font-bold text-rose-800 dark:text-rose-300">
                    {analytics.erp.absentCount}
                  </span>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-2 border border-amber-500/20">
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">
                    Not Entered
                  </span>
                  <span className="text-base font-bold text-amber-800 dark:text-amber-300">
                    {analytics.erp.notEnteredCount}
                  </span>
                </div>
                <div className="rounded-lg bg-muted/60 p-2 border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Total Classes
                  </span>
                  <span className="text-base font-bold text-foreground">
                    {analytics.erp.totalEligible}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 p-2.5 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <span>
                  <strong>Notice:</strong> Missing ERP entries ({analytics.erp.notEnteredCount}) remain in the common
                  denominator ({analytics.erp.totalEligible}). Record observed ERP statuses to increase this score.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* =========================================================================
          PART 7.2 — SEMESTER-TO-DATE OVERVIEW SECTION
      ========================================================================= */}
      <section aria-labelledby="semester-overview-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="semester-overview-heading" className="text-lg font-bold tracking-tight">
              Semester-to-Date Overview
            </h2>
            <p className="text-xs text-muted-foreground">
              Total classes held in active session up to {formatClock(new Date().toISOString())} IST.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {hasEligibleClasses ? `${analytics.overview.totalEligibleCompleted} Completed Classes` : "Session Starting"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
          {/* 1. Eligible Completed */}
          <Card className="p-3 bg-card shadow-xs">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Eligible Held</span>
            <span className="text-xl font-black text-foreground mt-1 block">
              {analytics.overview.totalEligibleCompleted}
            </span>
            <span className="text-[10px] text-muted-foreground">Active session</span>
          </Card>

          {/* 2. AttendWise Present */}
          <Card className="p-3 bg-emerald-500/5 border-emerald-500/20 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
              AW Present
            </span>
            <span className="text-xl font-black text-emerald-800 dark:text-emerald-300 mt-1 block">
              {analytics.overview.attendwisePresent}
            </span>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
              {analytics.overall.percentage !== null ? `${analytics.overall.percentage}%` : "—"}
            </span>
          </Card>

          {/* 3. AttendWise Absent */}
          <Card className="p-3 bg-rose-500/5 border-rose-500/20 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">
              AW Absent
            </span>
            <span className="text-xl font-black text-rose-800 dark:text-rose-300 mt-1 block">
              {analytics.overview.attendwiseAbsent}
            </span>
            <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80">In denominator</span>
          </Card>

          {/* 4. ERP Present */}
          <Card className="p-3 bg-indigo-500/5 border-indigo-500/20 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 block">
              ERP Present
            </span>
            <span className="text-xl font-black text-indigo-800 dark:text-indigo-300 mt-1 block">
              {analytics.overview.erpPresent}
            </span>
            <span className="text-[10px] text-indigo-700/80 dark:text-indigo-400/80">
              {analytics.erp.percentage !== null ? `${analytics.erp.percentage}%` : "—"}
            </span>
          </Card>

          {/* 5. ERP Absent */}
          <Card className="p-3 bg-rose-500/5 border-rose-500/20 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">
              ERP Absent
            </span>
            <span className="text-xl font-black text-rose-800 dark:text-rose-300 mt-1 block">
              {analytics.overview.erpAbsent}
            </span>
            <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80">Logged absent</span>
          </Card>

          {/* 6. ERP Not Entered */}
          <Card className="p-3 bg-amber-500/5 border-amber-500/20 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">
              Unentered ERP
            </span>
            <span className="text-xl font-black text-amber-800 dark:text-amber-300 mt-1 block">
              {analytics.overview.erpNotEntered}
            </span>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80">Needs update</span>
          </Card>

          {/* 7. Frozen (Excluded) */}
          <Card className="p-3 bg-sky-500/10 border-sky-500/30 shadow-xs">
            <div className="flex items-center gap-1">
              <Snowflake className="h-3 w-3 text-sky-600 dark:text-sky-400" />
              <span className="text-[10px] uppercase font-bold text-sky-800 dark:text-sky-300">
                Frozen
              </span>
            </div>
            <span className="text-xl font-black text-sky-900 dark:text-sky-200 mt-1 block">
              {analytics.overview.frozenCount}
            </span>
            <span className="text-[10px] text-sky-700 dark:text-sky-300">Excluded (0 denom)</span>
          </Card>

          {/* 8. Cancelled (Excluded) */}
          <Card className="p-3 bg-slate-500/10 border-slate-500/30 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 block">
              Cancelled
            </span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1 block">
              {analytics.overview.cancelledCount}
            </span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400">Excluded (0 denom)</span>
          </Card>
        </div>
      </section>

      {/* =========================================================================
          PART 7.3 — SUBJECT-WISE ANALYTICS SECTION
      ========================================================================= */}
      <section aria-labelledby="subject-analytics-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 id="subject-analytics-heading" className="text-lg font-bold tracking-tight">
              Subject-Wise Analytics
            </h2>
            <p className="text-xs text-muted-foreground">
              Granular attendance performance per academic course. Both metrics use the identical eligible class count for each subject.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="Theory">Theory Only</SelectItem>
                <SelectItem value="Practical">Practical Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {analytics.subjects.map((sub) => (
                  <SelectItem key={sub.subjectId} value={sub.subjectId}>
                    {sub.subjectCode} — {sub.subjectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Subjects Table / Cards */}
        {filteredSubjects.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center bg-card">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold">No subjects match the selected filter</p>
            <p className="text-xs text-muted-foreground mt-1">Try switching back to 'All Classes' or 'All Subjects'.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSubjects.map((sub) => {
              const awPct = sub.attendwise.percentage;
              const erpPct = sub.erp.percentage;
              const hasClasses = sub.totalEligible > 0;

              return (
                <Card key={sub.subjectId} className="flex flex-col justify-between border bg-card shadow-xs">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Badge variant="outline" className="text-[10px] font-mono mb-1">
                          {sub.subjectCode}
                        </Badge>
                        <CardTitle className="text-sm font-bold truncate" title={sub.subjectName}>
                          {sub.subjectName}
                        </CardTitle>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          sub.category === "Theory"
                            ? "bg-primary/10 text-primary border-primary/20 text-[10px]"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px]"
                        }
                      >
                        {sub.category}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 text-xs">
                    {/* Attendance Comparison Bar */}
                    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5 text-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> AttendWise
                        </span>
                        <span className={awPct !== null && awPct >= targetPercentage ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                          {awPct !== null ? `${awPct}%` : "N/A"}
                        </span>
                      </div>
                      <Progress
                        value={awPct ?? 0}
                        className={`h-2 ${awPct !== null && awPct >= targetPercentage ? "[&>div]:bg-emerald-600" : "[&>div]:bg-rose-500"}`}
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{sub.attendwise.presentCount} Present</span>
                        <span>{sub.attendwise.absentCount} Absent</span>
                        <span>{sub.totalEligible} Total Classes</span>
                      </div>
                    </div>

                    {/* ERP Comparison Bar */}
                    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5 text-foreground">
                          <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> College ERP
                        </span>
                        <span className={erpPct !== null && erpPct >= targetPercentage ? "text-indigo-600 font-bold" : "text-amber-600 font-bold"}>
                          {erpPct !== null ? `${erpPct}%` : "N/A"}
                        </span>
                      </div>
                      <Progress
                        value={erpPct ?? 0}
                        className={`h-2 ${erpPct !== null && erpPct >= targetPercentage ? "[&>div]:bg-indigo-600" : "[&>div]:bg-amber-500"}`}
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{sub.erp.presentCount} ERP Present</span>
                        <span>{sub.erp.absentCount} ERP Absent</span>
                        <span className="text-amber-600 font-medium">{sub.erp.notEnteredCount} Unentered</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                      <span>Shared Denominator: <strong>{sub.totalEligible}</strong></span>
                      <span className={hasClasses ? "text-foreground font-medium" : "text-muted-foreground"}>
                        {hasClasses ? `${sub.totalEligible} completed` : "No classes held yet"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          PART 7.4 — ERP COMPARISON SECTION
      ========================================================================= */}
      <section aria-labelledby="erp-comparison-heading" className="space-y-4">
        <div>
          <h2 id="erp-comparison-heading" className="text-lg font-bold tracking-tight">
            AttendWise vs College ERP Audit
          </h2>
          <p className="text-xs text-muted-foreground">
            Neutral cross-verification between personal AttendWise records and SISTec portal entries.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Summary Card */}
          <Card className="lg:col-span-1 border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" /> Audit Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="rounded-xl bg-muted/40 p-3.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">AttendWise Rate</span>
                  <span className="font-bold text-foreground">
                    {analytics.overall.percentage !== null ? `${analytics.overall.percentage}%` : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">College ERP Rate</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {analytics.erp.percentage !== null ? `${analytics.erp.percentage}%` : "N/A"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center font-bold">
                  <span>Delta Difference (Δ)</span>
                  <span
                    className={
                      analytics.comparison.percentagePointDifference !== null &&
                      analytics.comparison.percentagePointDifference > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-foreground"
                    }
                  >
                    {analytics.comparison.percentagePointDifference !== null
                      ? `${analytics.comparison.percentagePointDifference > 0 ? "+" : ""}${analytics.comparison.percentagePointDifference}% pts`
                      : "0.0% pts"}
                  </span>
                </div>
              </div>

              <dl className="space-y-2.5">
                <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <dt className="text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Records Match
                  </dt>
                  <dd className="font-bold font-mono text-emerald-900 dark:text-emerald-200">
                    {analytics.comparison.matchingCount}
                  </dd>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <dt className="text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Potential Discrepancy
                  </dt>
                  <dd className="font-bold font-mono text-amber-900 dark:text-amber-200">
                    {analytics.comparison.discrepancyCount}
                  </dd>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-muted/60 border">
                  <dt className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> ERP Not Entered
                  </dt>
                  <dd className="font-bold font-mono text-foreground">
                    {analytics.comparison.erpNotEnteredCount}
                  </dd>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
                  <dt className="text-sky-800 dark:text-sky-300 font-medium flex items-center gap-1.5">
                    <Snowflake className="h-3.5 w-3.5 text-sky-600" /> Frozen (Excluded)
                  </dt>
                  <dd className="font-bold font-mono text-sky-900 dark:text-sky-200">
                    {analytics.comparison.frozenCount}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Interactive Inspection List */}
          <Card className="lg:col-span-2 border bg-card shadow-xs flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Discrepancy & Unentered Audit Queue
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {discrepancySessions.length + unenteredErpSessions.length} Actionable Items
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Review sessions where ERP status has not been recorded or differs from personal check-in.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2 text-xs flex-1">
              {discrepancySessions.length === 0 && unenteredErpSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center bg-muted/20">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                  <p className="font-semibold text-foreground">All eligible classes in sync!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Every completed class has its ERP status recorded and matching your AttendWise check-ins.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {/* Discrepancies first */}
                  {discrepancySessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{session.subjectName}</span>
                          <Badge variant="outline" className="text-[9px] font-mono">
                            {session.subjectCode}
                          </Badge>
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[9px]">
                            Discrepancy
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatDate(session.scheduledDate)} · {formatClock(session.scheduledStartAt)} – {formatClock(session.scheduledEndAt)}
                        </p>
                        <p className="text-[11px] mt-1 text-foreground">
                          AttendWise: <strong className="capitalize">{session.personalStatus}</strong> · College ERP:{" "}
                          <strong className="text-rose-600">{session.erpStatus ?? "Not Entered"}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px] h-7"
                          onClick={() => setSelectedSessionForAction(session as ClassSessionItem)}
                        >
                          Inspect
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Unentered ERP sessions */}
                  {unenteredErpSessions.slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="rounded-lg border bg-muted/20 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{session.subjectName}</span>
                          <Badge variant="outline" className="text-[9px] font-mono">
                            {session.subjectCode}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                            ERP Unrecorded
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatDate(session.scheduledDate)} · {formatClock(session.scheduledStartAt)} – {formatClock(session.scheduledEndAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {session.erpStatus === null ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[10px] h-7 px-2 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              disabled={actionBusy}
                              onClick={() => handleRecordErpDirect(session.id, "Present")}
                            >
                              <Check className="h-3 w-3 mr-1" /> ERP Present
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[10px] h-7 px-2 border-rose-500/40 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              disabled={actionBusy}
                              onClick={() => handleRecordErpDirect(session.id, "Absent")}
                            >
                              <X className="h-3 w-3 mr-1" /> ERP Absent
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* =========================================================================
          PART 7.5 — ATTENDANCE TREND (WEEKLY PROGRESSION)
      ========================================================================= */}
      <section aria-labelledby="trend-heading" className="space-y-4">
        <div>
          <h2 id="trend-heading" className="text-lg font-bold tracking-tight">
            Weekly Attendance Trend
          </h2>
          <p className="text-xs text-muted-foreground">
            Week-by-week finalized attendance progress across the current academic semester.
          </p>
        </div>

        {analytics.weeklyTrend.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center bg-card">
            <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold">Weekly attendance trend will appear as classes are completed</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              As your semester progresses and classes conclude, week-by-week comparative graphs comparing AttendWise and ERP will automatically generate here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.weeklyTrend.map((week) => (
              <Card key={week.weekLabel} className="p-4 border bg-card shadow-xs space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>{week.weekLabel}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {formatDate(week.startDate)} – {formatDate(week.endDate)}
                  </Badge>
                </div>

                <div className="space-y-2 bg-muted/40 p-2.5 rounded-lg">
                  <div className="flex justify-between items-center font-medium">
                    <span className="text-foreground">AttendWise Rate</span>
                    <span className="font-bold text-primary">
                      {week.attendwisePercentage !== null ? `${week.attendwisePercentage}%` : "N/A"}
                    </span>
                  </div>
                  <Progress
                    value={week.attendwisePercentage ?? 0}
                    className="h-1.5 [&>div]:bg-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{week.attendwisePresent} Present</span>
                    <span>{week.totalEligible} Total Classes</span>
                  </div>
                </div>

                <div className="space-y-2 bg-muted/40 p-2.5 rounded-lg">
                  <div className="flex justify-between items-center font-medium">
                    <span className="text-foreground">College ERP Rate</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {week.erpPercentage !== null ? `${week.erpPercentage}%` : "N/A"}
                    </span>
                  </div>
                  <Progress
                    value={week.erpPercentage ?? 0}
                    className="h-1.5 [&>div]:bg-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{week.erpPresent} ERP Present</span>
                    <span className="text-amber-600">{week.erpNotEntered} Unentered</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================================
          FROZEN CLASSES REVIEW SECTION
      ========================================================================= */}
      {frozenSessions.length > 0 ? (
        <section aria-labelledby="frozen-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h2 id="frozen-heading" className="text-base font-bold tracking-tight">
                Frozen Classes ({frozenSessions.length})
              </h2>
            </div>
            <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300 text-xs">
              Permanently Excluded from Denominators
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            These class sessions were frozen by you and are excluded from all AttendWise and ERP percentage calculations and totals. Original attendance records remain preserved.
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {frozenSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold block text-foreground truncate">{session.subjectName}</span>
                  <span className="text-[11px] text-muted-foreground block">
                    {formatDate(session.scheduledDate)} · {formatClock(session.scheduledStartAt)} – {formatClock(session.scheduledEndAt)}
                  </span>
                  <span className="text-[10px] text-sky-700 dark:text-sky-300 mt-0.5 block">
                    Frozen at: {formatClock(session.frozenAt || session.finalizedAt)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 text-sky-700 border-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/40"
                  disabled={actionBusy}
                  onClick={() => handleFreezeToggle(session)}
                >
                  Unfreeze
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* =========================================================================
          CALCULATION RULES MODAL
      ========================================================================= */}
      <Dialog open={showFormulaModal} onOpenChange={setShowFormulaModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Authoritative Attendance Calculation Rules
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adhering strictly to SISTec academic regulations and AttendWise data integrity rules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-3.5 space-y-1.5">
              <h4 className="font-bold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Common Shared Denominator Rule
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                Both AttendWise and College ERP attendance percentages use the <strong>exact same denominator</strong>:
                the total number of eligible completed unfrozen classes.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Eligibility Criteria for Classes:</h4>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Class is scheduled on an official teaching day (holidays & Sundays excluded).</li>
                <li>Scheduled end time has passed according to trusted server time (IST).</li>
                <li>Class is finalized as either Present or Absent.</li>
                <li>Future classes, in-progress classes, cancelled classes, and frozen classes are strictly excluded.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">ERP Missing Entries Rule:</h4>
              <p className="text-muted-foreground leading-relaxed">
                If an ERP status is not entered (null), it contributes 0 to the numerator and remains in the shared denominator.
                ERP attendance is never calculated by dividing only by the statuses entered.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Freezing a Class:</h4>
              <p className="text-muted-foreground leading-relaxed">
                When a class is frozen, it is immediately removed from the shared denominator and all numerators across AttendWise and ERP.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setShowFormulaModal(false)} className="text-xs">
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          SESSION ACTION INSPECTION MODAL
      ========================================================================= */}
      <Dialog
        open={Boolean(selectedSessionForAction)}
        onOpenChange={(open) => {
          if (!open) setSelectedSessionForAction(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Class Session Details & Actions
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedSessionForAction?.subjectCode} — {selectedSessionForAction?.subjectName}
            </DialogDescription>
          </DialogHeader>

          {selectedSessionForAction ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Date</span>
                  <span className="font-medium">{formatDate(selectedSessionForAction.scheduledDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Interval</span>
                  <span className="font-medium">
                    {formatClock(selectedSessionForAction.scheduledStartAt)} – {formatClock(selectedSessionForAction.scheduledEndAt)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">AttendWise Status</span>
                  <span className="font-bold capitalize">{selectedSessionForAction.personalStatus}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">College ERP Status</span>
                  <span className="font-bold">{selectedSessionForAction.erpStatus ?? "Not Entered"}</span>
                </div>
              </div>

              {/* Record ERP actions */}
              <div className="space-y-2">
                <span className="font-semibold text-foreground block">Update Observed College ERP Status</span>
                {selectedSessionForAction.erpStatus ? (
                  <p className="text-muted-foreground text-[11px]">
                    ERP status is locked as <strong>{selectedSessionForAction.erpStatus}</strong>.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs"
                      disabled={actionBusy}
                      onClick={async () => {
                        await handleRecordErpDirect(selectedSessionForAction.id, "Present");
                        setSelectedSessionForAction(null);
                      }}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Mark Present on ERP
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-500/40 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                      disabled={actionBusy}
                      onClick={async () => {
                        await handleRecordErpDirect(selectedSessionForAction.id, "Absent");
                        setSelectedSessionForAction(null);
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Mark Absent on ERP
                    </Button>
                  </div>
                )}
              </div>

              {/* Freeze action */}
              <div className="pt-2 border-t space-y-2">
                <span className="font-semibold text-foreground block">Class Freezing</span>
                <p className="text-[11px] text-muted-foreground">
                  Freezing completely removes this class from all attendance denominators and calculations.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className={
                    selectedSessionForAction.personalStatus === "frozen"
                      ? "text-sky-700 border-sky-300 w-full text-xs"
                      : "text-rose-700 border-rose-300 hover:bg-rose-50 w-full text-xs"
                  }
                  disabled={actionBusy}
                  onClick={async () => {
                    await handleFreezeToggle(selectedSessionForAction);
                    setSelectedSessionForAction(null);
                  }}
                >
                  <Snowflake className="h-3.5 w-3.5 mr-1.5" />
                  {selectedSessionForAction.personalStatus === "frozen"
                    ? "Unfreeze Class (Restore to Calculations)"
                    : "Freeze Class (Exclude from Calculations)"}
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setSelectedSessionForAction(null)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
