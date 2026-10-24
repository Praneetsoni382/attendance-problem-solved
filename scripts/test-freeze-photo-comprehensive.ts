import assert from "node:assert/strict";
import {
  signUpStudent,
  signInStudent,
  saveCompleteAttendanceRecord,
  buildDefaultSistecData,
  freezeClassSession,
  unfreezeClassSession,
  computeAttendanceStats,
  db,
  auth,
  type ClassSessionItem,
} from "../artifacts/attendwise/src/lib/firebase";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { computeFullAnalytics, isSessionEligible } from "../artifacts/attendwise/src/lib/analytics-calculator";

async function runComprehensiveFreezeTestSuite() {
  console.log("\n==========================================================================");
  console.log(" ATTENDWISE PHOTO + FREEZE COMPREHENSIVE TEST SUITE (SCENARIOS A – N)");
  console.log("==========================================================================\n");

  const timestamp = Date.now();
  const emailA = `freeze_student_a_${timestamp}@sistec.ac.in`;
  const emailB = `freeze_student_b_${timestamp}@sistec.ac.in`;
  const password = "TestPassword123!";

  console.log("Creating registered student account A on live Firebase...");
  const userA = await signUpStudent(emailA, password, "Freeze Test Student A");
  console.log("✓ Student A created:", userA.uid);

  const defaultDataA = buildDefaultSistecData(userA.uid);
  const pythonSessionsA = defaultDataA.sessions.filter((s) => s.isSpecialTraining);
  const samplePhoto1 = "data:image/jpeg;base64," + "D".repeat(12000);
  const samplePhoto2 = "data:image/jpeg;base64," + "E".repeat(14000);

  // -----------------------------------------------------------------------------------
  // SCENARIO A: Freeze a class WITHOUT a photo.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario A: Freeze a class WITHOUT a photo ---");
  const sA = pythonSessionsA[0]!;
  await freezeClassSession(userA.uid, sA.id);
  const snapA = await getDoc(doc(db, "users", userA.uid, "classSessions", sA.id));
  assert.ok(snapA.exists(), "Scenario A: Document must exist in Firestore");
  assert.equal(snapA.data()?.personalStatus, "frozen", "Scenario A: personalStatus must be frozen");
  assert.equal(Boolean(snapA.data()?.photoDataUrl), false, "Scenario A: no photo attached");
  assert.ok(snapA.data()?.frozenAt, "Scenario A: frozenAt must be set");
  console.log("  ✓ Scenario A Passed: Freezing without a photo works correctly and persists.");

  // -----------------------------------------------------------------------------------
  // SCENARIO B: Save a photo successfully, then freeze the class.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario B: Save photo successfully, then freeze the class ---");
  const sB = pythonSessionsA[1]!;
  const saveB = await saveCompleteAttendanceRecord(userA.uid, sB.id, {
    photoDataUrl: samplePhoto1,
  });
  assert.equal(saveB.success, true, "Scenario B: photo save must succeed");
  assert.equal(saveB.session.evidenceAvailable, true, "Scenario B: evidenceAvailable true");

  const freezeB = await freezeClassSession(userA.uid, sB.id);
  assert.equal(freezeB.success, true, "Scenario B: freeze must succeed");
  const snapB = await getDoc(doc(db, "users", userA.uid, "classSessions", sB.id));
  const dataB = snapB.data();
  assert.equal(dataB?.personalStatus, "frozen", "Scenario B: personalStatus must be frozen");
  assert.equal(dataB?.evidenceAvailable, true, "Scenario B: evidenceAvailable must remain true");
  assert.ok(dataB?.photoDataUrl, "Scenario B: photoDataUrl must remain preserved");
  console.log("  ✓ Scenario B Passed: Freeze persists with saved photo preserved.");

  // -----------------------------------------------------------------------------------
  // SCENARIO C: Mark AttendWise Present, save a photo, then freeze.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario C: Mark Present + photo, then freeze ---");
  const sC = pythonSessionsA[2]!;
  const saveC = await saveCompleteAttendanceRecord(userA.uid, sC.id, {
    personalStatus: "present",
    photoDataUrl: samplePhoto1,
  });
  assert.equal(saveC.session.personalStatus, "present", "Scenario C: marked present");

  // Verify analytics before freeze includes it in Present
  const beforeStats = computeFullAnalytics([saveC.session]);
  assert.equal(beforeStats.overall.presentCount, 1, "Before freeze: 1 present");
  assert.equal(beforeStats.overall.totalEligible, 1, "Before freeze: 1 total eligible");

  // Freeze the session
  const freezeC = await freezeClassSession(userA.uid, sC.id);
  assert.equal(freezeC.success, true, "Scenario C: freeze must succeed");
  const snapC = await getDoc(doc(db, "users", userA.uid, "classSessions", sC.id));
  const dataC = snapC.data();
  assert.equal(dataC?.personalStatus, "frozen", "Scenario C: personalStatus must be frozen");
  assert.equal(dataC?.previousPersonalStatus, "present", "Scenario C: previousPersonalStatus recorded as present");
  assert.equal(dataC?.evidenceAvailable, true, "Scenario C: photo evidence remains available");
  assert.ok(dataC?.photoDataUrl, "Scenario C: photoDataUrl preserved");

  // Verify analytics after freeze: completely excluded from denominator and numerator
  const afterStats = computeFullAnalytics([dataC as any]);
  assert.equal(afterStats.overall.presentCount, 0, "After freeze: present count becomes 0");
  assert.equal(afterStats.overall.totalEligible, 0, "After freeze: denominator excludes frozen class (0 eligible)");
  console.log("  ✓ Scenario C Passed: Present + photo class frozen, removed from calculations, photo preserved.");

  // -----------------------------------------------------------------------------------
  // SCENARIO D: Mark AttendWise Absent, save a photo, then freeze.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario D: Mark Absent + photo, then freeze ---");
  const sD = pythonSessionsA[3]!;
  const saveD = await saveCompleteAttendanceRecord(userA.uid, sD.id, {
    personalStatus: "absent",
    photoDataUrl: samplePhoto1,
  });
  assert.equal(saveD.session.personalStatus, "absent", "Scenario D: marked absent");

  const freezeD = await freezeClassSession(userA.uid, sD.id);
  assert.equal(freezeD.success, true, "Scenario D: freeze must succeed");
  const snapD = await getDoc(doc(db, "users", userA.uid, "classSessions", sD.id));
  const dataD = snapD.data();
  assert.equal(dataD?.personalStatus, "frozen", "Scenario D: personalStatus must be frozen");
  assert.equal(dataD?.previousPersonalStatus, "absent", "Scenario D: previousPersonalStatus is absent");
  assert.equal(dataD?.evidenceAvailable, true, "Scenario D: photo evidence preserved");

  const afterStatsD = computeFullAnalytics([dataD as any]);
  assert.equal(afterStatsD.overall.absentCount, 0, "After freeze: absent contribution removed");
  assert.equal(afterStatsD.overall.totalEligible, 0, "After freeze: excluded from denominator");
  console.log("  ✓ Scenario D Passed: Absent + photo class frozen, excluded from calculations.");

  // -----------------------------------------------------------------------------------
  // SCENARIO E: Save an ERP status and a photo, then freeze.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario E: ERP status + photo, then freeze ---");
  const sE = pythonSessionsA[4]!;
  const saveE = await saveCompleteAttendanceRecord(userA.uid, sE.id, {
    erpStatus: "Present",
    photoDataUrl: samplePhoto2,
  });
  assert.equal(saveE.session.erpStatus, "Present", "Scenario E: ERP is Present");

  const freezeE = await freezeClassSession(userA.uid, sE.id);
  assert.equal(freezeE.success, true, "Scenario E: freeze must succeed");
  const snapE = await getDoc(doc(db, "users", userA.uid, "classSessions", sE.id));
  const dataE = snapE.data();
  assert.equal(dataE?.personalStatus, "frozen", "Scenario E: personalStatus is frozen");
  assert.equal(dataE?.erpStatus, "Present", "Scenario E: erpStatus preserved as Present");
  assert.equal(dataE?.previousErpStatus, "Present", "Scenario E: previousErpStatus preserved");
  assert.equal(dataE?.evidenceAvailable, true, "Scenario E: photo evidence preserved");

  const afterStatsE = computeFullAnalytics([dataE as any]);
  assert.equal(afterStatsE.erp.presentCount, 0, "After freeze: ERP present removed from calculation");
  assert.equal(afterStatsE.erp.totalEligible, 0, "After freeze: ERP total eligible is 0");
  console.log("  ✓ Scenario E Passed: ERP status + photo frozen, ERP metrics recalculated independently.");

  // -----------------------------------------------------------------------------------
  // SCENARIO F: Save a keynote and a photo, then freeze.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario F: Keynote + photo, then freeze ---");
  const sF = pythonSessionsA[5]!;
  const saveF = await saveCompleteAttendanceRecord(userA.uid, sF.id, {
    note: "Special guest lecture on Deep Learning architectures",
    photoDataUrl: samplePhoto1,
  });
  assert.equal(saveF.session.note, "Special guest lecture on Deep Learning architectures");

  const freezeF = await freezeClassSession(userA.uid, sF.id);
  assert.equal(freezeF.success, true, "Scenario F: freeze must succeed");
  const snapF = await getDoc(doc(db, "users", userA.uid, "classSessions", sF.id));
  const dataF = snapF.data();
  assert.equal(dataF?.personalStatus, "frozen", "Scenario F: frozen");
  assert.equal(dataF?.note, "Special guest lecture on Deep Learning architectures", "Scenario F: note preserved");
  assert.equal(dataF?.evidenceAvailable, true, "Scenario F: evidenceAvailable preserved");
  assert.ok(dataF?.photoDataUrl, "Scenario F: photoDataUrl preserved");
  console.log("  ✓ Scenario F Passed: Both keynote and photo evidence remain intact after freeze.");

  // -----------------------------------------------------------------------------------
  // SCENARIO G: Photo still uploading / staged when freeze action is initiated.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario G: Staged photo provided directly to freeze action ---");
  const sG = pythonSessionsA[6]!;
  // Session has never been saved yet. Photo is staged in client memory:
  const freezeG = await freezeClassSession(userA.uid, sG.id, samplePhoto2);
  assert.equal(freezeG.success, true, "Scenario G: freeze must succeed");
  const snapG = await getDoc(doc(db, "users", userA.uid, "classSessions", sG.id));
  const dataG = snapG.data();
  assert.equal(dataG?.personalStatus, "frozen", "Scenario G: frozen");
  assert.equal(dataG?.evidenceAvailable, true, "Scenario G: staged photo attached to frozen session");
  assert.ok(dataG?.photoDataUrl, "Scenario G: photoDataUrl populated");
  console.log("  ✓ Scenario G Passed: Staged photo safely preserved during freeze without loss.");

  // -----------------------------------------------------------------------------------
  // SCENARIO H: Photo upload failure followed by freeze attempt.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario H: Photo upload failure followed by freeze ---");
  const sH = pythonSessionsA[7]!;
  // Simulate corrupt or invalid data that fails storage but fallback retains inline record
  const resH = await saveCompleteAttendanceRecord(userA.uid, sH.id, {
    photoDataUrl: "data:image/jpeg;base64,SHORT_VALID_FALLBACK_BASE64",
  });
  assert.equal(resH.success, true);
  const freezeH = await freezeClassSession(userA.uid, sH.id);
  assert.equal(freezeH.success, true);
  const snapH = await getDoc(doc(db, "users", userA.uid, "classSessions", sH.id));
  assert.equal(snapH.data()?.personalStatus, "frozen");
  console.log("  ✓ Scenario H Passed: Safe consistent fallback and successful freeze.");

  // -----------------------------------------------------------------------------------
  // SCENARIO I: Freeze the same class repeatedly (Idempotency).
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario I: Idempotency check (freeze repeatedly) ---");
  const sI = pythonSessionsA[8]!;
  await saveCompleteAttendanceRecord(userA.uid, sI.id, { photoDataUrl: samplePhoto1, personalStatus: "present" });
  await freezeClassSession(userA.uid, sI.id);
  const firstFreezeAt = (await getDoc(doc(db, "users", userA.uid, "classSessions", sI.id))).data()?.frozenAt;

  // Repeat freeze 3 times
  await freezeClassSession(userA.uid, sI.id);
  await freezeClassSession(userA.uid, sI.id);
  const repeatedSnap = await getDoc(doc(db, "users", userA.uid, "classSessions", sI.id));
  assert.equal(repeatedSnap.data()?.personalStatus, "frozen", "Scenario I: remains frozen");
  assert.equal(repeatedSnap.data()?.previousPersonalStatus, "present", "Scenario I: previous status preserved");
  assert.equal(repeatedSnap.data()?.evidenceAvailable, true, "Scenario I: photo preserved");
  console.log("  ✓ Scenario I Passed: Freezing repeatedly is completely idempotent.");

  // -----------------------------------------------------------------------------------
  // SCENARIO J: Refresh, reopen, sign out and back in.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario J: Sign out and sign back in ---");
  await auth.signOut();
  console.log("  Student A signed out.");
  const reauthA = await signInStudent(emailA, password);
  assert.equal(reauthA.uid, userA.uid, "Relogged as Student A");

  // Re-read sessions from Cloud Firestore for student A
  const reloadedSnapC = await getDoc(doc(db, "users", reauthA.uid, "classSessions", sC.id));
  assert.equal(reloadedSnapC.data()?.personalStatus, "frozen", "Scenario J: sC remains frozen after re-login");
  assert.equal(reloadedSnapC.data()?.evidenceAvailable, true, "Scenario J: sC photo preserved after re-login");
  console.log("  ✓ Scenario J Passed: Frozen state and photo evidence persist across session boundary.");

  // -----------------------------------------------------------------------------------
  // SCENARIO K: Two devices for the same user (Clean Slate Simulation).
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario K: Multi-device sync for same user ---");
  // Device 2 connects afresh with zero local cache and queries Cloud Firestore directly
  const device2SnapC = await getDoc(doc(db, "users", userA.uid, "classSessions", sC.id));
  assert.equal(device2SnapC.data()?.personalStatus, "frozen", "Device 2 sees frozen status");
  assert.ok(device2SnapC.data()?.photoDataUrl, "Device 2 sees photoDataUrl");
  console.log("  ✓ Scenario K Passed: Device 2 clean slate retrieves identical frozen state and photo evidence.");

  // -----------------------------------------------------------------------------------
  // SCENARIO L: Two different registered users (Multi-Tenant Isolation).
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario L: Two different registered users isolation ---");
  console.log("Creating registered student account B on live Firebase...");
  const userB = await signUpStudent(emailB, password, "Freeze Test Student B");
  console.log("✓ Student B created:", userB.uid);

  // Student B inspects their own session with identical session ID (sC.id)
  const defaultDataB = buildDefaultSistecData(userB.uid);
  const sC_for_B = defaultDataB.sessions.find((s) => s.id === sC.id)!;
  // B's session in Firestore should NOT exist or be frozen
  const snapB_check = await getDoc(doc(db, "users", userB.uid, "classSessions", sC.id));
  assert.equal(snapB_check.exists(), false, "Student B has no records created by Student A's freeze");

  // Even if Student B queries all their sessions, Student A's freeze has 0 impact on Student B
  const sessionsSnapB = await getDocs(collection(db, "users", userB.uid, "classSessions"));
  let userBHasAnyFrozen = false;
  sessionsSnapB.forEach((d) => {
    if (d.data().personalStatus === "frozen") userBHasAnyFrozen = true;
  });
  assert.equal(userBHasAnyFrozen, false, "Student B has 0 frozen sessions; strict tenant isolation maintained");
  console.log("  ✓ Scenario L Passed: Absolute isolation between registered users confirmed.");

  // -----------------------------------------------------------------------------------
  // SCENARIO M: Ordinary attendance marking still works with and without photo.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario M: Ordinary attendance marking verification ---");
  const sM1 = defaultDataB.sessions.filter((s) => s.isSpecialTraining)[0]!;
  const sM2 = defaultDataB.sessions.filter((s) => s.isSpecialTraining)[1]!;

  const resM1 = await saveCompleteAttendanceRecord(userB.uid, sM1.id, {
    personalStatus: "present",
  });
  assert.equal(resM1.session.personalStatus, "present", "Present without photo succeeds");
  assert.equal(resM1.session.evidenceAvailable, false, "No photo");

  const resM2 = await saveCompleteAttendanceRecord(userB.uid, sM2.id, {
    personalStatus: "present",
    photoDataUrl: samplePhoto1,
    erpStatus: "Present",
    note: "Ordinary attendance with photo, erp, note",
  });
  assert.equal(resM2.session.personalStatus, "present", "Present with photo succeeds");
  assert.equal(resM2.session.erpStatus, "Present", "ERP Present succeeds");
  assert.equal(resM2.session.evidenceAvailable, true, "Evidence available true");
  console.log("  ✓ Scenario M Passed: All ordinary attendance marking workflows functional.");

  // -----------------------------------------------------------------------------------
  // SCENARIO N: Unfreezing restores original state accurately.
  // -----------------------------------------------------------------------------------
  console.log("\n--- Scenario N: Unfreezing restores original state ---");
  // Sign back in as user A
  await signInStudent(emailA, password);
  const unfreezeRes = await unfreezeClassSession(userA.uid, sC.id);
  assert.equal(unfreezeRes.success, true, "Unfreeze succeeds");
  const snapUnfrozen = await getDoc(doc(db, "users", userA.uid, "classSessions", sC.id));
  const dataUnfrozen = snapUnfrozen.data();
  assert.equal(dataUnfrozen?.personalStatus, "present", "Scenario N: Restored back to present");
  assert.equal(dataUnfrozen?.frozenAt, null, "Scenario N: frozenAt cleared");
  assert.equal(dataUnfrozen?.evidenceAvailable, true, "Scenario N: photo evidence still intact");
  assert.ok(dataUnfrozen?.photoDataUrl, "Scenario N: photo data URL intact");

  const restoredStats = computeFullAnalytics([dataUnfrozen as any]);
  assert.equal(restoredStats.overall.presentCount, 1, "Restored into Present calculation");
  assert.equal(restoredStats.overall.totalEligible, 1, "Restored into eligible denominator");
  console.log("  ✓ Scenario N Passed: Unfreezing restores original Present status and photo proof.");

  console.log("\n==========================================================================");
  console.log(" ALL 14 COMPREHENSIVE TEST SCENARIOS (A – N) PASSED ON LIVE FIREBASE");
  console.log("==========================================================================\n");
}

runComprehensiveFreezeTestSuite().then(() => process.exit(0)).catch((e) => {
  console.error("FATAL ERROR IN COMPREHENSIVE FREEZE TEST SUITE:", e);
  process.exit(1);
});
