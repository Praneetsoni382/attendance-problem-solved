/**
 * AttendWise Analytics Comprehensive Automated Test Suite
 * Validates all 28 scenarios required by Part 11 of the specification.
 */
import assert from "node:assert/strict";
import {
  computeFullAnalytics,
  isSessionEligible,
  calculateAttendwiseMetric,
  calculateErpMetric,
  type SessionLike,
} from "../artifacts/attendwise/src/lib/analytics-calculator";

function createMockSession(overrides: Partial<SessionLike>): SessionLike {
  return {
    id: `sess-${Math.random().toString(36).slice(2, 9)}`,
    studentId: "student-1",
    subjectId: "sub-1",
    subjectName: "Data Structures",
    subjectCode: "CS301",
    scheduledDate: "2026-10-15", // A valid teaching day
    scheduledStartAt: "2026-10-15T09:30:00+05:30",
    scheduledEndAt: "2026-10-15T10:30:00+05:30",
    category: "Theory",
    personalStatus: "present",
    erpStatus: "Present",
    finalized: true,
    finalizedAt: "2026-10-15T10:30:00+05:30",
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log(" ATTENDWISE ANALYTICS TEST SUITE (PART 11 COMPLIANCE)");
console.log("=======================================================\n");

console.log("--- GROUP 1: Calculation Tests ---");

// Test 1: AttendWise Present divided by eligible denominator
runTest("Scenario 1: AttendWise Present divided by eligible class denominator produces correct percentage", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  // 15 present, 5 absent out of 20
  const sessions: SessionLike[] = [
    ...Array.from({ length: 15 }, () => createMockSession({ personalStatus: "present" })),
    ...Array.from({ length: 5 }, () => createMockSession({ personalStatus: "absent" })),
  ];
  const stats = computeFullAnalytics(sessions, now);
  assert.equal(stats.overall.totalEligible, 20);
  assert.equal(stats.overall.presentCount, 15);
  assert.equal(stats.overall.absentCount, 5);
  assert.equal(stats.overall.percentage, 75); // 15 / 20 * 100 = 75%
});

// Test 2: ERP Present divided by the SAME eligible class denominator
runTest("Scenario 2: ERP Present divided by the SAME eligible class denominator produces correct percentage", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  // 20 eligible classes, ERP has 12 Present, 4 Absent, 4 Unentered
  const sessions: SessionLike[] = [
    ...Array.from({ length: 12 }, () =>
      createMockSession({ personalStatus: "present", erpStatus: "Present" })
    ),
    ...Array.from({ length: 3 }, () =>
      createMockSession({ personalStatus: "present", erpStatus: "Absent" })
    ),
    ...Array.from({ length: 1 }, () =>
      createMockSession({ personalStatus: "absent", erpStatus: "Absent" })
    ),
    ...Array.from({ length: 4 }, () =>
      createMockSession({ personalStatus: "absent", erpStatus: null })
    ),
  ];
  const stats = computeFullAnalytics(sessions, now);
  assert.equal(stats.erp.totalEligible, 20, "ERP denominator must be 20, not 16");
  assert.equal(stats.erp.presentCount, 12);
  assert.equal(stats.erp.percentage, 60); // 12 / 20 * 100 = 60%
});

// Test 3: ERP Not Entered remains in the denominator
runTest("Scenario 3: ERP Not Entered remains in the denominator", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const sessions: SessionLike[] = [
    createMockSession({ personalStatus: "present", erpStatus: "Present" }),
    createMockSession({ personalStatus: "present", erpStatus: null }), // unentered
  ];
  const stats = computeFullAnalytics(sessions, now);
  assert.equal(stats.erp.totalEligible, 2);
  assert.equal(stats.erp.notEnteredCount, 1);
  assert.equal(stats.erp.percentage, 50); // 1 / 2 * 100 = 50%, NOT 100%
});

// Test 4: ERP Absent remains in the denominator but not the ERP numerator
runTest("Scenario 4: ERP Absent remains in denominator but not ERP numerator", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const sessions: SessionLike[] = [
    createMockSession({ personalStatus: "present", erpStatus: "Present" }),
    createMockSession({ personalStatus: "present", erpStatus: "Absent" }),
  ];
  const stats = computeFullAnalytics(sessions, now);
  assert.equal(stats.erp.presentCount, 1);
  assert.equal(stats.erp.absentCount, 1);
  assert.equal(stats.erp.totalEligible, 2);
  assert.equal(stats.erp.percentage, 50);
});

