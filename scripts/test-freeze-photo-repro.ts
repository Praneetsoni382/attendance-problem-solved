import assert from "node:assert/strict";
import {
  signUpStudent,
  signInStudent,
  saveCompleteAttendanceRecord,
  buildDefaultSistecData,
  freezeClassSession,
  db,
  auth,
  type ClassSessionItem,
} from "../artifacts/attendwise/src/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

async function testFreezeWithAndWithoutPhoto() {
  console.log("=== REPRODUCING FREEZE BUG: WITHOUT PHOTO VS WITH PHOTO ===");

  const email = `freeze_test_${Date.now()}@sistec.ac.in`;
  const password = "TestPassword123!";
  const user = await signUpStudent(email, password, "Freeze Test Student");
  console.log("User created:", user.uid);

  const defaultData = buildDefaultSistecData(user.uid);
  const pythonSessions = defaultData.sessions.filter((s) => s.isSpecialTraining);
  const sNoPhoto = pythonSessions[0]!;
  const sWithPhoto = pythonSessions[1]!;

  // 1. Freeze class WITHOUT photo
  console.log("\n1. Freezing class WITHOUT photo (session id:", sNoPhoto.id, ")...");
  try {
    await freezeClassSession(user.uid, sNoPhoto.id);
    const snap1 = await getDoc(doc(db, "users", user.uid, "classSessions", sNoPhoto.id));
    console.log("Snap1 exists:", snap1.exists());
    if (snap1.exists()) {
      console.log("Snap1 data:", snap1.data()?.personalStatus, "frozenAt:", snap1.data()?.frozenAt);
    }
    console.log("✓ Freeze WITHOUT photo succeeded!");
  } catch (err) {
    console.error("✗ Freeze WITHOUT photo failed:", err);
  }

  const samplePhoto = "data:image/jpeg;base64," + "C".repeat(15000);

  // Test Case A: Photo alone (unmarked)
  const sPhotoOnly = pythonSessions[2]!;
  console.log("\n--- TEST: Photo alone (no status) ---");
  await saveCompleteAttendanceRecord(user.uid, sPhotoOnly.id, {
    photoDataUrl: samplePhoto,
  });
  try {
    await freezeClassSession(user.uid, sPhotoOnly.id);
    const snap = await getDoc(doc(db, "users", user.uid, "classSessions", sPhotoOnly.id));
    console.log("Photo alone -> Freeze result:", snap.data()?.personalStatus);
  } catch (err: any) {
    console.error("Photo alone -> Freeze failed:", err.message);
  }

  // Test Case B: Photo + Absent
  const sPhotoAbsent = pythonSessions[3]!;
  console.log("\n--- TEST: Photo + Absent ---");
  await saveCompleteAttendanceRecord(user.uid, sPhotoAbsent.id, {
    photoDataUrl: samplePhoto,
    personalStatus: "absent",
  });
  try {
    await freezeClassSession(user.uid, sPhotoAbsent.id);
    const snap = await getDoc(doc(db, "users", user.uid, "classSessions", sPhotoAbsent.id));
    console.log("Photo + Absent -> Freeze result:", snap.data()?.personalStatus);
  } catch (err: any) {
    console.error("Photo + Absent -> Freeze failed:", err.message);
  }

  // Test Case C: Photo + ERP Present
  const sPhotoErp = pythonSessions[4]!;
  console.log("\n--- TEST: Photo + ERP Present ---");
  await saveCompleteAttendanceRecord(user.uid, sPhotoErp.id, {
    photoDataUrl: samplePhoto,
    erpStatus: "Present",
  });
  try {
    await freezeClassSession(user.uid, sPhotoErp.id);
    const snap = await getDoc(doc(db, "users", user.uid, "classSessions", sPhotoErp.id));
    console.log("Photo + ERP Present -> Freeze result:", snap.data()?.personalStatus);
  } catch (err: any) {
    console.error("Photo + ERP Present -> Freeze failed:", err.message);
  }

  // Test Case D: Photo + Present + ERP + Note
  console.log("\n--- TEST: Photo + Present + ERP + Note ---");
  const sFull = pythonSessions[5]!;
  const saveResFull = await saveCompleteAttendanceRecord(user.uid, sFull.id, {
    photoDataUrl: samplePhoto,
    personalStatus: "present",
    erpStatus: "Present",
    note: "All inputs before freeze",
  });
  console.log("Saved full record before freeze:", {
    personalStatus: saveResFull.session.personalStatus,
    erpStatus: saveResFull.session.erpStatus,
    note: saveResFull.session.note,
    evidenceAvailable: saveResFull.session.evidenceAvailable,
    photoLength: saveResFull.session.photoDataUrl?.length,
  });

  console.log("Freezing session sFull...");
  await freezeClassSession(user.uid, sFull.id);
  const snapFull = await getDoc(doc(db, "users", user.uid, "classSessions", sFull.id));
  const frozenData = snapFull.data();
  console.log("Frozen document fields in Firestore:", {
    personalStatus: frozenData?.personalStatus,
    frozenAt: frozenData?.frozenAt,
    previousPersonalStatus: frozenData?.previousPersonalStatus,
    previousErpStatus: frozenData?.previousErpStatus,
    erpStatus: frozenData?.erpStatus,
    note: frozenData?.note,
    evidenceAvailable: frozenData?.evidenceAvailable,
    photoLength: frozenData?.photoDataUrl?.length,
    evidenceStoragePath: frozenData?.evidenceStoragePath,
  });

  assert.equal(frozenData?.personalStatus, "frozen", "personalStatus must be frozen");
  assert.equal(frozenData?.previousPersonalStatus, "present", "previousPersonalStatus must be present");
  assert.equal(frozenData?.previousErpStatus, "Present", "previousErpStatus must be Present");
  assert.equal(frozenData?.erpStatus, "Present", "erpStatus must be preserved");
  assert.equal(frozenData?.note, "All inputs before freeze", "note must be preserved");
  assert.equal(frozenData?.evidenceAvailable, true, "evidenceAvailable must be preserved");
  assert.ok(frozenData?.photoDataUrl, "photoDataUrl must be preserved");
  console.log("✓ All fields (photo, erp, note, audit timestamps) survived freeze perfectly!");
}

testFreezeWithAndWithoutPhoto().then(() => process.exit(0)).catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
