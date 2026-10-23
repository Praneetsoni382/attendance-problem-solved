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
import { doc, getDoc, getDocFromServer } from "firebase/firestore";

async function verifyAll5TestCases() {
  console.log("=== VERIFYING ALL 5 USER TEST CASES WITH REAL CLOUD FIRESTORE ===");

  const email = `test_user_5cases_${Date.now()}@sistec.ac.in`;
  const password = "TestPassword123!";
  const user = await signUpStudent(email, password, "5-Cases Student");
  console.log("Created test user:", user.uid);

  const defaultData = buildDefaultSistecData(user.uid);
  
  // Find 5 distinct active/eligible sessions:
  // p7Session is the P7 all-day test class for today
  // py1, py2, py3, py4 are Python Training special historical sessions (eligible for window marking)
  const pySessions = defaultData.sessions.filter((s) => s.subjectId === "sub-python-training");
  const p7Session = defaultData.sessions.find((s) => s.slot === "P7")!;
  const s1 = pySessions[0]!;
  const s2 = pySessions[1]!;
  const s3 = pySessions[2]!;
  const s4 = pySessions[3]!;
  const s5 = p7Session;

  // Generate a realistic 800KB raw camera canvas capture base64 string
  const generateCameraPhoto = (sizeKb: number) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let str = "";
    for (let i = 0; i < sizeKb * 1024; i++) {
      str += chars[i % chars.length];
    }
    return `data:image/jpeg;base64,${str}`;
  };

  const rawCameraPhoto = generateCameraPhoto(800); // 800KB base64 camera image

  console.log("\n--- Test 1: Capture a camera photo and select AttendWise Present ---");
  const res1 = await saveCompleteAttendanceRecord(user.uid, s1.id, {
    personalStatus: "present",
    photoDataUrl: rawCameraPhoto,
    clientCapturedAt: new Date().toISOString(),
  });
  console.log("Test 1 Result:", {
    success: res1.success,
    personalStatus: res1.session.personalStatus,
    evidenceAvailable: res1.session.evidenceAvailable,
    photoLength: res1.session.photoDataUrl?.length,
  });

  console.log("\n--- Test 2: Capture a camera photo and select AttendWise Present plus ERP Present ---");
  const res2 = await saveCompleteAttendanceRecord(user.uid, s2.id, {
    personalStatus: "present",
    erpStatus: "Present",
    photoDataUrl: rawCameraPhoto,
    clientCapturedAt: new Date().toISOString(),
  });
  console.log("Test 2 Result:", {
    success: res2.success,
    personalStatus: res2.session.personalStatus,
    erpStatus: res2.session.erpStatus,
    evidenceAvailable: res2.session.evidenceAvailable,
    photoLength: res2.session.photoDataUrl?.length,
  });

  console.log("\n--- Test 3: Capture a camera photo and select AttendWise Present, ERP Present, and a keynote ---");
  const res3 = await saveCompleteAttendanceRecord(user.uid, s3.id, {
    personalStatus: "present",
    erpStatus: "Present",
    note: "Faculty conducted quiz during lecture",
    photoDataUrl: rawCameraPhoto,
    clientCapturedAt: new Date().toISOString(),
  });
  console.log("Test 3 Result:", {
    success: res3.success,
    personalStatus: res3.session.personalStatus,
    erpStatus: res3.session.erpStatus,
    note: res3.session.note,
    evidenceAvailable: res3.session.evidenceAvailable,
    photoLength: res3.session.photoDataUrl?.length,
  });

  console.log("\n--- Test 4: Capture a camera photo and select AttendWise Absent ---");
  const res4 = await saveCompleteAttendanceRecord(user.uid, s4.id, {
    personalStatus: "absent",
    photoDataUrl: rawCameraPhoto,
    clientCapturedAt: new Date().toISOString(),
  });
  console.log("Test 4 Result:", {
    success: res4.success,
    personalStatus: res4.session.personalStatus,
    evidenceAvailable: res4.session.evidenceAvailable,
    photoLength: res4.session.photoDataUrl?.length,
  });

  console.log("\n--- Test 5: Repeat a working non-camera attendance test as a control ---");
  const res5 = await saveCompleteAttendanceRecord(user.uid, s5.id, {
    personalStatus: "present",
    erpStatus: "Present",
    note: "Control test without camera photo",
  });
  console.log("Test 5 Control Result:", {
    success: res5.success,
    personalStatus: res5.session.personalStatus,
    erpStatus: res5.session.erpStatus,
    note: res5.session.note,
    evidenceAvailable: res5.session.evidenceAvailable,
    photoLength: res5.session.photoDataUrl?.length ?? 0,
  });

  // --- LOG OUT AND READ BACK FROM FRESH FIRESTORE FETCH (SIMULATING FRESH LOGIN / ANOTHER DEVICE) ---
  console.log("\n=== LOGGING OUT AND FETCHING FROM CLOUD FIRESTORE AS A FRESH SESSION ===");
  await logOutStudent();
  await signInStudent(email, password);

  const checkList = [
    { name: "Test 1 (Camera + AW Present)", id: s1.id },
    { name: "Test 2 (Camera + AW + ERP)", id: s2.id },
    { name: "Test 3 (Camera + AW + ERP + Keynote)", id: s3.id },
    { name: "Test 4 (Camera + AW Absent)", id: s4.id },
    { name: "Test 5 (Non-camera Control)", id: s5.id },
  ];

  for (const item of checkList) {
    const snap = await getDocFromServer(doc(db, "users", user.uid, "classSessions", item.id));
    if (!snap.exists()) {
      console.error(`FAILED: ${item.name} DOES NOT EXIST IN FIRESTORE!`);
    } else {
      const d = snap.data() as ClassSessionItem;
      console.log(`VERIFIED ${item.name}:`, {
        personalStatus: d.personalStatus,
        erpStatus: d.erpStatus,
        note: d.note,
        evidenceAvailable: d.evidenceAvailable,
        photoPresentInFirestore: Boolean(d.photoDataUrl),
        photoLength: d.photoDataUrl?.length || 0,
      });
    }
  }
}

verifyAll5TestCases().then(() => process.exit(0)).catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
