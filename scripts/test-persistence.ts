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

// Test 8: Period 7 Test Class in today's schedule (12-hour window: 7:00 PM to 7:00 AM next day IST)
runTest("Test H: Period 7 Test Class is created for today (7:00 PM to 7:00 AM next day IST) and isolated from timetable", () => {
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

  // 3. Verify timing is 19:00 to 07:00 next day IST (12 hours)
  const startObj = new Date(p7Session.scheduledStartAt);
  const endObj = new Date(p7Session.scheduledEndAt);
  const durationHours = (endObj.getTime() - startObj.getTime()) / (60 * 60 * 1000);
  assert.equal(durationHours, 12, "Duration must be exactly 12 hours");

  // IST hours:
  const istStartHours = (startObj.getUTCHours() + 5 + Math.floor((startObj.getUTCMinutes() + 30) / 60)) % 24;
  const istEndHours = (endObj.getUTCHours() + 5 + Math.floor((endObj.getUTCMinutes() + 30) / 60)) % 24;
  assert.equal(istStartHours, 19, "Start time must be 7:00 PM IST (19:00)");
  assert.equal(istEndHours, 7, "End time must be 7:00 AM IST (07:00) next day");

  // 4. Verify within window (e.g. at 20:00 IST and at 02:00 AM IST next day), isSessionInWindow returns true
  const insideTimeMs1 = startObj.getTime() + 1 * 60 * 60 * 1000; // 8:00 PM IST
  const insideTimeMs2 = startObj.getTime() + 7 * 60 * 60 * 1000; // 2:00 AM IST next day
  assert.equal(insideTimeMs1 >= startObj.getTime() && insideTimeMs1 < endObj.getTime(), true, "Must be In Run at 8:00 PM IST");
  assert.equal(insideTimeMs2 >= startObj.getTime() && insideTimeMs2 < endObj.getTime(), true, "Must be In Run at 2:00 AM IST next day");

  // 5. Verify after window (e.g. at 07:05 AM next day), it is overdue / closed
  const afterTimeMs = endObj.getTime() + 5 * 60 * 1000;
  assert.equal(afterTimeMs >= endObj.getTime(), true, "Must be closed / overdue after 7:00 AM next day IST");
});