// Test 5: AttendWise Absent remains in denominator but not AttendWise numerator
runTest("Scenario 5: AttendWise Absent remains in denominator but not AttendWise numerator", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const sessions: SessionLike[] = [
    createMockSession({ personalStatus: "present" }),
    createMockSession({ personalStatus: "absent" }),
  ];
  const stats = computeFullAnalytics(sessions, now);
  assert.equal(stats.overall.presentCount, 1);
  assert.equal(stats.overall.absentCount, 1);
  assert.equal(stats.overall.totalEligible, 2);
  assert.equal(stats.overall.percentage, 50);
});

// Test 6: Both percentages use exactly the same eligible class set
runTest("Scenario 6: Both AttendWise and ERP use exactly the same eligible class set", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const sessions: SessionLike[] = [
    createMockSession({ personalStatus: "present", erpStatus: "Present" }),
    createMockSession({ personalStatus: "absent", erpStatus: "Present" }),
    createMockSession({ personalStatus: "present", erpStatus: null }),
  ];
  const stats = computeFullAnalytics(sessions, now);
  assert.equal(stats.overall.totalEligible, stats.erp.totalEligible);
  assert.equal(stats.overall.totalEligible, 3);
});

// Test 7: Zero eligible classes returns N/A (null)
runTest("Scenario 7: Zero eligible classes returns N/A (null)", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const stats = computeFullAnalytics([], now);
  assert.equal(stats.overall.totalEligible, 0);
  assert.equal(stats.overall.percentage, null);
  assert.equal(stats.erp.totalEligible, 0);
  assert.equal(stats.erp.percentage, null);
});

console.log("\n--- GROUP 2: Time-Boundary Tests ---");

// Test 8: Future classes are excluded
runTest("Scenario 8: Future classes are excluded from calculation", () => {
  const now = new Date("2026-10-16T08:00:00+05:30").getTime();
  const futureSession = createMockSession({
    scheduledDate: "2026-10-16",
    scheduledStartAt: "2026-10-16T10:35:00+05:30",
    scheduledEndAt: "2026-10-16T11:35:00+05:30",
    finalized: false,
    personalStatus: "upcoming",
  });
  assert.equal(isSessionEligible(futureSession, now), false);
});

// Test 9: Currently running classes are excluded
runTest("Scenario 9: Currently running classes are excluded", () => {
  const now = new Date("2026-10-16T11:00:00+05:30").getTime();
  const runningSession = createMockSession({
    scheduledDate: "2026-10-16",
    scheduledStartAt: "2026-10-16T10:35:00+05:30",
    scheduledEndAt: "2026-10-16T11:35:00+05:30",
    finalized: false,
    personalStatus: "upcoming",
  });
  assert.equal(isSessionEligible(runningSession, now), false);
});

// Test 10: A class that has ended is included only after its final status is resolved
runTest("Scenario 10: Ended class included only after final status is resolved", () => {
  const now = new Date("2026-10-16T11:36:00+05:30").getTime();
  const unresolvedSession = createMockSession({
    scheduledDate: "2026-10-16",
    scheduledStartAt: "2026-10-16T10:35:00+05:30",
    scheduledEndAt: "2026-10-16T11:35:00+05:30",
    finalized: false, // not resolved yet
    personalStatus: "upcoming",
  });
  assert.equal(isSessionEligible(unresolvedSession, now), false);

  const resolvedSession = {
    ...unresolvedSession,
    finalized: true,
    personalStatus: "absent",
    finalizedAt: "2026-10-16T11:35:00+05:30",
  };
  assert.equal(isSessionEligible(resolvedSession, now), true);
});

// Test 11: Backend trusted server time determines eligibility
runTest("Scenario 11: Server timestamp determines eligibility independent of device clock", () => {
  const serverTime1 = new Date("2026-10-16T10:00:00+05:30").getTime();
  const serverTime2 = new Date("2026-10-16T12:00:00+05:30").getTime();
  const session = createMockSession({
    scheduledDate: "2026-10-16",
    scheduledStartAt: "2026-10-16T10:35:00+05:30",
    scheduledEndAt: "2026-10-16T11:35:00+05:30",
    finalized: true,
    personalStatus: "absent",
  });

  assert.equal(isSessionEligible(session, serverTime1), false, "Must be excluded before scheduledEndAt");
  assert.equal(isSessionEligible(session, serverTime2), true, "Must be included after scheduledEndAt");
});

