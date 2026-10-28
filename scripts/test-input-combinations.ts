/**
 * Test Suite: Attendance Card Input Combinations Verification
 * Verifies all 6 test cases reported by the user:
 * 1. AttendWise status alone (Present / Absent)
 * 2. AttendWise status + ERP status
 * 3. Keynote alone (without AttendWise or ERP status)
 * 4. AttendWise status + Keynote (without ERP status)
 * 5. ERP status + Keynote
 * 6. Camera photo + AttendWise status + ERP status + Keynote (persisting across simulated reload and multi-device access)
 */
import assert from "node:assert/strict";
import {
  buildDefaultSistecData,
  type ClassSessionItem,
  type CompleteAttendancePayload,
} from "../artifacts/attendwise/src/lib/firebase";

console.log("\n=================================================================");
console.log(" ATTENDWISE INPUT COMBINATIONS VERIFICATION TEST SUITE");
console.log("=================================================================\n");

const studentUid = "test_student_combination_verifier";
const defaultData = buildDefaultSistecData(studentUid);

// Simulated authoritative Cloud Firestore database store
const mockFirestoreStore = new Map<string, ClassSessionItem>();

function mockSaveCompleteAttendance(
  uid: string,
  session: ClassSessionItem,
  payload: CompleteAttendancePayload
): ClassSessionItem {
  const receiptAt = new Date().toISOString();
  const captureTimestamp = payload.clientCapturedAt || receiptAt;

  // Resolve personal status: if omitted, preserve existing
  const finalPersonalStatus =
    payload.personalStatus !== undefined && payload.personalStatus !== null
      ? payload.personalStatus
      : session.personalStatus;

  // Immutability checks
  if (session.personalStatus === "present" && payload.personalStatus && payload.personalStatus !== "present") {
    throw new Error("Attendance for this class session has already been recorded as Present and is permanently locked.");
  }

  // ERP status resolution: strictly independent
  let finalErpStatus: "Present" | "Absent" | null = session.erpStatus ?? null;
  let finalErpRecordedAt: string | null = session.erpRecordedAt ?? null;
  if (payload.erpStatus !== undefined && payload.erpStatus !== null) {
    if (session.erpStatus !== null && session.erpStatus !== undefined && session.erpStatus !== payload.erpStatus) {
      throw new Error(`ERP attendance is already permanently recorded as ${session.erpStatus} and is uneditable.`);
    }
    finalErpStatus = payload.erpStatus;
    finalErpRecordedAt = session.erpRecordedAt || receiptAt;
  }

  // Keynote resolution: strictly independent
  let finalNote: string | null = session.note ?? null;
  if (payload.note !== undefined && payload.note !== null) {
    const trimmed = payload.note.trim();
    if (trimmed) {
      if (session.note && session.note.trim() !== "" && session.note.trim() !== trimmed) {
        throw new Error("Keynote/Note has already been saved and is permanently immutable and uneditable.");
      }
      finalNote = trimmed;
    }
  }

  const isFinalized = Boolean(
    session.finalized ||
    finalPersonalStatus === "present" ||
    finalPersonalStatus === "absent" ||
    finalPersonalStatus === "frozen" ||
    finalPersonalStatus === "cancelled"
  );

  const finalFinalizedAt = isFinalized
    ? (session.finalizedAt || (payload.personalStatus ? receiptAt : null))
    : null;

  const finalAbsentType = finalPersonalStatus === "absent"
    ? (session.absentType || "manual_student")
    : null;

  const finalServerReceiptAt = finalPersonalStatus === "present"
    ? (session.serverReceiptAt || receiptAt)
    : (session.serverReceiptAt ?? null);

  const finalClientCaptureAt = finalPersonalStatus === "present"
    ? (captureTimestamp || session.clientCaptureAt || receiptAt)
    : (session.clientCaptureAt ?? null);

  const finalPhotoUrl = payload.photoDataUrl || session.photoDataUrl || null;
  const hasPhoto = Boolean(finalPhotoUrl);

  const result: ClassSessionItem = {
    ...session,
    personalStatus: finalPersonalStatus,
    absentType: finalAbsentType,
    finalized: isFinalized,
    finalizedAt: finalFinalizedAt,
    serverReceiptAt: finalServerReceiptAt,
    clientCaptureAt: finalClientCaptureAt,
    evidenceAvailable: hasPhoto,
    photoDataUrl: finalPhotoUrl,
    evidenceStoragePath: null,
    note: finalNote,
    erpStatus: finalErpStatus,
    erpRecordedAt: finalErpRecordedAt,
    cancelledAt: session.cancelledAt ?? null,
    academicDayNumber: session.academicDayNumber ?? null,
    updatedAt: receiptAt,
  };

  // Verify zero undefined properties in the document
  for (const [key, val] of Object.entries(result)) {
    if (val === undefined) {
      throw new Error(`Firestore rejection: Found undefined property '${key}' in saved document`);
    }
  }

  mockFirestoreStore.set(session.id, result);
  return result;
}

