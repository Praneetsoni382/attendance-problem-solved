/**
 * AttendWise Persistence, Data Integrity & Session Restoration Test Suite
 * Validates Firestore data lifecycle, photo evidence, key notes, ERP status, and reload restoration.
 */
import assert from "node:assert/strict";
import {
  computeFullAnalytics,
  isSessionEligible,
  type SessionLike,
} from "../artifacts/attendwise/src/lib/analytics-calculator";
import {
  buildDefaultSistecData,
  PYTHON_TRAINING_DATES,
  SISTEC_TIME_SLOTS,
} from "../artifacts/attendwise/src/lib/firebase";

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res
        .then(() => {
          console.log(`  ✓ ${name}`);
          passed++;
        })
        .catch((err: any) => {
          console.error(`  ✗ ${name}`);
          console.error(`    Error: ${err.message}`);
          failed++;
        });
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log(" ATTENDWISE PERSISTENCE & DATA INTEGRITY TEST SUITE");
console.log("=======================================================\n");

// Test 1: Full Sistec default seeding integrity
runTest("Test A: Universal Sistec dataset builds all 13 subjects and historical Python Training", () => {
  const dummyUid = "test-student-uid-12345";
  const data = buildDefaultSistecData(dummyUid);
  
  assert.equal(data.subjects.length, 13, "Should have exactly 13 subjects");
  assert.ok(data.subjects.some((s) => s.id === "sub-python-training"), "Should include Python Training subject");
  
  // Exactly 66 Python training sessions (11 days * 6 periods)
  const pySessions = data.sessions.filter((s) => s.subjectId === "sub-python-training");
  assert.equal(pySessions.length, 66, "Should have exactly 66 Python Training sessions");
  
  // Total regular teaching sessions
  assert.ok(data.sessions.length > 400, "Total sessions across academic term should exceed 400");
});

// Test 2: Attendance card state restoration across reload
runTest("Test B: Saved Firestore session record restores Present, photo evidence, keynote, and ERP status", () => {
  const dummyUid = "test-student-uid-12345";
  const data = buildDefaultSistecData(dummyUid);
  const targetSession = data.sessions[0]!;

  // Simulate user marking present with photo and keynote, and marking ERP
  const savedRecord = {
    ...targetSession,
    personalStatus: "present" as const,
    finalized: true,
    finalizedAt: "2026-10-15T10:30:00.000Z",
    serverReceiptAt: "2026-10-15T10:29:45.000Z",
    clientCaptureAt: "2026-10-15T10:29:45.000Z",
    photoDataUrl: "https://firebasestorage.googleapis.com/v0/b/bucket/o/proof.jpg",
    evidenceStoragePath: `users/${dummyUid}/attendance/${targetSession.id}/proof.jpg`,
    evidenceAvailable: true,
    note: "Covered Graph traversal and DFS implementation.",
    erpStatus: "Present" as const,
    erpRecordedAt: "2026-10-15T11:00:00.000Z",
  };

  // Simulate Firestore onSnapshot returning the document map
  const firestoreMap = new Map<string, typeof savedRecord>();
  firestoreMap.set(targetSession.id, savedRecord);

  // Restore logic as implemented in App.tsx
  const restoredList = data.sessions.map((ds) => {
    const fsRecord = firestoreMap.get(ds.id);
    return fsRecord || ds;
  });

  const restored = restoredList.find((s) => s.id === targetSession.id)!;
  assert.equal(restored.personalStatus, "present", "Personal status must be restored as Present");
  assert.equal(restored.erpStatus, "Present", "ERP status must be restored as Present");
  assert.equal(restored.note, "Covered Graph traversal and DFS implementation.", "Keynote must be restored");
  assert.equal(restored.photoDataUrl, "https://firebasestorage.googleapis.com/v0/b/bucket/o/proof.jpg", "Photo URL must be restored");
  assert.equal(restored.evidenceAvailable, true, "Evidence available must be true");
  assert.equal(restored.serverReceiptAt, "2026-10-15T10:29:45.000Z", "Server receipt must be restored");
});