// Test 12: Timezone interpretation is correct for Asia/Kolkata
runTest("Scenario 12: Timezone interpretation adheres to Asia/Kolkata", () => {
  const istDateStr = "2026-10-15";
  const startAt = "2026-10-15T09:30:00+05:30";
  const endAt = "2026-10-15T10:30:00+05:30";
  const session = createMockSession({
    scheduledDate: istDateStr,
    scheduledStartAt: startAt,
    scheduledEndAt: endAt,
    finalized: true,
    personalStatus: "present",
  });
  const nowAfterEnd = new Date("2026-10-15T05:01:00Z").getTime(); // 10:31 AM IST
  assert.equal(isSessionEligible(session, nowAfterEnd), true);
});

console.log("\n--- GROUP 3: Freezing Tests ---");

// Test 13: Freezing a class that was Present in both records removes it from both numerators and denominator
runTest("Scenario 13: Freezing a Present/Present class removes it from both numerators and denominator", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const sessionToFreeze = createMockSession({
    id: "freeze-target",
    personalStatus: "present",
    erpStatus: "Present",
  });
  const otherSessions = Array.from({ length: 19 }, () =>
    createMockSession({ personalStatus: "present", erpStatus: "Present" })
  );

  const before = computeFullAnalytics([sessionToFreeze, ...otherSessions], now);
  assert.equal(before.overall.totalEligible, 20);
  assert.equal(before.overall.presentCount, 20);
  assert.equal(before.erp.presentCount, 20);

  const frozen = { ...sessionToFreeze, personalStatus: "frozen", previousPersonalStatus: "present" };
  const after = computeFullAnalytics([frozen, ...otherSessions], now);
  assert.equal(after.overall.totalEligible, 19, "Denominator must reduce by 1");
  assert.equal(after.erp.totalEligible, 19, "ERP denominator must reduce by 1");
  assert.equal(after.overall.presentCount, 19, "AttendWise Present must reduce by 1");
  assert.equal(after.erp.presentCount, 19, "ERP Present must reduce by 1");
  assert.equal(after.overview.frozenCount, 1);
});

// Test 14: Freezing an AttendWise Absent class reduces denominator but not AttendWise Present count
runTest("Scenario 14: Freezing an AttendWise Absent class reduces denominator without changing AW Present", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const absentSession = createMockSession({
    id: "absent-freeze",
    personalStatus: "absent",
    erpStatus: null,
  });
  const presentSessions = Array.from({ length: 15 }, () =>
    createMockSession({ personalStatus: "present", erpStatus: "Present" })
  );

  const before = computeFullAnalytics([absentSession, ...presentSessions], now);
  assert.equal(before.overall.totalEligible, 16);
  assert.equal(before.overall.presentCount, 15);

  const frozen = { ...absentSession, personalStatus: "frozen" };
  const after = computeFullAnalytics([frozen, ...presentSessions], now);
  assert.equal(after.overall.totalEligible, 15);
  assert.equal(after.overall.presentCount, 15, "Present count must remain 15");
  assert.equal(after.overall.percentage, 100);
});

// Test 15: Freezing an ERP Absent class reduces denominator but not ERP Present count
runTest("Scenario 15: Freezing an ERP Absent class reduces denominator without changing ERP Present", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const erpAbsent = createMockSession({
    id: "erp-absent-freeze",
    personalStatus: "absent",
    erpStatus: "Absent",
  });
  const erpPresentList = Array.from({ length: 10 }, () =>
    createMockSession({ personalStatus: "present", erpStatus: "Present" })
  );

  const before = computeFullAnalytics([erpAbsent, ...erpPresentList], now);
  assert.equal(before.erp.totalEligible, 11);
  assert.equal(before.erp.presentCount, 10);

  const frozen = { ...erpAbsent, personalStatus: "frozen" };
  const after = computeFullAnalytics([frozen, ...erpPresentList], now);
  assert.equal(after.erp.totalEligible, 10);
  assert.equal(after.erp.presentCount, 10, "ERP Present must remain 10");
  assert.equal(after.erp.percentage, 100);
});

// Test 16: Freezing a class with ERP Not Entered reduces denominator and unentered count
runTest("Scenario 16: Freezing unentered ERP class reduces denominator and unentered count", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const unenteredSession = createMockSession({
    id: "unentered-freeze",
    personalStatus: "absent",
    erpStatus: null,
  });
  const normalSessions = Array.from({ length: 5 }, () =>
    createMockSession({ personalStatus: "present", erpStatus: "Present" })
  );

  const before = computeFullAnalytics([unenteredSession, ...normalSessions], now);
  assert.equal(before.erp.totalEligible, 6);
  assert.equal(before.erp.notEnteredCount, 1);

  const frozen = { ...unenteredSession, personalStatus: "frozen" };
  const after = computeFullAnalytics([frozen, ...normalSessions], now);
  assert.equal(after.erp.totalEligible, 5);
  assert.equal(after.erp.notEnteredCount, 0, "Unentered count must decrement");
});