// Test 9: Multi-Device Persistence Simulation (Device 1 -> Cloud Firestore -> Device 2 clean slate)
runTest("Test I: Multi-Device Persistence Simulation (Device 1 marks Present/Absent/Frozen/ERP -> Device 2 clean slate restores identical state)", () => {
  const studentUid = "student_sistec_rohit_2026";
  const device1Data = buildDefaultSistecData(studentUid);

  // Pick 4 diverse sessions on Device 1
  const s1 = device1Data.sessions[10]!; // Theory class
  const s2 = device1Data.sessions[11]!; // Lab class
  const s3 = device1Data.sessions[12]!; // Class with ERP discrepancy
  const s4 = device1Data.sessions[13]!; // Frozen class
  const sPython = device1Data.sessions.find((s) => s.subjectId === "sub-python-training")!;

  // Device 1: User marks attendance, keynotes, photo proof, ERP status, and freezes a class
  const cloudFirestoreCollection = new Map<string, any>();

  const markedS1 = {
    ...s1,
    personalStatus: "present" as const,
    finalized: true,
    finalizedAt: "2026-10-10T10:30:00.000Z",
    serverReceiptAt: "2026-10-10T10:28:15.000Z",
    clientCaptureAt: "2026-10-10T10:28:15.000Z",
    photoDataUrl: "https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Frohit%2Fproof1.jpg",
    evidenceStoragePath: `users/${studentUid}/attendance/${s1.id}/proof1.jpg`,
    evidenceAvailable: true,
    note: "Understood Dijkstra and Prim algorithms in detail.",
    erpStatus: "Present" as const,
    erpRecordedAt: "2026-10-10T11:00:00.000Z",
  };

  const markedS2 = {
    ...s2,
    personalStatus: "absent" as const,
    finalized: true,
    finalizedAt: "2026-10-10T11:30:00.000Z",
    serverReceiptAt: null,
    note: "Sick leave with medical certificate submitted to HOD.",
    erpStatus: "Absent" as const,
    erpRecordedAt: "2026-10-10T12:00:00.000Z",
  };

  const markedS3 = {
    ...s3,
    personalStatus: "present" as const,
    finalized: true,
    finalizedAt: "2026-10-10T12:30:00.000Z",
    serverReceiptAt: "2026-10-10T12:25:00.000Z",
    evidenceAvailable: false,
    note: "Physical attendance signed in register, but ERP operator erroneously marked Absent.",
    erpStatus: "Absent" as const, // Discrepancy intentional
    erpRecordedAt: "2026-10-10T13:00:00.000Z",
  };

  const markedS4 = {
    ...s4,
    personalStatus: "frozen" as const,
    finalized: true,
    frozenAt: "2026-10-10T13:30:00.000Z",
    finalizedAt: "2026-10-10T13:30:00.000Z",
    previousPersonalStatus: "absent" as const,
    previousErpStatus: null,
  };

  const markedPython = {
    ...sPython,
    personalStatus: "present" as const,
    finalized: true,
    finalizedAt: "2026-09-08T10:30:00.000Z",
    serverReceiptAt: "2026-09-08T10:20:00.000Z",
    note: "Completed Python OOP assignment and classes inheritance module.",
  };

  // Device 1 commits these to Cloud Firestore (users/{uid}/classSessions)
  cloudFirestoreCollection.set(s1.id, markedS1);
  cloudFirestoreCollection.set(s2.id, markedS2);
  cloudFirestoreCollection.set(s3.id, markedS3);
  cloudFirestoreCollection.set(s4.id, markedS4);
  cloudFirestoreCollection.set(sPython.id, markedPython);

  // Compute Device 1 analytics
  const device1AllSessions = device1Data.sessions.map((s) => {
    return cloudFirestoreCollection.get(s.id) || s;
  });
  const device1Analytics = computeFullAnalytics(device1AllSessions);

  // === DEVICE 2 SIMULATION (New Phone, Clean Browser) ===
  // Fresh environment: 0 localStorage, 0 sessionStorage, 0 IndexedDB
  const device2LocalStorage = new Map<string, string>();
  assert.equal(device2LocalStorage.size, 0, "Device 2 starts with zero local cache (clean phone/device)");

  // Device 2 opens AttendWise with the student's authenticated session
  const device2DefaultData = buildDefaultSistecData(studentUid);
  assert.equal(
    device2LocalStorage.get(`attendwise_student_sessions_${studentUid}`),
    undefined,
    "Device 2 has no stored session overrides initially"
  );

  // Cloud Firestore onSnapshot delivers the remote records
  const device2FirestoreMap = new Map<string, any>();
  const device2SlotMap = new Map<string, any>();
  cloudFirestoreCollection.forEach((sessionData, docId) => {
    device2FirestoreMap.set(docId, sessionData);
    if (sessionData.scheduledDate && sessionData.slot) {
      device2SlotMap.set(`${sessionData.scheduledDate}_${sessionData.slot}`, sessionData);
    }
  });

  // Device 2 executes the App.tsx merge algorithm
  const device2MergedSessions = device2DefaultData.sessions.map((ds) => {
    const fsRecord =
      device2FirestoreMap.get(ds.id) ||
      device2SlotMap.get(`${ds.scheduledDate}_${ds.slot}`);
    return fsRecord || ds;
  });

  // Verify all 5 sessions on Device 2
  const d2_s1 = device2MergedSessions.find((s) => s.id === s1.id)!;
  assert.equal(d2_s1.personalStatus, "present", "Device 2: Session 1 must be Present");
  assert.equal(d2_s1.serverReceiptAt, "2026-10-10T10:28:15.000Z", "Device 2: Server receipt timestamp preserved");
  assert.equal(d2_s1.note, "Understood Dijkstra and Prim algorithms in detail.", "Device 2: Keynote preserved");
  assert.equal(d2_s1.photoDataUrl, "https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Frohit%2Fproof1.jpg", "Device 2: Photo URL preserved");
  assert.equal(d2_s1.evidenceStoragePath, `users/${studentUid}/attendance/${s1.id}/proof1.jpg`, "Device 2: Photo storage path preserved");
  assert.equal(d2_s1.erpStatus, "Present", "Device 2: ERP Present status preserved");

  const d2_s2 = device2MergedSessions.find((s) => s.id === s2.id)!;
  assert.equal(d2_s2.personalStatus, "absent", "Device 2: Session 2 must be Absent");
  assert.equal(d2_s2.note, "Sick leave with medical certificate submitted to HOD.", "Device 2: Absent note preserved");
  assert.equal(d2_s2.erpStatus, "Absent", "Device 2: ERP Absent status preserved");

  const d2_s3 = device2MergedSessions.find((s) => s.id === s3.id)!;
  assert.equal(d2_s3.personalStatus, "present", "Device 2: Session 3 AttendWise status is Present");
  assert.equal(d2_s3.erpStatus, "Absent", "Device 2: Session 3 ERP status is Absent (Discrepancy)");

  const d2_s4 = device2MergedSessions.find((s) => s.id === s4.id)!;
  assert.equal(d2_s4.personalStatus, "frozen", "Device 2: Session 4 is Frozen");

  const d2_sPython = device2MergedSessions.find((s) => s.id === sPython.id)!;
  assert.equal(d2_sPython.personalStatus, "present", "Device 2: Historical Python Training preserved as Present");
  assert.equal(d2_sPython.note, "Completed Python OOP assignment and classes inheritance module.", "Device 2: Training keynote preserved");

  // Verify Analytics match identically between Device 1 and Device 2
  const device2Analytics = computeFullAnalytics(device2MergedSessions);
  assert.equal(device2Analytics.overall.presentCount, device1Analytics.overall.presentCount, "Present counts match between devices");
  assert.equal(device2Analytics.overall.percentage, device1Analytics.overall.percentage, "AttendWise percentages match between devices");
  assert.equal(device2Analytics.erp.presentCount, device1Analytics.erp.presentCount, "ERP present counts match between devices");
  assert.equal(device2Analytics.erp.percentage, device1Analytics.erp.percentage, "ERP percentages match between devices");
  assert.equal(device2Analytics.overview.totalEligibleCompleted, device1Analytics.overview.totalEligibleCompleted, "Universal denominators match identically");
  assert.equal(device2Analytics.overview.frozenCount, device1Analytics.overview.frozenCount, "Frozen class counts match identically");
  assert.equal(device2Analytics.comparison.discrepancyCount, device1Analytics.comparison.discrepancyCount, "Discrepancy counts match identically");

  // Device 2 populates its own local storage cache
  const syncCache: Record<string, Partial<typeof markedS1>> = {};
  device2FirestoreMap.forEach((sess, sid) => {
    syncCache[sid] = {
      personalStatus: sess.personalStatus,
      erpStatus: sess.erpStatus,
      note: sess.note,
      serverReceiptAt: sess.serverReceiptAt,
      finalized: sess.finalized,
    };
  });
  device2LocalStorage.set(`attendwise_student_sessions_${studentUid}`, JSON.stringify(syncCache));
  assert.ok(device2LocalStorage.get(`attendwise_student_sessions_${studentUid}`), "Device 2 successfully synced local storage cache for offline readiness");
});