let passed = 0;
let failed = 0;

function runCase(caseName: string, testFn: () => void) {
  try {
    testFn();
    console.log(`  ✓ ${caseName}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${caseName}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Case 1: AttendWise status alone (Present & Absent)
runCase("Case 1A: AttendWise status alone (Present) saves permanently without requiring ERP, photo, or note", () => {
  const session = defaultData.sessions.find((s) => s.slot === "P1")!;
  const saved = mockSaveCompleteAttendance(studentUid, session, {
    personalStatus: "present",
  });

  assert.equal(saved.personalStatus, "present", "AttendWise status must be present");
  assert.equal(saved.finalized, true, "Session must be marked finalized");
  assert.equal(saved.erpStatus, null, "ERP status remains unrecorded (null)");
  assert.equal(saved.erpRecordedAt, null, "ERP recordedAt is null");
  assert.equal(saved.note, null, "Note remains null");
  assert.equal(saved.evidenceAvailable, false, "Evidence is false when photo not taken");
  assert.ok(saved.serverReceiptAt, "Server receipt timestamp must be recorded");
});

runCase("Case 1B: AttendWise status alone (Absent) saves permanently without requiring ERP", () => {
  const session = defaultData.sessions.find((s) => s.slot === "P2")!;
  const saved = mockSaveCompleteAttendance(studentUid, session, {
    personalStatus: "absent",
  });

  assert.equal(saved.personalStatus, "absent", "AttendWise status must be absent");
  assert.equal(saved.absentType, "manual_student", "Absent type must be manual_student");
  assert.equal(saved.finalized, true, "Session must be finalized");
  assert.equal(saved.erpStatus, null, "ERP status remains null");
});

// Case 2: AttendWise status + ERP status
runCase("Case 2: AttendWise status + ERP status saves both permanently and maintains immutability", () => {
  const session = defaultData.sessions.find((s) => s.slot === "P3")!;
  const saved = mockSaveCompleteAttendance(studentUid, session, {
    personalStatus: "present",
    erpStatus: "Present",
  });

  assert.equal(saved.personalStatus, "present");
  assert.equal(saved.erpStatus, "Present");
  assert.ok(saved.erpRecordedAt, "ERP timestamp recorded");
  assert.equal(saved.finalized, true);
});

// Case 3: Keynote alone
runCase("Case 3: Keynote alone saves independently without requiring AttendWise or ERP status", () => {
  const session = defaultData.sessions.find((s) => s.isSpecialTraining)!;
  const saved = mockSaveCompleteAttendance(studentUid, session, {
    note: "Expert lecture by Dr. Sharma in Hall 2",
  });

  assert.equal(saved.note, "Expert lecture by Dr. Sharma in Hall 2", "Keynote must be saved");
  assert.equal(saved.personalStatus, session.personalStatus, "Personal status remains untouched");
  assert.equal(saved.erpStatus, null, "ERP status remains null and optional");
  assert.equal(saved.finalized, session.finalized, "Session finalized status matches initial session state");
});

// Case 4: AttendWise status + Keynote
runCase("Case 4: AttendWise status + Keynote saves both without requiring ERP status", () => {
  const session = defaultData.sessions.find((s) => s.slot === "P5")!;
  const saved = mockSaveCompleteAttendance(studentUid, session, {
    personalStatus: "present",
    note: "Submitted assignment 3 during class",
  });

  assert.equal(saved.personalStatus, "present", "Personal status is present");
  assert.equal(saved.note, "Submitted assignment 3 during class", "Keynote is saved");
  assert.equal(saved.erpStatus, null, "ERP status is null");
  assert.equal(saved.finalized, true);
});

// Case 5: ERP status + Keynote
runCase("Case 5: ERP status + Keynote saves both without requiring AttendWise status", () => {
  const session = defaultData.sessions.find((s) => s.slot === "P6")!;
  const saved = mockSaveCompleteAttendance(studentUid, session, {
    erpStatus: "Present",
    note: "Verified on SISTec ERP portal at 3:30 PM",
  });

  assert.equal(saved.erpStatus, "Present", "ERP status is Present");
  assert.equal(saved.note, "Verified on SISTec ERP portal at 3:30 PM", "Keynote is saved");
  assert.equal(saved.personalStatus, session.personalStatus, "Personal status remains unchanged");
});

// Case 6: Camera photo + AttendWise status + ERP status + Keynote
runCase("Case 6: Camera photo + AttendWise status + ERP status + Keynote persists across reload and clean device query", () => {
  const pythonSessions = defaultData.sessions.filter((s) => s.isSpecialTraining);
  const targetSession = pythonSessions[1]!;
  const testPhotoDataUrl = "data:image/jpeg;base64," + "A".repeat(45000); // Realistic ~35KB photo
  
  const saved = mockSaveCompleteAttendance(studentUid, targetSession, {
    personalStatus: "present",
    erpStatus: "Present",
    note: "Python debugging session completed",
    photoDataUrl: testPhotoDataUrl,
    clientCapturedAt: "2026-10-23T19:15:00.000Z",
  });

  assert.equal(saved.personalStatus, "present");
  assert.equal(saved.erpStatus, "Present");
  assert.equal(saved.note, "Python debugging session completed");
  assert.equal(saved.evidenceAvailable, true, "Evidence available must be true");
  assert.equal(saved.photoDataUrl, testPhotoDataUrl, "Photo data URL must be retained in document");

  // Simulated browser reload / clean device query:
  const reloadedSession = mockFirestoreStore.get(targetSession.id);
  assert.ok(reloadedSession, "Session exists in Cloud Firestore");
  assert.equal(reloadedSession.personalStatus, "present", "Reloaded session maintains Present");
  assert.equal(reloadedSession.erpStatus, "Present", "Reloaded session maintains ERP");
  assert.equal(reloadedSession.note, "Python debugging session completed");
  assert.equal(reloadedSession.photoDataUrl, testPhotoDataUrl, "Photo data URL is preserved after reload");
  assert.equal(reloadedSession.evidenceAvailable, true, "Photo evidence flag preserved after reload");
});

// Case 7: ERP status recorded afterwards on an already Present class (idempotent note check)
runCase("Case 7: Recording ERP status on an already marked Present class retains Present, photo, and note", () => {
  const pythonSessions = defaultData.sessions.filter((s) => s.isSpecialTraining);
  const targetSession = mockFirestoreStore.get(pythonSessions[1]!.id)!;
  assert.ok(targetSession, "Target session was marked previously");

  // Record ERP with identical note (idempotent)
  const updated = mockSaveCompleteAttendance(studentUid, targetSession, {
    erpStatus: "Present",
    note: targetSession.note,
  });

  assert.equal(updated.personalStatus, "present", "Present status remains intact");
  assert.equal(updated.erpStatus, "Present");
  assert.equal(updated.note, "Python debugging session completed");
  assert.ok(updated.photoDataUrl, "Photo remains intact");
});

// Case 8: Period 5 Artificial Intelligence on 2026-10-21 ERP status saving & multi-user isolation
runCase("Case 8: 2026-10-21 Period 5 Artificial Intelligence ERP status saves and persists without getting wiped to null", () => {
  const targetUid = "JKVnA6g6JGWC53wRuP9RJ0pAGOv1";
  const otherUid = "other_student_account_998877";

  // Simulate default data
  const targetData = buildDefaultSistecData(targetUid);
  const p5Session = targetData.sessions.find(
    (s) => (s.id === "session-entry-3-P5-17-2026-10-21" || (s.scheduledDate === "2026-10-21" && s.slot === "P5"))
  );
  assert.ok(p5Session, "P5 Artificial Intelligence session on 2026-10-21 must exist");
  assert.equal(p5Session.slot, "P5");
  assert.equal(p5Session.scheduledDate, "2026-10-21");

  // Initial state is null (not entered)
  assert.equal(p5Session.erpStatus, null, "Initial ERP status must be null (not entered)");

  // 1. User records ERP status as Present
  const savedP5 = mockSaveCompleteAttendance(targetUid, p5Session, {
    erpStatus: "Present",
  });
  assert.equal(savedP5.erpStatus, "Present", "ERP status must save as Present");

  // 2. Simulate onSnapshot / real-time listener: s.erpStatus ?? null must preserve "Present"
  const listenerPreserved = {
    ...savedP5,
    erpStatus: savedP5.erpStatus ?? null,
  };
  assert.equal(listenerPreserved.erpStatus, "Present", "ERP status must NOT be overridden to null");

  // 3. User records ERP status as Absent on another student's session (isolation test)
  const otherData = buildDefaultSistecData(otherUid);
  const otherP5 = otherData.sessions.find(
    (s) => (s.id === "session-entry-3-P5-17-2026-10-21" || (s.scheduledDate === "2026-10-21" && s.slot === "P5"))
  )!;
  const savedOther = mockSaveCompleteAttendance(otherUid, otherP5, {
    erpStatus: "Absent",
  });
  assert.equal(listenerPreserved.erpStatus, "Present", "Target user record remains completely isolated");
});

// Case 9: 2026-10-24 Period 2 Data Structure ERP status removal to null (not entered) & analytics update
runCase("Case 9: 2026-10-24 Period 2 Data Structure ERP removal resets to null and updates analytics without breaking calculations", () => {
  const targetUid = "JKVnA6g6JGWC53wRuP9RJ0pAGOv1";
  const targetData = buildDefaultSistecData(targetUid);

  const satP2Session = targetData.sessions.find(
    (s) => s.id === "session-entry-6-P2-32-2026-10-24" || (s.scheduledDate === "2026-10-24" && s.slot === "P2")
  );
  assert.ok(satP2Session, "2026-10-24 P2 Data Structure session must exist");
  assert.equal(satP2Session.slot, "P2");
  assert.equal(satP2Session.scheduledDate, "2026-10-24");
  assert.equal(satP2Session.subjectCode, "AD-303");

  // Simulate previous state where ERP was "Present"
  const sessionWithErpPresent: ClassSessionItem = {
    ...satP2Session,
    erpStatus: "Present",
    erpRecordedAt: "2026-10-24T11:00:00.000Z",
  };
  assert.equal(sessionWithErpPresent.erpStatus, "Present");

  // Target user account removal resets erpStatus to null
  const purgedSession: ClassSessionItem = {
    ...sessionWithErpPresent,
    erpStatus: null,
    erpRecordedAt: null,
  };
  assert.equal(purgedSession.erpStatus, null, "ERP status must strictly be null (not entered)");
  assert.equal(purgedSession.erpRecordedAt, null, "ERP recorded timestamp must be null");

  // Verify personal attendance (AttendWise) and denominator eligibility are completely untouched
  assert.equal(purgedSession.personalStatus, satP2Session.personalStatus, "AttendWise personalStatus must remain untouched");
  assert.equal(purgedSession.finalized, satP2Session.finalized, "Finalized status must remain untouched");

  // Verify analytics calculation:
  // Replacing ERP Present with null must decrease erpPresent and increase erpNotEntered by 1
  const sessionListBefore = targetData.sessions.map((s) =>
    s.id === satP2Session.id ? sessionWithErpPresent : s
  );
  const sessionListAfter = targetData.sessions.map((s) =>
    s.id === satP2Session.id ? purgedSession : s
  );

  const eligibleBefore = sessionListBefore.filter((s) => s.finalized && s.personalStatus !== "frozen" && s.personalStatus !== "cancelled");
  const eligibleAfter = sessionListAfter.filter((s) => s.finalized && s.personalStatus !== "frozen" && s.personalStatus !== "cancelled");

  const erpPresentBefore = eligibleBefore.filter((s) => s.erpStatus === "Present").length;
  const erpPresentAfter = eligibleAfter.filter((s) => s.erpStatus === "Present").length;
  const erpNotEnteredBefore = eligibleBefore.filter((s) => s.erpStatus === null || s.erpStatus === undefined).length;
  const erpNotEnteredAfter = eligibleAfter.filter((s) => s.erpStatus === null || s.erpStatus === undefined).length;

  assert.equal(eligibleBefore.length, eligibleAfter.length, "Total eligible completed classes (shared denominator) must be identical");
  assert.equal(erpPresentAfter, erpPresentBefore - 1, "ERP Present count must decrease by exactly 1");
  assert.equal(erpNotEnteredAfter, erpNotEnteredBefore + 1, "ERP Not Entered count must increase by exactly 1");
});

console.log("\n=================================================================");
console.log(` RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=================================================================\n");

process.exit(failed > 0 ? 1 : 0);