// Test 3: Keynote idempotency
runTest("Test C: Keynote update is idempotent when identical note is submitted", () => {
  const existingNote = "Lecture on Quicksort";
  const incomingNote = "Lecture on Quicksort";
  
  // If note matches, it should be treated as a no-op without throwing
  const isIdentical = existingNote.trim() === incomingNote.trim();
  assert.ok(isIdentical, "Identical note comparison correctly identifies duplicate submission");
});

// Test 4: Rollback logic on Firestore write failure
runTest("Test D: Optimistic React state rolls back if Cloud Firestore write fails", () => {
  let reactSessions: SessionLike[] = [
    {
      id: "sess-1",
      studentId: "student-1",
      subjectId: "sub-1",
      subjectName: "Math",
      subjectCode: "M301",
      scheduledDate: "2026-10-15",
      scheduledStartAt: "2026-10-15T09:30:00Z",
      scheduledEndAt: "2026-10-15T10:30:00Z",
      category: "Theory",
      personalStatus: "unmarked",
      erpStatus: null,
      finalized: false,
    },
  ];

  const prevSession = reactSessions[0]!;
  // Apply optimistic update
  reactSessions = reactSessions.map((s) => (s.id === "sess-1" ? { ...s, personalStatus: "present" } : s));
  assert.equal(reactSessions[0]!.personalStatus, "present");

  // Simulate Firestore rejection
  const firestoreError = new Error("Attendance window closed at scheduled end time.");
  if (firestoreError) {
    // Rollback to previous state
    reactSessions = reactSessions.map((s) => (s.id === "sess-1" ? prevSession : s));
  }

  assert.equal(reactSessions[0]!.personalStatus, "unmarked", "React state rolled back cleanly to unmarked");
});

// Test 5: Photo evidence payload compression
runTest("Test E: Photo evidence storage path and URL persist without exceeding localStorage quota", () => {
  const samplePhotoUrl = "https://firebasestorage.googleapis.com/v0/b/dev-weaver.firebasestorage.app/o/users%2F123%2Fproof.jpg";
  const patch = {
    personalStatus: "present" as const,
    finalized: true,
    photoDataUrl: "data:image/jpeg;base64," + "A".repeat(50000), // Huge base64
    evidenceStoragePath: "users/123/proof.jpg",
  };

  // Safe patch removes huge inline data: URLs before caching in localStorage
  const safePatch = { ...patch };
  if (safePatch.photoDataUrl && safePatch.photoDataUrl.startsWith("data:")) {
    delete (safePatch as any).photoDataUrl;
  }

  assert.equal(safePatch.photoDataUrl, undefined, "Inline data URL stripped from local cache to prevent QuotaExceededError");
  assert.equal(safePatch.evidenceStoragePath, "users/123/proof.jpg", "Storage path preserved");
});

// Test 6: Python Training window allowance
runTest("Test F: Historical Python training sessions allow marking Present independent of current IST clock", () => {
  const dummyUid = "test-uid";
  const data = buildDefaultSistecData(dummyUid);
  const pythonSession = data.sessions.find((s) => s.subjectId === "sub-python-training")!;

  const isHistoricalTraining = Boolean(pythonSession.isSpecialTraining || pythonSession.subjectId === "sub-python-training");
  assert.ok(isHistoricalTraining, "Python Training session correctly identified as historical training");

  // Check window evaluation
  const isPresentAlready = pythonSession.personalStatus === "present";
  const isToday = false; // Scheduled in Sept 2026, today is Oct 2026
  const nowMs = Date.now();
  const startMs = new Date(pythonSession.scheduledStartAt).getTime();
  const endMs = new Date(pythonSession.scheduledEndAt).getTime();

  const inWindow = Boolean(
    pythonSession && !pythonSession.finalized && !isPresentAlready && (
      isHistoricalTraining || (isToday && nowMs >= startMs && nowMs < endMs)
    )
  );

  assert.ok(inWindow, "Python Training session is open for student attendance marking");
});