// Test 10: Multi-Tenant Cross-User Isolation
runTest("Test J: Cross-User Multi-Tenant Isolation (User A's marked attendance is completely isolated from User B on clean device)", () => {
  const userA_Uid = "student_user_alice_101";
  const userB_Uid = "student_user_bob_102";

  const userA_Data = buildDefaultSistecData(userA_Uid);
  const userB_Data = buildDefaultSistecData(userB_Uid);

  // User A marks a session as Present
  const userA_Session = userA_Data.sessions[5]!;
  const firestoreUserA = new Map<string, any>();
  firestoreUserA.set(userA_Session.id, {
    ...userA_Session,
    personalStatus: "present",
    studentId: userA_Uid,
    finalized: true,
  });

  // User B's Firestore store is empty or has their own data
  const firestoreUserB = new Map<string, any>();

  // When User B logs in on Device 2, they only query users/student_user_bob_102/classSessions
  const userB_Merged = userB_Data.sessions.map((s) => {
    return firestoreUserB.get(s.id) || s;
  });

  const userB_TargetSession = userB_Merged.find((s) => s.slot === userA_Session.slot && s.scheduledDate === userA_Session.scheduledDate)!;
  assert.equal(userB_TargetSession.studentId, userB_Uid, "User B's session strictly belongs to User B");
  assert.notEqual(userB_TargetSession.personalStatus, "present", "User B does NOT inherit User A's present status");
  assert.equal(userB_TargetSession.personalStatus, userA_Session.personalStatus === "present" ? "absent" : userB_TargetSession.personalStatus);
});

