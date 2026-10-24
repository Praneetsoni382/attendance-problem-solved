import { isTeachingDay } from "../data/sistec-calendar";

export interface SessionLike {
  id: string;
  studentId?: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledStartAt: string; // ISO string
  scheduledEndAt: string; // ISO string
  category: "Theory" | "Practical" | string;
  personalStatus: "upcoming" | "present" | "absent" | "frozen" | "cancelled" | string;
  erpStatus?: "Present" | "Absent" | null;
  finalized: boolean;
  finalizedAt?: string | null;
  frozenAt?: string | null;
  cancelledAt?: string | null;
  slot?: string;
  room?: string | null;
  note?: string | null;
  previousPersonalStatus?: string | null;
  previousErpStatus?: string | null;
}

export interface MetricResult {
  percentage: number | null; // null represents "N/A"
  presentCount: number;
  absentCount: number;
  totalEligible: number;
}

export interface ErpMetricResult {
  percentage: number | null; // null represents "N/A"
  presentCount: number;
  absentCount: number;
  notEnteredCount: number;
  totalEligible: number; // MUST match AttendWise totalEligible
}

export interface SubjectAnalyticsItem {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  category: string;
  totalEligible: number;
  attendwise: MetricResult;
  erp: ErpMetricResult;
}

export interface ComparisonOverview {
  attendwisePercentage: number | null;
  erpPercentage: number | null;
  percentagePointDifference: number | null; // AttendWise % - ERP %
  matchingCount: number;
  discrepancyCount: number;
  erpNotEnteredCount: number;
  frozenCount: number;
  cancelledCount: number;
}

export interface WeeklyTrendItem {
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalEligible: number;
  attendwisePresent: number;
  attendwisePercentage: number | null;
  erpPresent: number;
  erpPercentage: number | null;
  erpNotEntered: number;
}

export interface FullAnalyticsSummary {
  // Primary top cards (using identical totalEligible shared denominator)
  overall: MetricResult;
  erp: ErpMetricResult;

  // Breakdown by category
  theory: {
    attendwise: MetricResult;
    erp: ErpMetricResult;
  };
  practical: {
    attendwise: MetricResult;
    erp: ErpMetricResult;
  };

  // Semester overview counts
  overview: {
    totalEligibleCompleted: number;
    attendwisePresent: number;
    attendwiseAbsent: number;
    erpPresent: number;
    erpAbsent: number;
    erpNotEntered: number;
    frozenCount: number;
    cancelledCount: number;
    upcomingCount: number;
  };

  // Subject-wise metrics
  subjects: SubjectAnalyticsItem[];

  // ERP Comparison details
  comparison: ComparisonOverview;

  // Trend data
  weeklyTrend: WeeklyTrendItem[];

  // Eligible sessions list for granular inspection
  eligibleSessions: SessionLike[];

  // Reference timestamp
  calculatedAtMs: number;
}

/**
 * Checks whether a class session is eligible for attendance calculations.
 *
 * A class is ELIGIBLE for the attendance denominator when:
 * 1. For Python Training (fixed historical program completed 7-19 Sept 2026):
 *    All 66 confirmed historical sessions are eligible unless frozen or cancelled.
 * 2. For regular college subjects:
 *    a) It is scheduled on an official teaching day (not a holiday/Sunday).
 *    b) It is not frozen (personalStatus !== "frozen").
 *    c) It is not cancelled (personalStatus !== "cancelled").
 *    d) AND EITHER:
 *       - Attendance has already been recorded as Present (personalStatus === "present").
 *       - Attendance was marked Absent and finalized after scheduled end time has elapsed (nowMs >= scheduledEndAt).
 *
 * Future or in-progress classes that have not yet been marked present are excluded.
 */
export function isSessionEligible(session: SessionLike, nowMs: number = Date.now()): boolean {
  if (!session) return false;

  // 0. Completely purge/reject any P7 test class sessions
  if (
    session.slot === "P7" ||
    session.subjectId === "sub-test-class-p7" ||
    session.subjectCode === "TEST-P7" ||
    session.id.includes("test-class-p7") ||
    session.id.includes("P7")
  ) {
    return false;
  }

  // 1. Python Training historical sessions are permanently capped at 66 completed sessions
  if (session.subjectId === "sub-python-training" || (session as any).isSpecialTraining) {
    if (
      session.personalStatus === "frozen" ||
      Boolean((session as any).frozenAt) ||
      Boolean((session as any).isFrozen) ||
      session.personalStatus === "cancelled" ||
      Boolean((session as any).cancelledAt)
    ) {
      return false;
    }
    return true;
  }

  // 2. Must be on an official teaching day
  if (!isTeachingDay(session.scheduledDate)) {
    return false;
  }

  // 3. Frozen classes are strictly excluded from calculations & denominators in real time
  if (
    session.personalStatus === "frozen" ||
    Boolean((session as any).frozenAt) ||
    Boolean((session as any).isFrozen)
  ) {
    return false;
  }

  // 4. Cancelled classes are strictly excluded
  if (
    session.personalStatus === "cancelled" ||
    Boolean((session as any).cancelledAt)
  ) {
    return false;
  }

  // 5. Check scheduled interval boundary
  const endMs = new Date(session.scheduledEndAt).getTime();
  if (!isNaN(endMs) && nowMs < endMs) {
    // Before scheduledEndAt, only an authoritative Present check-in is eligible
    return session.personalStatus === "present";
  }

  // 6. After scheduledEndAt has elapsed:
  if (session.personalStatus === "present") {
    return true;
  }

  if (session.personalStatus === "absent" && session.finalized) {
    return true;
  }

  // Future or unresolved classes without final status are excluded
  return false;
}

