import {
  signUpStudent,
  signInStudent,
  saveCompleteAttendanceRecord,
  buildDefaultSistecData,
  auth,
} from "../artifacts/attendwise/src/lib/firebase";

async function testCameraSave() {
  console.log("Testing camera save on real Firebase...");
  try {
    const email = `camera_test_${Date.now()}@sistec.ac.in`;
    const password = "TestPassword123!";
    const user = await signUpStudent(email, password, "Camera Test Student");
    console.log("User created:", user.uid);

    const defaultData = buildDefaultSistecData(user.uid);
    const session = defaultData.sessions.find((s) => s.isSpecialTraining)!;

    // Create a 100KB base64 JPEG image payload (typical captured camera snapshot)
    const base64Data = "A".repeat(100000);
    const photoDataUrl = `data:image/jpeg;base64,${base64Data}`;

    console.log("Saving complete attendance with camera photo...");
    const res = await saveCompleteAttendanceRecord(user.uid, session.id, {
      personalStatus: "present",
      erpStatus: "Present",
      note: "Testing camera photo persistence",
      photoDataUrl: photoDataUrl,
      clientCapturedAt: new Date().toISOString(),
    });

    console.log("Save complete result:", {
      success: res.success,
      personalStatus: res.session.personalStatus,
      evidenceAvailable: res.session.evidenceAvailable,
      photoLength: res.session.photoDataUrl?.length,
      storagePath: res.session.evidenceStoragePath,
    });

  } catch (err: any) {
    console.error("CAMERA SAVE ERROR:", err);
  }
}

testCameraSave().then(() => process.exit(0));