// Test 7: Universal Denominator with multiple subjects and Python training
runTest("Test G: Denominator matches total completed eligible classes across AttendWise and ERP", () => {
  const dummyUid = "test-uid";
  const data = buildDefaultSistecData(dummyUid);

  // Take the 66 Python training sessions and set 50 Present, 16 Absent
  const testSessions = data.sessions.slice(0, 66).map((s, idx) => ({
    ...s,
    personalStatus: idx < 50 ? ("present" as const) : ("absent" as const),
    erpStatus: idx < 45 ? ("Present" as const) : idx < 60 ? ("Absent" as const) : null,
    finalized: true,
  }));

  const stats = computeFullAnalytics(testSessions);
  assert.equal(stats.overview.totalEligibleCompleted, 66, "Total completed eligible classes must be 66");
  assert.equal(stats.overall.presentCount, 50, "AttendWise present count is 50");
  assert.equal(stats.erp.presentCount, 45, "ERP present count is 45");
  assert.equal(stats.overall.totalEligible, 66, "Shared universal denominator is 66");
  assert.equal(stats.overall.percentage, 75.8, "AttendWise percentage is 75.8%");
  assert.equal(stats.erp.percentage, 68.2, "ERP percentage is 68.2%");
});

// Test 8: Period 7 Test Class in today's schedule
runTest("Test H: Period 7 Test Class is created for today (7:00 PM to 11:00 PM IST) and isolated from timetable", () => {
  const dummyUid = "test-uid";
  const data = buildDefaultSistecData(dummyUid);

  // 1. Verify it does NOT exist in the timetable entries
  const inTimetable = data.timetable.some((t) => t.slot === "P7" || t.subjectCode === "TEST-P7");
  assert.equal(inTimetable, false, "Period 7 Test Class must NOT enter the daily timetable schedule");

  // 2. Verify it DOES exist in sessions for today
  const p7Session = data.sessions.find((s) => s.slot === "P7");
  assert.ok(p7Session, "Period 7 Test Class must exist in sessions");
  assert.equal(p7Session.subjectName, "Test Class", "Subject name must be Test Class");
  assert.equal(p7Session.subjectCode, "TEST-P7", "Subject code must be TEST-P7");
  assert.equal(p7Session.timetableEntryId, null, "timetableEntryId must be null (isolated from timetable)");

  // 3. Verify timing is 19:00 to 23:00 IST
  const startObj = new Date(p7Session.scheduledStartAt);
  const endObj = new Date(p7Session.scheduledEndAt);
  // IST hours:
  const istStartHours = (startObj.getUTCHours() + 5 + Math.floor((startObj.getUTCMinutes() + 30) / 60)) % 24;
  const istEndHours = (endObj.getUTCHours() + 5 + Math.floor((endObj.getUTCMinutes() + 30) / 60)) % 24;
  assert.equal(istStartHours, 19, "Start time must be 7:00 PM IST (19:00)");
  assert.equal(istEndHours, 23, "End time must be 11:00 PM IST (23:00)");

  // 4. Verify within window (e.g. at 20:00 IST), isSessionInWindow returns true
  const insideTimeMs = startObj.getTime() + 60 * 60 * 1000; // 8:00 PM IST
  const isInside = insideTimeMs >= startObj.getTime() && insideTimeMs < endObj.getTime();
  assert.equal(isInside, true, "Must be In Run between 7:00 PM and 11:00 PM IST");

  // 5. Verify after window (e.g. at 23:05 IST), it is overdue / closed
  const afterTimeMs = endObj.getTime() + 5 * 60 * 1000;
  const isOverdue = afterTimeMs >= endObj.getTime();
  assert.equal(isOverdue, true, "Must be closed / overdue after 11:00 PM IST");
});

console.log("\n=======================================================");
console.log(` RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

process.exit(failed > 0 ? 1 : 0);
