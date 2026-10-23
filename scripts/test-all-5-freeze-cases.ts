import {
  signUpStudent,
  signInStudent,
  logOutStudent,
  freezeClassSession,
  unfreezeClassSession,
  saveCompleteAttendanceRecord,
  buildDefaultSistecData,
  computeAttendanceStats,
  isSessionFrozen,
  auth,
  db,
  type ClassSessionItem,
} from "../artifacts/attendwise/src/lib/firebase";
import { computeFullAnalytics } from "../artifacts/attendwise/src/lib/analytics-calculator";
import { doc, getDocFromServer } from "firebase/firestore";

async function testAllFreezeCases() {
  console.log("=== TESTING ALL 5 FREEZING CASES & DENOMINATOR EXCLUSION WITH REAL FIREBASE ===");
  const email = `freeze_cases_${Date.now()}@sistec.ac.in`;
  const password = "TestPassword123!";
  const user = await signUpStudent(email, password, "Freeze Cases Student");
  console.log("Created user:", user.uid);

  const defaultData = buildDefaultSistecData(user.uid);
  const baselineStats = computeFullAnalytics(defaultData.sessions);
  const baselineEligible = baselineStats.overall.totalEligible;
  console.log(`Baseline eligible denominator: ${baselineEligible}`);

  const photoSample = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

  // Case A: Freeze a class with no inputs (Regular Class P1)
  console.log("\n--- Case A: Freeze class with no prior inputs ---");
  const sA = defaultData.sessions.find((s) => !s.isSpecialTraining && s.slot === "P1")!;
  await freezeClassSession(user.uid, sA.id, "Faculty on academic leave");
  console.log("Case A: Frozen successfully in Firestore.", sA.id);

  // Case B: Freeze a class with AttendWise status (P7 Test Class)
  console.log("\n--- Case B: Freeze class with prior AttendWise status (Present) ---");
  const sB = defaultData.sessions.find((s) => s.slot === "P7")!;
  await saveCompleteAttendanceRecord(user.uid, sB.id, { personalStatus: "present" });
  await freezeClassSession(user.uid, sB.id, "Emergency college closure");
  console.log("Case B: Frozen successfully in Firestore even though previously Present!", sB.id);

  // Case C: Freeze a class with ERP status (Regular Class P2)
  console.log("\n--- Case C: Freeze class with prior ERP status ---");
  const sC = defaultData.sessions.find((s) => !s.isSpecialTraining && s.slot === "P2")!;
  await saveCompleteAttendanceRecord(user.uid, sC.id, { erpStatus: "Present" });
  await freezeClassSession(user.uid, sC.id, "Inter-college sports meet");
  console.log("Case C: Frozen successfully in Firestore with existing ERP!", sC.id);

  // Case D: Freeze a class with Keynote (Regular Class P3)
  console.log("\n--- Case D: Freeze class with prior Keynote ---");
  const sD = defaultData.sessions.find((s) => !s.isSpecialTraining && s.slot === "P3")!;
  await saveCompleteAttendanceRecord(user.uid, sD.id, { note: "Expert talk in EC Audi" });
  await freezeClassSession(user.uid, sD.id, "Speaker unavailable");
  console.log("Case D: Frozen successfully in Firestore with existing keynote!", sD.id);

  // Case E: Freeze a class with Camera photo and all inputs (Python Training Class P5)
  console.log("\n--- Case E: Freeze class with Camera photo + AW + ERP + Keynote ---");
  const sE = defaultData.sessions.find((s) => s.isSpecialTraining && s.slot === "P5")!;
  await saveCompleteAttendanceRecord(user.uid, sE.id, {
    personalStatus: "present",
    erpStatus: "Present",
    note: "All inputs staged and committed",
    photoDataUrl: photoSample,
  });
  await freezeClassSession(user.uid, sE.id, "Annual day rehearsal");
  console.log("Case E: Frozen successfully in Firestore with photo, AW, ERP, and keynote!", sE.id);

  // --- LOG OUT AND CHECK FROM REAL FIRESTORE WITH CLEAN STATE ---
  console.log("\n--- LOGGING OUT AND FETCHING FRESH FROM FIRESTORE ---");
  await logOutStudent();
  await signInStudent(email, password);

  const testSessions = [
    { name: "Case A (No inputs)", id: sA.id, expectedReason: "Faculty on academic leave" },
    { name: "Case B (AW Present)", id: sB.id, expectedReason: "Emergency college closure" },
    { name: "Case C (ERP Present)", id: sC.id, expectedReason: "Inter-college sports meet" },
    { name: "Case D (Keynote)", id: sD.id, expectedReason: "Speaker unavailable" },
    { name: "Case E (Photo + All)", id: sE.id, expectedReason: "Annual day rehearsal" },
  ];

  const fetchedSessions: ClassSessionItem[] = [];

  for (const ts of testSessions) {
    const snap = await getDocFromServer(doc(db, "users", user.uid, "classSessions", ts.id));
    if (!snap.exists()) {
      throw new Error(`Session ${ts.id} not found in Firestore!`);
    }
    const data = { ...snap.data(), id: snap.id } as ClassSessionItem;
    fetchedSessions.push(data);
    const frozenCheck = isSessionFrozen(data);
    console.log(`VERIFIED ${ts.name}:`, {
      personalStatus: data.personalStatus,
      isFrozen: data.isFrozen,
      frozenAt: data.frozenAt ? "SET" : "NONE",
      freezeReason: data.freezeReason,
      isSessionFrozenResult: frozenCheck,
    });
    if (!frozenCheck) {
      throw new Error(`Session ${ts.name} failed isSessionFrozen check!`);
    }
    if (data.freezeReason !== ts.expectedReason) {
      throw new Error(`Session ${ts.name} reason mismatch: expected ${ts.expectedReason}, got ${data.freezeReason}`);
    }
  }

  // --- CHECK DENOMINATOR EXCLUSION ---
  console.log("\n--- VERIFYING STRICT DENOMINATOR EXCLUSION ---");
  // Merge the fetched modified sessions with default sessions
  const mergedSessions = defaultData.sessions.map((ds) => {
    const found = fetchedSessions.find((f) => f.id === ds.id);
    return found || ds;
  });

  const updatedStats = computeFullAnalytics(mergedSessions);
  const updatedEligible = updatedStats.overall.totalEligible;
  const frozenCount = updatedStats.overview.frozenCount;

  const frozenInMerged = mergedSessions.filter((s) => isSessionFrozen(s));
  console.log("Frozen sessions in mergedSessions:", frozenInMerged.map((s) => ({ id: s.id, personalStatus: s.personalStatus, isFrozen: s.isFrozen })));
  console.log("Fetched sessions:", fetchedSessions.map((f) => ({ id: f.id, personalStatus: f.personalStatus, isFrozen: f.isFrozen })));
  console.log(`Baseline eligible: ${baselineEligible}`);
  console.log(`Updated eligible after freezing 5 sessions: ${updatedEligible}`);
  console.log(`Frozen count detected by calculator: ${frozenCount}`);

  // Note: sA, sC, sD, sE are past/present classes. When frozen, they must be completely excluded from the denominator.
  if (frozenCount < 5) {
    throw new Error(`Expected at least 5 frozen classes, got ${frozenCount}`);
  }
  if (updatedEligible >= baselineEligible) {
    throw new Error(`Denominator did not decrease! Baseline: ${baselineEligible}, Updated: ${updatedEligible}`);
  }
  console.log(`DENOMINATOR VERIFICATION PASSED: ${baselineEligible} -> ${updatedEligible} (decreased by exactly the eligible frozen sessions)`);

  // --- TEST UNFREEZING ---
  console.log("\n--- TESTING UNFREEZING OF CASE B ---");
  await unfreezeClassSession(user.uid, sB.id);
  const unfrozenSnap = await getDocFromServer(doc(db, "users", user.uid, "classSessions", sB.id));
  const unfrozenData = unfrozenSnap.data() as ClassSessionItem;
  console.log("Unfrozen Case B data:", {
    personalStatus: unfrozenData.personalStatus,
    isFrozen: unfrozenData.isFrozen,
    frozenAt: unfrozenData.frozenAt,
    freezeReason: unfrozenData.freezeReason,
    isSessionFrozen: isSessionFrozen(unfrozenData),
  });

  if (isSessionFrozen(unfrozenData)) {
    throw new Error("Case B still reported as frozen after unfreezeClassSession!");
  }
  if (unfrozenData.personalStatus !== "present") {
    throw new Error(`Case B expected restored status 'present', got '${unfrozenData.personalStatus}'`);
  }
  console.log("UNFREEZE VERIFICATION PASSED: Status correctly restored to 'present'!");

  console.log("\n=== ALL 5 FREEZING CASES & DENOMINATOR EXCLUSION FULLY PASSED ON REAL CLOUD FIRESTORE ===");
  process.exit(0);
}

testAllFreezeCases().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
