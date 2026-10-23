import {
  signUpStudent,
  signInStudent,
  logOutStudent,
  saveCompleteAttendanceRecord,
  recordSessionErpStatus,
  updateSessionNote,
  freezeClassSession,
  buildDefaultSistecData,
  auth,
  db,
} from "../artifacts/attendwise/src/lib/firebase";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";

async function runReproduction() {
  console.log("=== REPRODUCING BUGS WITH REAL FIREBASE ===");
  const email = `test_repro_${Date.now()}@sistec.ac.in`;
  const password = "TestPassword123!";
  const user = await signUpStudent(email, password, "Repro Student");
  console.log("Created user:", user.uid);

  const defaultData = buildDefaultSistecData(user.uid);
  const p7Session = defaultData.sessions.find((s) => s.slot === "P7")!;
  console.log("P7 session ID:", p7Session.id);

  // --- TEST FREEZING BUG ---
  console.log("\n--- TEST B1: Freezing with NO inputs ---");
  const session1 = defaultData.sessions.find((s) => s.slot === "P1")!;
  try {
    await freezeClassSession(user.uid, session1.id);
    const snap1 = await getDocFromServer(doc(db, "users", user.uid, "classSessions", session1.id));
    console.log("Freeze empty session result:", snap1.exists() ? snap1.data()?.personalStatus : "DOES NOT EXIST");
  } catch (err: any) {
    console.error("Freeze empty session failed:", err.message);
  }

  console.log("\n--- TEST B2: Mark Present THEN attempt to Freeze ---");
  const session2 = defaultData.sessions.find((s) => s.slot === "P2")!;
  try {
    // Mark Present on P7 or P2
    await saveCompleteAttendanceRecord(user.uid, p7Session.id, {
      personalStatus: "present",
      note: "Present note",
    });
    console.log("Saved Present on P7");
    const snapBeforeFreeze = await getDocFromServer(doc(db, "users", user.uid, "classSessions", p7Session.id));
    console.log("P7 before freeze:", snapBeforeFreeze.data()?.personalStatus);

    console.log("Now freezing P7...");
    await freezeClassSession(user.uid, p7Session.id);
    const snapAfterFreeze = await getDocFromServer(doc(db, "users", user.uid, "classSessions", p7Session.id));
    console.log("P7 after freeze:", snapAfterFreeze.data()?.personalStatus, "isFrozen/frozenAt:", snapAfterFreeze.data()?.frozenAt);
  } catch (err: any) {
    console.error("Freeze after Present error:", err);
  }

  console.log("\n--- TEST B3: ERP Status THEN attempt to Freeze ---");
  const session3 = defaultData.sessions.find((s) => s.slot === "P3")!;
  try {
    await recordSessionErpStatus(user.uid, session3.id, "Present");
    console.log("Saved ERP Present on P3");
    await freezeClassSession(user.uid, session3.id);
    const snap3 = await getDocFromServer(doc(db, "users", user.uid, "classSessions", session3.id));
    console.log("P3 after freeze:", snap3.data()?.personalStatus, "erpStatus:", snap3.data()?.erpStatus);
  } catch (err: any) {
    console.error("Freeze after ERP error:", err);
  }

  console.log("\n--- TEST A1: Camera Photo Only ---");
  const session4 = defaultData.sessions.find((s) => s.slot === "P4")!;
  try {
    const photoBase64 = "data:image/jpeg;base64," + "B".repeat(1000);
    const res = await saveCompleteAttendanceRecord(user.uid, session4.id, {
      photoDataUrl: photoBase64,
      clientCapturedAt: new Date().toISOString(),
    });
    console.log("Camera only saved. Result:", res.session.personalStatus, "photoUrl length:", res.session.photoDataUrl?.length, "evidenceAvailable:", res.session.evidenceAvailable);

    const snap4 = await getDocFromServer(doc(db, "users", user.uid, "classSessions", session4.id));
    console.log("Camera only in Firestore:", snap4.data()?.personalStatus, "evidenceAvailable:", snap4.data()?.evidenceAvailable, "photoDataUrl length:", snap4.data()?.photoDataUrl?.length);
  } catch (err: any) {
    console.error("Camera only error:", err);
  }
}

runReproduction().then(() => process.exit(0)).catch((e) => {
  console.error("Repro failed:", e);
  process.exit(1);
});
