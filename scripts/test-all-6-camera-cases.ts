import {
  signUpStudent,
  signInStudent,
  logOutStudent,
  saveCompleteAttendanceRecord,
  buildDefaultSistecData,
  auth,
  db,
  type ClassSessionItem,
} from "../artifacts/attendwise/src/lib/firebase";
import { doc, getDocFromServer } from "firebase/firestore";

async function testAllCameraCases() {
  console.log("=== TESTING ALL 6 CAMERA COMBINATIONS WITH REAL FIREBASE ===");
  const email = `camera_cases_${Date.now()}@sistec.ac.in`;
  const password = "TestPassword123!";
  const user = await signUpStudent(email, password, "Camera Cases Student");
  console.log("Created user:", user.uid);

  const defaultData = buildDefaultSistecData(user.uid);
  const p7Session = defaultData.sessions.find((s) => s.slot === "P7")!;

  const photoSample = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

  console.log("\n--- Case 1: Camera Photo Only ---");
  const s1 = defaultData.sessions.find((s) => s.slot === "P1")!;
  try {
    const res1 = await saveCompleteAttendanceRecord(user.uid, s1.id, {
      photoDataUrl: photoSample,
      clientCapturedAt: new Date().toISOString(),
    });
    console.log("Case 1 Save result:", {
      personalStatus: res1.session.personalStatus,
      evidenceAvailable: res1.session.evidenceAvailable,
      photoDataUrl: res1.session.photoDataUrl ? "PRESENT" : "MISSING",
    });
  } catch (err: any) {
    console.error("Case 1 error:", err);
  }

  console.log("\n--- Case 2: Camera + AttendWise Status (Present) ---");
  try {
    const res2 = await saveCompleteAttendanceRecord(user.uid, p7Session.id, {
      personalStatus: "present",
      photoDataUrl: photoSample,
      clientCapturedAt: new Date().toISOString(),
    });
    console.log("Case 2 Save result:", {
      personalStatus: res2.session.personalStatus,
      evidenceAvailable: res2.session.evidenceAvailable,
      photoDataUrl: res2.session.photoDataUrl ? "PRESENT" : "MISSING",
    });
  } catch (err: any) {
    console.error("Case 2 error:", err);
  }

  console.log("\n--- Case 3: Camera + AttendWise Status + ERP Status ---");
  const s3 = defaultData.sessions.find((s) => s.slot === "P2")!;
  try {
    const res3 = await saveCompleteAttendanceRecord(user.uid, s3.id, {
      personalStatus: "absent",
      erpStatus: "Present",
      photoDataUrl: photoSample,
      clientCapturedAt: new Date().toISOString(),
    });
    console.log("Case 3 Save result:", {
      personalStatus: res3.session.personalStatus,
      erpStatus: res3.session.erpStatus,
      evidenceAvailable: res3.session.evidenceAvailable,
      photoDataUrl: res3.session.photoDataUrl ? "PRESENT" : "MISSING",
    });
  } catch (err: any) {
    console.error("Case 3 error:", err);
  }

  console.log("\n--- Case 4: Camera + AttendWise Status + Keynote ---");
  const s4 = defaultData.sessions.find((s) => s.slot === "P3")!;
  try {
    const res4 = await saveCompleteAttendanceRecord(user.uid, s4.id, {
      personalStatus: "absent",
      note: "Lab experiment completed",
      photoDataUrl: photoSample,
      clientCapturedAt: new Date().toISOString(),
    });
    console.log("Case 4 Save result:", {
      personalStatus: res4.session.personalStatus,
      note: res4.session.note,
      evidenceAvailable: res4.session.evidenceAvailable,
      photoDataUrl: res4.session.photoDataUrl ? "PRESENT" : "MISSING",
    });
  } catch (err: any) {
    console.error("Case 4 error:", err);
  }

  console.log("\n--- Case 5: Camera + ERP Status + Keynote ---");
  const s5 = defaultData.sessions.find((s) => s.slot === "P5")!;
  try {
    const res5 = await saveCompleteAttendanceRecord(user.uid, s5.id, {
      erpStatus: "Present",
      note: "ERP marked by faculty",
      photoDataUrl: photoSample,
      clientCapturedAt: new Date().toISOString(),
    });
    console.log("Case 5 Save result:", {
      personalStatus: res5.session.personalStatus,
      erpStatus: res5.session.erpStatus,
      note: res5.session.note,
      evidenceAvailable: res5.session.evidenceAvailable,
      photoDataUrl: res5.session.photoDataUrl ? "PRESENT" : "MISSING",
    });
  } catch (err: any) {
    console.error("Case 5 error:", err);
  }

  console.log("\n--- Case 6: Camera + AttendWise Status + ERP Status + Keynote ---");
  const pySession = defaultData.sessions.find((s) => s.subjectId === "sub-python-training")!;
  try {
    const res6 = await saveCompleteAttendanceRecord(user.uid, pySession.id, {
      personalStatus: "present",
      erpStatus: "Present",
      note: "Full attendance all inputs",
      photoDataUrl: photoSample,
      clientCapturedAt: new Date().toISOString(),
    });
    console.log("Case 6 Save result:", {
      personalStatus: res6.session.personalStatus,
      erpStatus: res6.session.erpStatus,
      note: res6.session.note,
      evidenceAvailable: res6.session.evidenceAvailable,
      photoDataUrl: res6.session.photoDataUrl ? "PRESENT" : "MISSING",
    });
  } catch (err: any) {
    console.error("Case 6 error:", err);
  }

  // --- NOW VERIFY PERSISTENCE FROM FRESH FIRESTORE FETCH (CLEAN SLATE) ---
  console.log("\n--- LOGGING OUT AND CHECKING FROM CLEAN FIRESTORE FETCH ---");
  await logOutStudent();
  await signInStudent(email, password);

  const checkSessions = [
    { name: "Case 1 (Photo only)", id: s1.id },
    { name: "Case 2 (Camera + AW Present)", id: p7Session.id },
    { name: "Case 3 (Camera + AW + ERP)", id: s3.id },
    { name: "Case 4 (Camera + AW + Note)", id: s4.id },
    { name: "Case 5 (Camera + ERP + Note)", id: s5.id },
    { name: "Case 6 (Camera + All Inputs)", id: pySession.id },
  ];

  for (const cs of checkSessions) {
    const snap = await getDocFromServer(doc(db, "users", user.uid, "classSessions", cs.id));
    if (!snap.exists()) {
      console.error(`FAILED: ${cs.name} DOES NOT EXIST IN FIRESTORE!`);
    } else {
      const data = snap.data() as ClassSessionItem;
      console.log(`VERIFIED ${cs.name}:`, {
        personalStatus: data.personalStatus,
        erpStatus: data.erpStatus,
        note: data.note,
        evidenceAvailable: data.evidenceAvailable,
        photoDataUrlPresent: Boolean(data.photoDataUrl),
      });
    }
  }
}

testAllCameraCases().then(() => process.exit(0)).catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