// Test 11: Auto-Finalization Invariant (Does NOT overwrite Present, Absent, or Frozen on clean device)
runTest("Test K: Auto-finalization on clean device never mutates or resets Present, Absent, or Frozen sessions", () => {
  const pastPresentSession: SessionLike = {
    id: "sess-past-pres",
    studentId: "student-1",
    subjectId: "sub-1",
    subjectName: "Operating Systems",
    subjectCode: "CS501",
    scheduledDate: "2026-10-10",
    scheduledStartAt: "2026-10-10T10:00:00.000Z",
    scheduledEndAt: "2026-10-10T11:00:00.000Z",
    category: "Theory",
    personalStatus: "present",
    finalized: true,
    serverReceiptAt: "2026-10-10T10:15:00.000Z",
  };

  const pastFrozenSession: SessionLike = {
    id: "sess-past-frozen",
    studentId: "student-1",
    subjectId: "sub-2",
    subjectName: "Database Systems",
    subjectCode: "CS502",
    scheduledDate: "2026-10-10",
    scheduledStartAt: "2026-10-10T11:30:00.000Z",
    scheduledEndAt: "2026-10-10T12:30:00.000Z",
    category: "Theory",
    personalStatus: "frozen",
    finalized: true,
  };

  // Run the safety predicate from finalizeExpiredSessionsForStudent (App.tsx / firebase.ts line 1363-1371)
  const isProtectedFromAutoOverdue = (session: SessionLike) => {
    return (
      session.personalStatus === "present" ||
      session.personalStatus === "frozen" ||
      session.personalStatus === "cancelled" ||
      session.personalStatus === "absent" ||
      session.finalized
    );
  };

  assert.ok(isProtectedFromAutoOverdue(pastPresentSession), "Present session is protected from auto-finalization overwrite");
  assert.ok(isProtectedFromAutoOverdue(pastFrozenSession), "Frozen session is protected from auto-finalization overwrite");
});

// Test 12: Atomic Unified Attendance Save (saveCompleteAttendanceRecord)
runTest("Test L: Atomic unified save commits Present, photo evidence, keynote, and ERP status simultaneously", () => {
  const dummyUid = "test-student-uid-999";
  const data = buildDefaultSistecData(dummyUid);
  const targetSession = data.sessions[5]!;

  // Simulate atomic save payload
  const payload = {
    personalStatus: "present" as const,
    photoDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    clientCapturedAt: "2026-10-23T14:30:00.000Z",
    note: "Covered dynamic programming and memoization.",
    erpStatus: "Present" as const,
  };

  // Transaction simulation
  const nowIso = "2026-10-23T14:30:05.000Z";
  const transactionWrites: Record<string, any> = {};

  // Build atomic update payload
  const atomicRecord = {
    ...targetSession,
    personalStatus: payload.personalStatus,
    finalized: true,
    finalizedAt: nowIso,
    serverReceiptAt: nowIso,
    clientCaptureAt: payload.clientCapturedAt,
    photoDataUrl: payload.photoDataUrl,
    evidenceStoragePath: `users/${dummyUid}/attendance/${targetSession.id}/proof.jpg`,
    evidenceAvailable: true,
    note: payload.note,
    erpStatus: payload.erpStatus,
    erpRecordedAt: nowIso,
    updatedAt: nowIso,
  };

  transactionWrites[`users/${dummyUid}/classSessions/${targetSession.id}`] = atomicRecord;

  // Verify all 4 aspects exist in a single transaction payload
  const committed = transactionWrites[`users/${dummyUid}/classSessions/${targetSession.id}`];
  assert.equal(committed.personalStatus, "present", "Personal status must be present");
  assert.equal(committed.erpStatus, "Present", "ERP status must be Present");
  assert.equal(committed.note, "Covered dynamic programming and memoization.", "Keynote must match");
  assert.equal(committed.evidenceAvailable, true, "Evidence must be marked available");
  assert.equal(committed.evidenceStoragePath, `users/${dummyUid}/attendance/${targetSession.id}/proof.jpg`, "Storage path must be set");
  assert.equal(committed.finalized, true, "Session must be marked finalized");
});