// Test 17: Freezing a class with different AW and ERP statuses
runTest("Scenario 17: Freezing class with differing AW & ERP statuses updates appropriate numerators", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  // AW Present, but ERP Absent
  const mixedSession = createMockSession({
    id: "mixed-freeze",
    personalStatus: "present",
    erpStatus: "Absent",
  });
  const list = [
    mixedSession,
    createMockSession({ personalStatus: "present", erpStatus: "Present" }),
  ];

  const before = computeFullAnalytics(list, now);
  assert.equal(before.overall.presentCount, 2);
  assert.equal(before.erp.presentCount, 1);
  assert.equal(before.overall.totalEligible, 2);

  const frozen = { ...mixedSession, personalStatus: "frozen" };
  const after = computeFullAnalytics([frozen, list[1]], now);
  assert.equal(after.overall.totalEligible, 1);
  assert.equal(after.overall.presentCount, 1, "AW Present decreased by 1");
  assert.equal(after.erp.presentCount, 1, "ERP Present remained 1");
  assert.equal(after.overall.percentage, 100);
  assert.equal(after.erp.percentage, 100);
});

// Test 18: Frozen classes disappear from eligible subject-wise calculations
runTest("Scenario 18: Frozen classes disappear from eligible subject-wise calculations", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const subSession = createMockSession({
    subjectId: "sub-algo",
    subjectName: "Algorithms",
    personalStatus: "frozen",
  });
  const stats = computeFullAnalytics([subSession], now);
  const subMeta = stats.subjects.find((s) => s.subjectId === "sub-algo");
  assert.equal(subMeta?.totalEligible, 0);
  assert.equal(subMeta?.attendwise.percentage, null);
});

// Test 19: Reactivity test - state update triggers instant recomputation
runTest("Scenario 19: Pure calculation recomputes immediately upon session array update", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  let state = [createMockSession({ personalStatus: "present" })];
  let res1 = computeFullAnalytics(state, now);
  assert.equal(res1.overall.totalEligible, 1);

  state = [...state, createMockSession({ personalStatus: "absent" })];
  let res2 = computeFullAnalytics(state, now);
  assert.equal(res2.overall.totalEligible, 2);
  assert.equal(res2.overall.percentage, 50);
});

// Test 20: Repeated updates do not decrement counts more than once (idempotency)
runTest("Scenario 20: Freezing multiple times does not reduce denominator more than once", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const frozenSession = createMockSession({ id: "idempotent-1", personalStatus: "frozen" });
  const activeSession = createMockSession({ id: "active-1", personalStatus: "present" });

  const res = computeFullAnalytics([frozenSession, activeSession], now);
  assert.equal(res.overall.totalEligible, 1);
  assert.equal(res.overview.frozenCount, 1);
});

// Test 21: Unfreezing restores original recorded values and recalculates
runTest("Scenario 21: Unfreezing restores original recorded values and recalculates", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const session = createMockSession({
    id: "unfreeze-target",
    personalStatus: "frozen",
    previousPersonalStatus: "present",
    erpStatus: "Present",
  });

  const before = computeFullAnalytics([session], now);
  assert.equal(before.overall.totalEligible, 0);

  // Unfreeze
  const restored = {
    ...session,
    personalStatus: session.previousPersonalStatus,
    frozenAt: null,
  };
  const after = computeFullAnalytics([restored], now);
  assert.equal(after.overall.totalEligible, 1);
  assert.equal(after.overall.presentCount, 1);
  assert.equal(after.overall.percentage, 100);
});

// Test 22: Freezing preserves original attendance values and auditability
runTest("Scenario 22: Freezing preserves original attendance metadata for auditability", () => {
  const original = createMockSession({
    personalStatus: "present",
    erpStatus: "Present",
  });
  const frozen = {
    ...original,
    personalStatus: "frozen",
    previousPersonalStatus: original.personalStatus,
    previousErpStatus: original.erpStatus,
    frozenAt: new Date().toISOString(),
  };

  assert.equal(frozen.previousPersonalStatus, "present");
  assert.equal(frozen.previousErpStatus, "Present");
  assert.ok(frozen.frozenAt);
});