/**
 * Calculates AttendWise metric for a list of eligible sessions.
 * Formula: AttendWise Present ÷ Total eligible completed unfrozen classes × 100
 * Denominator is zero -> returns null (displayed as N/A).
 * Unmarked sessions contribute to totalEligible denominator, but 0 to presentCount and 0 to absentCount.
 */
export function calculateAttendwiseMetric(eligibleList: SessionLike[]): MetricResult {
  const presentCount = eligibleList.filter((s) => s.personalStatus === "present").length;
  const absentCount = eligibleList.filter((s) => s.personalStatus === "absent").length;
  const totalEligible = eligibleList.length;

  const percentage =
    totalEligible === 0
      ? null
      : Math.round((presentCount / totalEligible) * 1000) / 10;

  return {
    percentage,
    presentCount,
    absentCount,
    totalEligible,
  };
}

/**
 * Calculates ERP metric for a list of eligible sessions.
 *
 * MANDATORY BUSINESS RULE (Part 5):
 * ERP attendance MUST use the EXACT SAME denominator as AttendWise (total eligible completed unfrozen classes).
 * It must NOT divide by only entered statuses.
 * Missing ERP entries (null) contribute 0 to the numerator and 1 to the denominator.
 *
 * Formula: ERP Present ÷ Total eligible completed unfrozen classes × 100
 */
export function calculateErpMetric(eligibleList: SessionLike[]): ErpMetricResult {
  const totalEligible = eligibleList.length;
  const presentCount = eligibleList.filter((s) => s.erpStatus === "Present").length;
  const absentCount = eligibleList.filter((s) => s.erpStatus === "Absent").length;
  const notEnteredCount = eligibleList.filter(
    (s) => s.erpStatus === null || s.erpStatus === undefined
  ).length;

  const percentage =
    totalEligible === 0
      ? null
      : Math.round((presentCount / totalEligible) * 1000) / 10;

  return {
    percentage,
    presentCount,
    absentCount,
    notEnteredCount,
    totalEligible,
  };
}

/**
 * Builds weekly trend data from eligible sessions.
 */
function buildWeeklyTrend(eligibleList: SessionLike[]): WeeklyTrendItem[] {
  if (eligibleList.length === 0) return [];

  // Group by ISO week (Monday - Saturday)
  const groups = new Map<string, SessionLike[]>();

  for (const s of eligibleList) {
    const d = new Date(s.scheduledDate + "T12:00:00+05:30");
    if (isNaN(d.getTime())) continue;

    // Get Monday of this week in IST
    const day = d.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const mondayKey = monday.toISOString().slice(0, 10);

    const list = groups.get(mondayKey) ?? [];
    list.push(s);
    groups.set(mondayKey, list);
  }

  const sortedMondays = Array.from(groups.keys()).sort();

  return sortedMondays.map((mondayKey, idx) => {
    const list = groups.get(mondayKey)!;
    const total = list.length;
    const awPresent = list.filter((s) => s.personalStatus === "present").length;
    const erpPresent = list.filter((s) => s.erpStatus === "Present").length;
    const erpNotEntered = list.filter(
      (s) => s.erpStatus === null || s.erpStatus === undefined
    ).length;

    const awPct = total === 0 ? null : Math.round((awPresent / total) * 1000) / 10;
    const erpPct = total === 0 ? null : Math.round((erpPresent / total) * 1000) / 10;

    // End date of the week (Saturday, 5 days after Monday)
    const sat = new Date(mondayKey + "T12:00:00+05:30");
    sat.setDate(sat.getDate() + 5);
    const satKey = sat.toISOString().slice(0, 10);

    return {
      weekLabel: `Week ${idx + 1}`,
      startDate: mondayKey,
      endDate: satKey,
      totalEligible: total,
      attendwisePresent: awPresent,
      attendwisePercentage: awPct,
      erpPresent,
      erpPercentage: erpPct,
      erpNotEntered,
    };
  });
}

