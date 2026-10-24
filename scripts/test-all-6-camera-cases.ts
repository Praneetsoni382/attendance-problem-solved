import assert from "node:assert/strict";
import {
  signUpStudent,
  signInStudent,
  saveCompleteAttendanceRecord,
  buildDefaultSistecData,
  formatDateKey,
  auth,
  type ClassSessionItem,
} from "../artifacts/attendwise/src/lib/firebase";

async function runAll6Cases() {
  console.log("\n=================================================================");
  console.log(" EXHAUSTIVE LIVE FIREBASE TEST SUITE: 6 CAMERA TEST CASES");
  console.log("=================================================================\n");

  const email = `camera_cases_test_${Date.now()}@sistec.ac.in`;
  const password = "TestPassword123!";
  const user = await signUpStudent(email, password, "All 6 Cases Student");
  console.log("✓ Test Student account created on Firebase:", user.uid);

  const defaultData = buildDefaultSistecData(user.uid);
  const todayKey = formatDateKey(new Date());
  const samplePhoto = "data:image/jpeg;base64," + "B".repeat(20000); // Realistic 15KB compressed snapshot

  // Training sessions (historical confirmed classes) and timetable sessions
  const pythonSessions = defaultData.sessions.filter((s) => s.isSpecialTraining);

  const sA = defaultData.sessions.find((s) => s.slot === "P1")!;
  const sB = pythonSessions[0]!;
  const sC = pythonSessions[1]!;
  const sD = pythonSessions[2]!;
  const sE = defaultData.sessions.find((s) => s.slot === "P5")!;
  const sF = pythonSessions[3]!;

  // Case A — Camera photo only
  console.log("\nTesting Case A — Camera photo only...");
  const resA = await saveCompleteAttendanceRecord(user.uid, sA.id, {
    photoDataUrl: samplePhoto,
  });
  assert.equal(resA.session.evidenceAvailable, true, "Case A: evidenceAvailable should be true");
  assert.ok(resA.session.photoDataUrl, "Case A: photoDataUrl should be populated");
  assert.equal(resA.session.personalStatus, sA.personalStatus, "Case A: personalStatus should not change");
  assert.equal(resA.session.erpStatus, null, "Case A: erpStatus remains null");
  console.log("  ✓ Case A passed: Camera photo saved independently without breaking or changing status.");

  // Case B — Camera photo + AttendWise status
  console.log("\nTesting Case B — Camera photo + AttendWise status...");
  const resB = await saveCompleteAttendanceRecord(user.uid, sB.id, {
    personalStatus: "present",
    photoDataUrl: samplePhoto,
  });
  assert.equal(resB.session.personalStatus, "present", "Case B: status is present");
  assert.equal(resB.session.evidenceAvailable, true, "Case B: evidenceAvailable is true");
  assert.ok(resB.session.photoDataUrl, "Case B: photoDataUrl is populated");
  console.log("  ✓ Case B passed: AttendWise status and camera photo saved together.");

  // Case C — Camera photo + AttendWise status + ERP status
  console.log("\nTesting Case C — Camera photo + AttendWise status + ERP status...");
  const resC = await saveCompleteAttendanceRecord(user.uid, sC.id, {
    personalStatus: "present",
    erpStatus: "Present",
    photoDataUrl: samplePhoto,
  });
  assert.equal(resC.session.personalStatus, "present", "Case C: personal status is present");
  assert.equal(resC.session.erpStatus, "Present", "Case C: ERP status is Present");
  assert.equal(resC.session.evidenceAvailable, true, "Case C: evidenceAvailable is true");
  console.log("  ✓ Case C passed: AttendWise status, ERP status, and camera photo saved together.");

  // Case D — Camera photo + AttendWise status + keynote
  console.log("\nTesting Case D — Camera photo + AttendWise status + keynote...");
  const resD = await saveCompleteAttendanceRecord(user.uid, sD.id, {
    personalStatus: "present",
    note: "Submitted Python assignment during training",
    photoDataUrl: samplePhoto,
  });
  assert.equal(resD.session.personalStatus, "present", "Case D: status is present");
  assert.equal(resD.session.note, "Submitted Python assignment during training", "Case D: keynote is saved");
  assert.equal(resD.session.evidenceAvailable, true, "Case D: evidenceAvailable is true");
  console.log("  ✓ Case D passed: AttendWise status, keynote, and camera photo saved together.");

  // Case E — Camera photo + ERP status + keynote
  console.log("\nTesting Case E — Camera photo + ERP status + keynote...");
  const resE = await saveCompleteAttendanceRecord(user.uid, sE.id, {
    erpStatus: "Present",
    note: "Verified on SISTec ERP portal at 2:30 PM",
    photoDataUrl: samplePhoto,
  });
  assert.equal(resE.session.erpStatus, "Present", "Case E: ERP status is Present");
  assert.equal(resE.session.note, "Verified on SISTec ERP portal at 2:30 PM", "Case E: keynote is saved");
  assert.equal(resE.session.evidenceAvailable, true, "Case E: evidenceAvailable is true");
  console.log("  ✓ Case E passed: ERP status, keynote, and camera photo saved without requiring AttendWise status.");

  // Case F — Camera photo + AttendWise status + ERP status + keynote
  console.log("\nTesting Case F — Camera photo + AttendWise status + ERP status + keynote...");
  const resF = await saveCompleteAttendanceRecord(user.uid, sF.id, {
    personalStatus: "present",
    erpStatus: "Present",
    note: "All 4 inputs tested in P7 evening test class",
    photoDataUrl: samplePhoto,
  });
  assert.equal(resF.session.personalStatus, "present", "Case F: personal status is present");
  assert.equal(resF.session.erpStatus, "Present", "Case F: ERP status is Present");
  assert.equal(resF.session.note, "All 4 inputs tested in P7 evening test class", "Case F: keynote is saved");
  assert.equal(resF.session.evidenceAvailable, true, "Case F: evidenceAvailable is true");
  assert.ok(resF.session.photoDataUrl, "Case F: photoDataUrl is populated");
  console.log("  ✓ Case F passed: All 4 inputs saved successfully together into Cloud Firestore.");

  // Re-login Simulation: Log out and log back in
  console.log("\n--- SIMULATING LOGOUT AND RELOGIN ON SAME ACCOUNT ---");
  await auth.signOut();
  console.log("Logged out.");

  const reloggedUser = await signInStudent(email, password);
  console.log("Relogged in as:", reloggedUser.uid);

  // Re-verify Case F record
  const resF_reloaded = await saveCompleteAttendanceRecord(reloggedUser.uid, sF.id, {});
  assert.equal(resF_reloaded.session.personalStatus, "present", "Relogged: Personal status must remain Present");
  assert.equal(resF_reloaded.session.erpStatus, "Present", "Relogged: ERP status must remain Present");
  assert.equal(resF_reloaded.session.note, "All 4 inputs tested in P7 evening test class", "Relogged: Note must remain intact");
  assert.equal(resF_reloaded.session.evidenceAvailable, true, "Relogged: Evidence flag must remain true");
  assert.ok(resF_reloaded.session.photoDataUrl, "Relogged: photoDataUrl must remain populated");
  console.log("✓ Relogin verification successful! Case F state completely preserved across logout and relogin.");

  console.log("\n=================================================================");
  console.log(" ALL 6 CAMERA TEST CASES PASSED SUCCESSFULLY ON FIREBASE");
  console.log("=================================================================\n");
}

runAll6Cases().then(() => process.exit(0)).catch((e) => {
  console.error("FATAL ERROR IN ALL 6 CASES TEST:", e);
  process.exit(1);
});