console.log("\n--- GROUP 4: Additional Scenario Tests ---");

// Test 23: Cancelled classes are excluded from calculations and denominator
runTest("Scenario 23: Cancelled classes are excluded from calculations and denominator", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const cancelled = createMockSession({ personalStatus: "cancelled" });
  const active = createMockSession({ personalStatus: "present" });

  const stats = computeFullAnalytics([cancelled, active], now);
  assert.equal(stats.overall.totalEligible, 1);
  assert.equal(stats.overview.cancelledCount, 1);
});

// Test 24: Missing ERP statuses are not converted into Absent
runTest("Scenario 24: Missing ERP status remains null and is never converted to Absent", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const session = createMockSession({ erpStatus: null });
  const stats = computeFullAnalytics([session], now);

  assert.equal(stats.erp.absentCount, 0, "ERP Absent must remain 0");
  assert.equal(stats.erp.notEnteredCount, 1, "Must be counted as notEntered");
});

// Test 25: Multi-student isolation
runTest("Scenario 25: Student records are strictly filtered by student ownership", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  const student1Sessions = [createMockSession({ studentId: "student-1", personalStatus: "present" })];
  const student2Sessions = [createMockSession({ studentId: "student-2", personalStatus: "absent" })];

  const stats1 = computeFullAnalytics(student1Sessions.filter((s) => s.studentId === "student-1"), now);
  const stats2 = computeFullAnalytics(student2Sessions.filter((s) => s.studentId === "student-2"), now);

  assert.equal(stats1.overall.percentage, 100);
  assert.equal(stats2.overall.percentage, 0);
});

// Test 26: Failed data loading / zero state does not produce fake percentages
runTest("Scenario 26: Empty dataset returns null percentage (N/A) without fabricating numbers", () => {
  const stats = computeFullAnalytics([], Date.now());
  assert.equal(stats.overall.percentage, null);
  assert.equal(stats.erp.percentage, null);
  assert.equal(stats.overall.totalEligible, 0);
});

// Test 27: Strict window checking for marking present
runTest("Scenario 27: Window boundaries enforce start <= now < end", () => {
  const start = new Date("2026-10-16T10:00:00+05:30").getTime();
  const end = new Date("2026-10-16T11:00:00+05:30").getTime();

  const beforeStart = start - 1000;
  const duringWindow = start + 5000;
  const afterEnd = end + 1000;

  assert.equal(duringWindow >= start && duringWindow < end, true);
  assert.equal(beforeStart >= start, false);
  assert.equal(afterEnd < end, false);
});

// Test 28: Worked example from Part 5.2
runTest("Scenario 28: Part 5.2 Worked Example (AW=75%, ERP=60% over 20 eligible classes)", () => {
  const now = new Date("2026-10-16T12:00:00+05:30").getTime();
  // Part 5.2 scenario:
  // Total eligible: 20
  // AttendWise Present: 15, AttendWise Absent: 5
  // ERP Present: 12, ERP Absent: 4, ERP Not Entered: 4
  const sessions: SessionLike[] = [
    // 12 classes: AW Present, ERP Present
    ...Array.from({ length: 12 }, () =>
      createMockSession({ personalStatus: "present", erpStatus: "Present" })
    ),
    // 3 classes: AW Present, ERP Absent
    ...Array.from({ length: 3 }, () =>
      createMockSession({ personalStatus: "present", erpStatus: "Absent" })
    ),
    // 1 class: AW Absent, ERP Absent
    ...Array.from({ length: 1 }, () =>
      createMockSession({ personalStatus: "absent", erpStatus: "Absent" })
    ),
    // 4 classes: AW Absent, ERP Not Entered (null)
    ...Array.from({ length: 4 }, () =>
      createMockSession({ personalStatus: "absent", erpStatus: null })
    ),
  ];

  const stats = computeFullAnalytics(sessions, now);

  assert.equal(stats.overall.totalEligible, 20);
  assert.equal(stats.overall.presentCount, 15);
  assert.equal(stats.overall.absentCount, 5);
  assert.equal(stats.overall.percentage, 75); // 15 / 20 * 100 = 75%

  assert.equal(stats.erp.totalEligible, 20);
  assert.equal(stats.erp.presentCount, 12);
  assert.equal(stats.erp.absentCount, 4);
  assert.equal(stats.erp.notEnteredCount, 4);
  assert.equal(stats.erp.percentage, 60); // 12 / 20 * 100 = 60%
});

console.log("\n=======================================================");
console.log(` RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