/**
 * Main calculation service: Computes all analytics from trusted server records.
 * Uses identical eligible class set across all overall, subject-wise, and comparison metrics.
 */
export function computeFullAnalytics(
  allSessions: SessionLike[],
  nowMs: number = Date.now()
): FullAnalyticsSummary {
  // 0. Completely purge P7 test classes and unformatted items across the entire analytics engine
  const cleanSessions = (allSessions || []).filter((s) => {
    if (!s) return false;
    if (
      s.slot === "P7" ||
      s.subjectId === "sub-test-class-p7" ||
      s.subjectCode === "TEST-P7" ||
      s.id.includes("test-class-p7") ||
      s.id.includes("P7")
    ) {
      return false;
    }
    return true;
  });

  // 1. Filter authoritative eligible sessions
  const eligible = cleanSessions.filter((s) => isSessionEligible(s, nowMs));

  // 2. Compute primary overall attendance metrics
  const overallAw = calculateAttendwiseMetric(eligible);
  const overallErp = calculateErpMetric(eligible);

  // 3. Theory vs Practical breakdowns
  const theoryEligible = eligible.filter((s) => s.category === "Theory");
  const practicalEligible = eligible.filter((s) => s.category === "Practical");

  const theory = {
    attendwise: calculateAttendwiseMetric(theoryEligible),
    erp: calculateErpMetric(theoryEligible),
  };

  const practical = {
    attendwise: calculateAttendwiseMetric(practicalEligible),
    erp: calculateErpMetric(practicalEligible),
  };

  // 4. Excluded and upcoming informational counts
  const frozenCount = allSessions.filter((s) => s.personalStatus === "frozen").length;
  const cancelledCount = allSessions.filter((s) => s.personalStatus === "cancelled").length;
  const upcomingCount = allSessions.filter(
    (s) =>
      !s.finalized &&
      s.personalStatus === "upcoming" &&
      new Date(s.scheduledStartAt).getTime() > nowMs
  ).length;

  // 5. Subject-wise metrics (using the SAME eligible denominator for each subject)
  const subjectMap = new Map<string, { name: string; code: string; category: string; list: SessionLike[] }>();

  // Ensure all subjects seen in sessions or eligible list are represented
  for (const s of allSessions) {
    if (!subjectMap.has(s.subjectId)) {
      subjectMap.set(s.subjectId, {
        name: s.subjectName,
        code: s.subjectCode,
        category: s.category,
        list: [],
      });
    }
  }

  // Populate only with eligible sessions
  for (const s of eligible) {
    const entry = subjectMap.get(s.subjectId);
    if (entry) {
      entry.list.push(s);
    }
  }

  const subjects: SubjectAnalyticsItem[] = Array.from(subjectMap.entries())
    .map(([subjectId, meta]) => ({
      subjectId,
      subjectName: meta.name,
      subjectCode: meta.code,
      category: meta.category,
      totalEligible: meta.list.length,
      attendwise: calculateAttendwiseMetric(meta.list),
      erp: calculateErpMetric(meta.list),
    }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  // 6. ERP Comparison
  let matchingCount = 0;
  let discrepancyCount = 0;

  for (const s of eligible) {
    if ((s.erpStatus === "Present" || s.erpStatus === "Absent") && (s.personalStatus === "present" || s.personalStatus === "absent")) {
      const personalAsErp = s.personalStatus === "present" ? "Present" : "Absent";
      if (s.erpStatus === personalAsErp) {
        matchingCount++;
      } else {
        discrepancyCount++;
      }
    }
  }

  const percentagePointDifference =
    overallAw.percentage !== null && overallErp.percentage !== null
      ? Math.round((overallAw.percentage - overallErp.percentage) * 10) / 10
      : null;

  const comparison: ComparisonOverview = {
    attendwisePercentage: overallAw.percentage,
    erpPercentage: overallErp.percentage,
    percentagePointDifference,
    matchingCount,
    discrepancyCount,
    erpNotEnteredCount: overallErp.notEnteredCount,
    frozenCount,
    cancelledCount,
  };

  // 7. Weekly trend
  const weeklyTrend = buildWeeklyTrend(eligible);

  return {
    overall: overallAw,
    erp: overallErp,
    theory,
    practical,
    overview: {
      totalEligibleCompleted: eligible.length,
      attendwisePresent: overallAw.presentCount,
      attendwiseAbsent: overallAw.absentCount,
      erpPresent: overallErp.presentCount,
      erpAbsent: overallErp.absentCount,
      erpNotEntered: overallErp.notEnteredCount,
      frozenCount,
      cancelledCount,
      upcomingCount,
    },
    subjects,
    comparison,
    weeklyTrend,
    eligibleSessions: eligible,
    calculatedAtMs: nowMs,
  };
}