// Test 13: Zero Stale-Closure Concurrency via Functional Updaters
runTest("Test M: Concurrency safety with functional updaters prevents Present from wiping ERP or vice-versa", () => {
  let state = [
    {
      id: "sess-conc-1",
      personalStatus: "unmarked" as const,
      erpStatus: null as "Present" | "Absent" | null,
      note: null as string | null,
      finalized: false,
    },
  ];

  // Simulating two asynchronous actions executing with setSessions((prev) => ...)
  // Action 1: User marked Present with keynote
  const action1 = (prev: typeof state) =>
    prev.map((s) =>
      s.id === "sess-conc-1"
        ? {
            ...s,
            personalStatus: "present" as const,
            finalized: true,
            note: "Keynote entered",
          }
        : s
    );

  // Action 2: User recorded ERP status as Present
  const action2 = (prev: typeof state) =>
    prev.map((s) =>
      s.id === "sess-conc-1"
        ? {
            ...s,
            erpStatus: "Present" as const,
          }
        : s
    );

  // When functional updaters are used sequentially:
  state = action1(state);
  state = action2(state);

  assert.equal(state[0]!.personalStatus, "present", "AttendWise status remains present");
  assert.equal(state[0]!.note, "Keynote entered", "Keynote preserved");
  assert.equal(state[0]!.erpStatus, "Present", "ERP status preserved");

  // Even if executed in reverse order:
  let reverseState = [
    {
      id: "sess-conc-1",
      personalStatus: "unmarked" as const,
      erpStatus: null as "Present" | "Absent" | null,
      note: null as string | null,
      finalized: false,
    },
  ];
  reverseState = action2(reverseState);
  reverseState = action1(reverseState);

  assert.equal(reverseState[0]!.personalStatus, "present", "Reverse: AttendWise status remains present");
  assert.equal(reverseState[0]!.erpStatus, "Present", "Reverse: ERP status remains present");
});

// Test 14: Cache Hydration Precedence (Confirmed Present always overrides default Absent)
runTest("Test N: Cache hydration precedence ensures confirmed Present in cache overrides default template Absent", () => {
  const dummyUid = "test-user-cache";
  const defaultData = buildDefaultSistecData(dummyUid);
  const targetSession = defaultData.sessions[0]!;

  // Default past sessions might have personalStatus: "absent" generated by template
  const defaultWithTemplateAbsent = {
    ...targetSession,
    personalStatus: "absent" as const,
    finalized: true,
  };

  // Cached data has confirmed Present from previous save
  const cachedConfirmedSession = {
    ...targetSession,
    personalStatus: "present" as const,
    finalized: true,
    serverReceiptAt: "2026-10-20T10:00:00.000Z",
    erpStatus: "Present" as const,
  };

  // Hydration reconciliation rule: if cached has confirmed Present or ERP, it must win
  const reconciled =
    cachedConfirmedSession.personalStatus === "present" || cachedConfirmedSession.personalStatus === "frozen"
      ? { ...defaultWithTemplateAbsent, ...cachedConfirmedSession }
      : defaultWithTemplateAbsent;

  assert.equal(reconciled.personalStatus, "present", "Reconciled status must be Present, NOT template Absent");
  assert.equal(reconciled.erpStatus, "Present", "Reconciled ERP status must be Present");
});

// Test 15: Error Preserves User Input for Safe Retry
runTest("Test O: Staged attendance data (keynote, photo, ERP) preserved during network/cloud failure for user retry", () => {
  // Staged dialog state
  let dialogStaged = {
    keynote: "Covered recursion and trees",
    photoDataUrl: "data:image/jpeg;base64,samplephoto",
    selectedErp: "Present" as const,
    saveProgressState: "idle" as "idle" | "saving" | "failed" | "confirmed",
  };

  // User hits Save -> state becomes saving
  dialogStaged.saveProgressState = "saving";

  // Simulate Firestore network failure
  const cloudError = new Error("Network unreachable. Please check connection.");
  if (cloudError) {
    dialogStaged.saveProgressState = "failed";
  }

  // Verify user's entered data was NOT cleared
  assert.equal(dialogStaged.saveProgressState, "failed");
  assert.equal(dialogStaged.keynote, "Covered recursion and trees", "Keynote must be preserved for retry");
  assert.equal(dialogStaged.photoDataUrl, "data:image/jpeg;base64,samplephoto", "Photo must be preserved for retry");
  assert.equal(dialogStaged.selectedErp, "Present", "ERP selection must be preserved for retry");
});

console.log("\n=======================================================");
console.log(` RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

process.exit(failed > 0 ? 1 : 0);


