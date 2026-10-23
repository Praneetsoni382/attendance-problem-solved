import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  getDocFromServer,
  runTransaction,
  setLogLevel,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
} from "firebase/storage";
import firebaseConfig from "../../../../firebase-applet-config.json";
import {
  SISTEC_METADATA,
  SISTEC_SUBJECTS,
  SISTEC_TIMETABLE_SLOTS,
  SISTEC_TIME_SLOTS,
  PYTHON_TRAINING_SUBJECT,
  PYTHON_TRAINING_DATES,
} from "../data/sistec-timetable";
import {
  isTeachingDay,
  getTeachingDayNumber,
  getHolidayInfo,
  getCalendarDayInfo,
  SISTEC_OFFICIAL_HOLIDAYS,
  SISTEC_CALENDAR_SUMMARY,
  BTECH_3RD_TEACHING_DAYS,
} from "../data/sistec-calendar";

// Suppress benign internal SDK multi-tab lease-loss messages caught internally by Firestore
setLogLevel("silent");
if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Failed to obtain primary lease for action 'Release target'")
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

// Initialize Firebase with IndexedDB persistent local cache to prevent quota exhaustion
const app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Auth local persistence notice:", err);
});
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    ignoreUndefinedProperties: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const storage = getStorage(app, firebaseConfig.storageBucket);
export { ref, uploadString, getDownloadURL };
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Types
export interface StudentProfile {
  id: string;
  displayName: string;
  email: string;
  timezone: string;
  attendanceTarget: number;
  institution?: string;
  course?: string;
  createdAt: string;
}

export interface SubjectItem {
  id: string;
  studentId: string;
  code: string;
  name: string;
  category: "Theory" | "Practical";
  teacherName?: string | null;
  iconKey?: string;
  reviewNeeded?: boolean;
  notes?: string;
  isSpecialTraining?: boolean;
  totalScheduledSessions?: number;
  trainingStartDate?: string;
  trainingEndDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableItem {
  id: string;
  studentId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  slot: string;
  dayOfWeek: number; // 1 = Mon ... 6 = Sat
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  category: "Theory" | "Practical";
  room?: string | null;
  teacherName?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSessionItem {
  id: string;
  studentId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  timetableEntryId: string | null;
  slot?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledStartAt: string; // ISO
  scheduledEndAt: string; // ISO
  category: "Theory" | "Practical";
  room?: string | null;
  personalStatus: "upcoming" | "present" | "absent" | "cancelled" | "frozen" | "unmarked";
  erpStatus: "Present" | "Absent" | null;
  erpRecordedAt?: string | null;
  note?: string | null;
  absentType?: "manual_student" | "automatic_overdue" | null;
  frozenAt?: string | null;
  canMarkPresent?: boolean;
  finalized: boolean;
  finalizedAt?: string | null;
  cancelledAt?: string | null;
  serverReceiptAt?: string | null;
  clientCaptureAt?: string | null;
  evidenceAvailable?: boolean;
  evidenceStoragePath?: string | null;
  photoDataUrl?: string | null;
  academicDayNumber?: number | null;
  isSpecialTraining?: boolean;
  trainingProgram?: string;
  previousPersonalStatus?: string | null;
  previousErpStatus?: string | null;
  createdAt: string;
}

export interface AttendanceEventItem {
  id: string;
  sessionId: string;
  eventType: string;
  serverTimestamp: string;
  message: string;
}

export const TIMEZONE = SISTEC_METADATA.timezone;

// Helpers for IST Dates
const IST_OFFSET_MINUTES = 330;

export function getNowIST(): Date {
  return new Date();
}

export function formatDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getWeekdayIST(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "narrow",
  }).format(date);
  // Using Intl weekday numeric
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
  }).format(date);
  switch (dayName) {
    case "Monday": return 1;
    case "Tuesday": return 2;
    case "Wednesday": return 3;
    case "Thursday": return 4;
    case "Friday": return 5;
    case "Saturday": return 6;
    case "Sunday": return 7;
    default: return 1;
  }
}

export function makeIstDateTime(dateKey: string, timeString: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  if (!year || !month || !day || hours === undefined || minutes === undefined) {
    throw new Error(`Invalid IST date/time: ${dateKey} ${timeString}`);
  }
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes) - IST_OFFSET_MINUTES * 60 * 1000
  );
}

// Authentication Service Functions
export async function signUpStudent(email: string, pass: string, name: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(cred.user, { displayName: name });
  await initializeUserProfile(cred.user, name);
  return cred.user;
}

export async function signInStudent(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  await initializeUserProfile(cred.user, cred.user.displayName || "Student");
  return cred.user;
}

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  await initializeUserProfile(cred.user, cred.user.displayName || "Student");
  return cred.user;
}

export async function resetStudentPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function logOutStudent(): Promise<void> {
  await signOut(auth);
}

// Initialize profile in Firestore
export async function initializeUserProfile(user: User, displayName: string): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
  const userRef = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const profile: StudentProfile = {
        id: user.uid,
        displayName: displayName || user.displayName || "Student",
        email: user.email || "",
        timezone: TIMEZONE,
        attendanceTarget: 75,
        institution: SISTEC_METADATA.institution,
        course: SISTEC_METADATA.course,
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, profile, { merge: true });
    }
  } catch (err) {
    console.warn("Profile init background sync notice (non-fatal):", err);
  }
}

// Ensure any stored P4 timetable entries and class sessions reflect the corrected 12:35 to 1:35 timings
export async function syncTimetableSlotTimings(uid: string): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  try {
    const timetableRef = collection(db, "users", uid, "timetableEntries");
    const timetableSnap = await getDocs(timetableRef);
    const batch = writeBatch(db);
    let updatedCount = 0;

    timetableSnap.forEach((docSnap) => {
      const data = docSnap.data() as TimetableItem;
      const expectedSlot = SISTEC_TIME_SLOTS.find((s) => s.slot === data.slot);
      if (expectedSlot && (data.startTime !== expectedSlot.start || data.endTime !== expectedSlot.end)) {
        batch.update(docSnap.ref, {
          startTime: expectedSlot.start,
          endTime: expectedSlot.end,
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      }
    });

    const sessionsRef = collection(db, "users", uid, "classSessions");
    const sessionsSnap = await getDocs(sessionsRef);
    sessionsSnap.forEach((docSnap) => {
      const data = docSnap.data() as ClassSessionItem;
      const expectedSlot = SISTEC_TIME_SLOTS.find((s) => s.slot === data.slot);
      if (expectedSlot) {
        const expectedStart = makeIstDateTime(data.scheduledDate, expectedSlot.start).toISOString();
        const expectedEnd = makeIstDateTime(data.scheduledDate, expectedSlot.end).toISOString();
        if (data.scheduledStartAt !== expectedStart || data.scheduledEndAt !== expectedEnd) {
          batch.update(docSnap.ref, {
            scheduledStartAt: expectedStart,
            scheduledEndAt: expectedEnd,
          });
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn("Could not sync timetable slot timings:", err);
  }
}

// Ensure Python Training subject and its 66 distinct historical class sessions are seeded
export async function ensurePythonTrainingLoaded(uid: string): Promise<{
  subjectCreated: boolean;
  sessionsCreated: number;
  totalSessions: number;
}> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    return { subjectCreated: false, sessionsCreated: 0, totalSessions: 66 };
  }
  const subjectRef = doc(db, "users", uid, "subjects", PYTHON_TRAINING_SUBJECT.id);
  let subjectCreated = false;
  const nowIso = new Date().toISOString();

  try {
    const subjectSnap = await getDoc(subjectRef);
    if (!subjectSnap.exists()) {
      await setDoc(subjectRef, {
        id: PYTHON_TRAINING_SUBJECT.id,
        studentId: uid,
        code: PYTHON_TRAINING_SUBJECT.code,
        name: PYTHON_TRAINING_SUBJECT.name,
        category: PYTHON_TRAINING_SUBJECT.category,
        teacherName: "Training Faculty",
        iconKey: PYTHON_TRAINING_SUBJECT.iconKey,
        reviewNeeded: false,
        notes: PYTHON_TRAINING_SUBJECT.notes,
        totalScheduledSessions: 66,
        trainingStartDate: "2026-09-07",
        trainingEndDate: "2026-09-21",
        isSpecialTraining: true,
        createdAt: "2026-09-07T00:00:00.000Z",
        updatedAt: nowIso,
      });
      subjectCreated = true;
    }

    const sessionsRef = collection(db, "users", uid, "classSessions");
    const q = query(sessionsRef); // Fetch ALL sessions to clean up stale ones
    const allSessionsSnap = await getDocs(q);
    const existingMap = new Map<string, ClassSessionItem>();
    
    // Use multiple batches to avoid 500 operation limit
    let batch = writeBatch(db);
    let opCount = 0;

    const commitBatch = async () => {
      if (opCount > 0) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const d of allSessionsSnap.docs) {
      const item = d.data() as ClassSessionItem;
      existingMap.set(d.id, item);

      // 1. Purge stale non-training sessions before 2026-09-21
      if (item.scheduledDate < "2026-09-21" && !item.isSpecialTraining && item.subjectId !== PYTHON_TRAINING_SUBJECT.id) {
        batch.delete(d.ref);
        opCount++;
        if (opCount >= 400) await commitBatch();
      }
    }

    // 3. Purge training sessions not in validTrainingIds
    const validTrainingIds = new Set<string>();
    for (const dateKey of PYTHON_TRAINING_DATES) {
      for (const slot of SISTEC_TIME_SLOTS) {
        validTrainingIds.add(`session-python-training-${dateKey}-${slot.slot}`);
      }
    }

    for (const d of allSessionsSnap.docs) {
      const item = d.data() as ClassSessionItem;
      if (item.subjectId === PYTHON_TRAINING_SUBJECT.id && !validTrainingIds.has(item.id)) {
        batch.delete(d.ref);
        opCount++;
        if (opCount >= 400) await commitBatch();
      }
    }

    // 4. Create missing training sessions
    let academicDay = 1;
    let sessionsCreated = 0;
    for (const dateKey of PYTHON_TRAINING_DATES) {
      for (const slot of SISTEC_TIME_SLOTS) {
        const sessionId = `session-python-training-${dateKey}-${slot.slot}`;
        if (!existingMap.has(sessionId)) {
          const sessionDocRef = doc(db, "users", uid, "classSessions", sessionId);
          const startAt = makeIstDateTime(dateKey, slot.start);
          const endAt = makeIstDateTime(dateKey, slot.end);

          batch.set(sessionDocRef, {
            id: sessionId,
            studentId: uid,
            subjectId: PYTHON_TRAINING_SUBJECT.id,
            subjectName: PYTHON_TRAINING_SUBJECT.name,
            subjectCode: PYTHON_TRAINING_SUBJECT.code,
            timetableEntryId: null,
            slot: slot.slot,
            scheduledDate: dateKey,
            scheduledStartAt: startAt.toISOString(),
            scheduledEndAt: endAt.toISOString(),
            category: PYTHON_TRAINING_SUBJECT.category,
            room: "CS Lab / Online",
            personalStatus: "unmarked",
            erpStatus: null,
            note: null,
            canMarkPresent: true,
            finalized: false,
            finalizedAt: null,
            serverReceiptAt: null,
            clientCaptureAt: null,
            cancelledAt: null,
            evidenceAvailable: false,
            academicDayNumber: academicDay,
            isSpecialTraining: true,
            trainingProgram: "Python Training",
            createdAt: nowIso,
          });
          sessionsCreated++;
          opCount++;
          if (opCount >= 400) await commitBatch();
        }
      }
      academicDay++;
    }
    await commitBatch();

    return {
      subjectCreated,
      sessionsCreated,
      totalSessions: existingMap.size + sessionsCreated,
    };
  } catch (err) {
    if (auth.currentUser && auth.currentUser.uid === uid) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/subjects/${PYTHON_TRAINING_SUBJECT.id}`);
    } else {
      console.warn("Firestore python training sync skipped (unauthenticated):", err);
      return { subjectCreated: false, sessionsCreated: 0, totalSessions: 66 };
    }
  }
}

// Load authentic SISTec timetable, subjects, and all sessions directly into Cloud Firestore if not yet seeded
export async function ensureSistecTimetableLoaded(uid: string): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    return;
  }
  try {
    const sessionsRef = collection(db, "users", uid, "classSessions");
    const sessionCheck = await getDocs(query(sessionsRef, limit(1)));
    if (!sessionCheck.empty) {
      // Sessions are already seeded in Cloud Firestore: avoid redundant reads
      return;
    }

    const subjectsRef = collection(db, "users", uid, "subjects");
    const subSnap = await getDocs(query(subjectsRef, limit(1)));
    if (subSnap.empty) {
      const batch = writeBatch(db);
      const subjectMap = new Map<string, SistecSubjectSeed>();

      // 1. Batch create all 12 SISTec Subjects
      for (const sub of SISTEC_SUBJECTS) {
        subjectMap.set(sub.id, sub);
        const subDocRef = doc(db, "users", uid, "subjects", sub.id);
        batch.set(subDocRef, {
          id: sub.id,
          studentId: uid,
          code: sub.code,
          name: sub.name,
          category: sub.category,
          teacherName: null,
          iconKey: sub.iconKey,
          reviewNeeded: sub.reviewNeeded ?? false,
          notes: sub.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. Batch create all 36 SISTec Timetable entries
      let entryIndex = 1;
      for (const slotSeed of SISTEC_TIMETABLE_SLOTS) {
        const sub = subjectMap.get(slotSeed.subjectId);
        const entryId = `entry-${slotSeed.dayOfWeek}-${slotSeed.slot}-${entryIndex++}`;
        const entryDocRef = doc(db, "users", uid, "timetableEntries", entryId);
        batch.set(entryDocRef, {
          id: entryId,
          studentId: uid,
          subjectId: slotSeed.subjectId,
          subjectName: sub?.name ?? "Subject",
          subjectCode: sub?.code ?? "CODE",
          slot: slotSeed.slot,
          dayOfWeek: slotSeed.dayOfWeek,
          startTime: slotSeed.startTime,
          endTime: slotSeed.endTime,
          category: slotSeed.category,
          room: slotSeed.room ?? (slotSeed.category === "Practical" ? "Lab" : "Classroom"),
          teacherName: null,
          active: true,
          sourceId: "sistec-timetable-2026",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();
    }

    // 3. Directly seed all teaching day class sessions in Cloud Firestore
    await generateWeeklySessions(uid);

    // 4. Directly seed all historical Python Training (66 sessions) in Cloud Firestore
    await ensurePythonTrainingLoaded(uid);
  } catch (err) {
    if (auth.currentUser && auth.currentUser.uid === uid) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/classSessions`);
    } else {
      console.warn("Firestore timetable sync skipped (unauthenticated):", err);
    }
  }
}

// Build default authentic SISTec subjects, timetable entries, and sessions
export function buildDefaultSistecData(uid: string): {
  subjects: SubjectItem[];
  timetable: TimetableItem[];
  sessions: ClassSessionItem[];
} {
  const subjectMap = new Map<string, SubjectItem>();
  const subjects: SubjectItem[] = SISTEC_SUBJECTS.map((sub) => {
    const item: SubjectItem = {
      id: sub.id,
      studentId: uid,
      code: sub.code,
      name: sub.name,
      category: sub.category,
      teacherName: null,
      iconKey: sub.iconKey,
      reviewNeeded: sub.reviewNeeded ?? false,
      notes: sub.notes ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    subjectMap.set(sub.id, item);
    return item;
  });

  let entryIndex = 1;
  const timetable: TimetableItem[] = SISTEC_TIMETABLE_SLOTS.map((slotSeed) => {
    const sub = subjectMap.get(slotSeed.subjectId);
    const entryId = `entry-${slotSeed.dayOfWeek}-${slotSeed.slot}-${entryIndex++}`;
    return {
      id: entryId,
      studentId: uid,
      subjectId: slotSeed.subjectId,
      subjectName: sub?.name ?? "Subject",
      subjectCode: sub?.code ?? "CODE",
      slot: slotSeed.slot,
      dayOfWeek: slotSeed.dayOfWeek,
      startTime: slotSeed.startTime,
      endTime: slotSeed.endTime,
      category: slotSeed.category,
      room: slotSeed.room ?? (slotSeed.category === "Practical" ? "Lab" : "Classroom"),
      teacherName: null,
      active: true,
      sourceId: "sistec-timetable-2026",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const now = new Date();
  const sessions: ClassSessionItem[] = [];
  const teachingDateKeys = Object.keys(BTECH_3RD_TEACHING_DAYS);

  for (const dateKey of teachingDateKeys) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y!, m! - 1, d!));
    const weekday = (dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay());
    const academicDay = BTECH_3RD_TEACHING_DAYS[dateKey];
    const matchingEntries = timetable.filter((e) => e.active && e.dayOfWeek === weekday);

    for (const entry of matchingEntries) {
      const sessionId = `session-${entry.id}-${dateKey}`;
      const startAt = makeIstDateTime(dateKey, entry.startTime);
      const endAt = makeIstDateTime(dateKey, entry.endTime);
      const isOverdue = now.getTime() >= endAt.getTime();
      const initialStatus = isOverdue ? "absent" : "upcoming";
      const isFinalized = isOverdue;

      sessions.push({
        id: sessionId,
        studentId: uid,
        subjectId: entry.subjectId,
        subjectName: entry.subjectName,
        subjectCode: entry.subjectCode,
        timetableEntryId: entry.id,
        slot: entry.slot,
        scheduledDate: dateKey,
        scheduledStartAt: startAt.toISOString(),
        scheduledEndAt: endAt.toISOString(),
        category: entry.category,
        room: entry.room ?? null,
        personalStatus: initialStatus,
        erpStatus: null,
        note: null,
        finalized: isFinalized,
        finalizedAt: isFinalized ? endAt.toISOString() : null,
        serverReceiptAt: null,
        clientCaptureAt: null,
        cancelledAt: null,
        evidenceAvailable: false,
        academicDayNumber: academicDay,
        createdAt: now.toISOString(),
      });
    }
  }

  // Add Python Training special subject
  const pythonSubjectItem: SubjectItem = {
    id: PYTHON_TRAINING_SUBJECT.id,
    studentId: uid,
    code: PYTHON_TRAINING_SUBJECT.code,
    name: PYTHON_TRAINING_SUBJECT.name,
    category: PYTHON_TRAINING_SUBJECT.category,
    teacherName: "Training Faculty",
    iconKey: PYTHON_TRAINING_SUBJECT.iconKey,
    reviewNeeded: false,
    notes: PYTHON_TRAINING_SUBJECT.notes,
    totalScheduledSessions: 66,
    trainingStartDate: "2026-09-07",
    trainingEndDate: "2026-09-21",
    isSpecialTraining: true,
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
  };
  subjects.push(pythonSubjectItem);

  // Add exactly 66 historical Python Training class sessions (11 days * 6 periods)
  let pyDayNum = 1;
  for (const dateKey of PYTHON_TRAINING_DATES) {
    for (const slot of SISTEC_TIME_SLOTS) {
      const sessionId = `session-python-training-${dateKey}-${slot.slot}`;
      const startAt = makeIstDateTime(dateKey, slot.start);
      const endAt = makeIstDateTime(dateKey, slot.end);

      sessions.push({
        id: sessionId,
        studentId: uid,
        subjectId: PYTHON_TRAINING_SUBJECT.id,
        subjectName: PYTHON_TRAINING_SUBJECT.name,
        subjectCode: PYTHON_TRAINING_SUBJECT.code,
        timetableEntryId: null,
        slot: slot.slot,
        scheduledDate: dateKey,
        scheduledStartAt: startAt.toISOString(),
        scheduledEndAt: endAt.toISOString(),
        category: PYTHON_TRAINING_SUBJECT.category,
        room: "CS Lab / Online",
        personalStatus: "unmarked",
        erpStatus: null,
        note: null,
        canMarkPresent: true,
        finalized: false,
        finalizedAt: null,
        serverReceiptAt: null,
        clientCaptureAt: null,
        cancelledAt: null,
        evidenceAvailable: false,
        academicDayNumber: pyDayNum,
        isSpecialTraining: true,
        trainingProgram: "Python Training",
        createdAt: "2026-09-07T00:00:00.000Z",
      });
    }
    pyDayNum++;
  }

  // Period 7 Test Class (00:00 to 23:59 IST all-day test window), isolated from the daily timetable
  const todayKey = formatDateKey(now);
  const p7StartAt = makeIstDateTime(todayKey, "00:00");
  const p7EndAt = new Date(makeIstDateTime(todayKey, "23:59").getTime() + 59 * 1000 + 999);
  const p7Overdue = now.getTime() >= p7EndAt.getTime();
  sessions.push({
    id: `session-test-class-p7-${todayKey}`,
    studentId: uid,
    subjectId: "sub-test-class-p7",
    subjectName: "Test Class",
    subjectCode: "TEST-P7",
    timetableEntryId: null,
    slot: "P7",
    scheduledDate: todayKey,
    scheduledStartAt: p7StartAt.toISOString(),
    scheduledEndAt: p7EndAt.toISOString(),
    category: "Theory",
    room: "Online Test Lab",
    personalStatus: p7Overdue ? "absent" : "upcoming",
    erpStatus: null,
    note: null,
    canMarkPresent: !p7Overdue,
    finalized: p7Overdue,
    finalizedAt: p7Overdue ? p7EndAt.toISOString() : null,
    serverReceiptAt: null,
    clientCaptureAt: null,
    cancelledAt: null,
    evidenceAvailable: false,
    academicDayNumber: null,
    createdAt: now.toISOString(),
  });

  return { subjects, timetable, sessions };
}

// Generate active upcoming class sessions strictly according to SISTec Academic Calendar starting from Sept 21, 2026
export async function generateWeeklySessions(uid: string): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  const timetableRef = collection(db, "users", uid, "timetableEntries");
  const sessionsRef = collection(db, "users", uid, "classSessions");

  try {
    const timetableSnap = await getDocs(timetableRef);
    if (timetableSnap.empty) return;

    const entries: TimetableItem[] = [];
    timetableSnap.forEach((d) => entries.push(d.data() as TimetableItem));

    // 1. Purge any accidental sessions that fall on official holidays or non-teaching days,
    // while strictly PROTECTING all Python Training historical sessions!
    const existingSessionsSnap = await getDocs(sessionsRef);
    const existingDateIds = new Set<string>();

    let batch = writeBatch(db);
    let opCount = 0;

    const commitBatch = async () => {
      if (opCount > 0) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const sDoc of existingSessionsSnap.docs) {
      const sData = sDoc.data() as ClassSessionItem;
      existingDateIds.add(sDoc.id);

      if (
        sData.subjectId === PYTHON_TRAINING_SUBJECT.id ||
        (sData as any).isSpecialTraining
      ) {
        continue; // Never delete Python Training sessions
      }

      // Maintain Period 7 test class for extended student application testing
      if (
        sData.slot === "P7" ||
        sData.subjectId === "sub-test-class-p7" ||
        sData.id.startsWith("session-test-class-p7")
      ) {
        continue; // Maintain P7 test class
      }

      if (!isTeachingDay(sData.scheduledDate)) {
        try {
          batch.delete(sDoc.ref);
          opCount++;
          if (opCount >= 400) await commitBatch();
          existingDateIds.delete(sDoc.id);
        } catch {
          // Ignore deletion error
        }
      }
    }
    await commitBatch();

    const now = new Date();
    batch = writeBatch(db);
    opCount = 0;

    const teachingDateKeys = Object.keys(BTECH_3RD_TEACHING_DAYS);

    for (const dateKey of teachingDateKeys) {
      if (!isTeachingDay(dateKey)) continue;
      const [y, m, d] = dateKey.split("-").map(Number);
      const dateObj = new Date(Date.UTC(y!, m! - 1, d!));
      const weekday = (dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay());
      const academicDay = getTeachingDayNumber(dateKey);
      const matchingEntries = entries.filter((e) => e.active && e.dayOfWeek === weekday);

      for (const entry of matchingEntries) {
        const sessionId = `session-${entry.id}-${dateKey}`;
        if (existingDateIds.has(sessionId)) continue;

        const sessionDocRef = doc(db, "users", uid, "classSessions", sessionId);
        const startAt = makeIstDateTime(dateKey, entry.startTime);
        const endAt = makeIstDateTime(dateKey, entry.endTime);

        const isOverdue = now.getTime() >= endAt.getTime();
        const initialStatus = isOverdue ? "absent" : "upcoming";
        const isFinalized = isOverdue;

        batch.set(sessionDocRef, {
          id: sessionId,
          studentId: uid,
          subjectId: entry.subjectId,
          subjectName: entry.subjectName,
          subjectCode: entry.subjectCode,
          timetableEntryId: entry.id,
          slot: entry.slot,
          scheduledDate: dateKey,
          scheduledStartAt: startAt.toISOString(),
          scheduledEndAt: endAt.toISOString(),
          category: entry.category,
          room: entry.room ?? null,
          personalStatus: initialStatus,
          erpStatus: null,
          note: null,
          finalized: isFinalized,
          finalizedAt: isFinalized ? endAt.toISOString() : null,
          serverReceiptAt: null,
          clientCaptureAt: null,
          cancelledAt: null,
          evidenceAvailable: false,
          academicDayNumber: academicDay,
          createdAt: now.toISOString(),
        });
        opCount++;
        if (opCount >= 400) {
          await commitBatch();
        }
      }
    }

    await commitBatch();
  } catch (err) {
    if (auth.currentUser && auth.currentUser.uid === uid) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/classSessions`);
    } else {
      console.warn("Firestore weekly sessions sync skipped (unauthenticated):", err);
    }
  }
}

// Re-export academic calendar helpers
export {
  isTeachingDay,
  getTeachingDayNumber,
  getHolidayInfo,
  getCalendarDayInfo,
  SISTEC_OFFICIAL_HOLIDAYS,
  SISTEC_CALENDAR_SUMMARY,
  BTECH_3RD_TEACHING_DAYS,
};

// Utility to compress base64 images into lightweight thumbnails (<30KB-80KB) that fit safely inside Firestore & IndexedDB
export function compressImageBase64(dataUrl: string, maxDimension = 320, quality = 0.5): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith("data:image")) {
      return resolve(dataUrl ? truncateOrDownscaleBase64(dataUrl) : "");
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      return resolve(truncateOrDownscaleBase64(dataUrl));
    }

    // Safety timeout: Never let image compression hang indefinitely
    const timer = setTimeout(() => {
      resolve(truncateOrDownscaleBase64(dataUrl));
    }, 2500);

    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try {
        let width = img.width || maxDimension;
        let height = img.height || maxDimension;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(truncateOrDownscaleBase64(dataUrl));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let compressed = canvas.toDataURL("image/jpeg", quality);

        // If still over 100KB, re-compress aggressively
        if (compressed.length > 100000) {
          compressed = canvas.toDataURL("image/jpeg", 0.3);
        }

        if (compressed.length > 150000) {
          const canvasSmall = document.createElement("canvas");
          canvasSmall.width = 200;
          canvasSmall.height = Math.round((height * 200) / width) || 150;
          const ctxSmall = canvasSmall.getContext("2d");
          if (ctxSmall) {
            ctxSmall.drawImage(img, 0, 0, canvasSmall.width, canvasSmall.height);
            compressed = canvasSmall.toDataURL("image/jpeg", 0.3);
          }
        }
        resolve(compressed);
      } catch {
        resolve(truncateOrDownscaleBase64(dataUrl));
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(truncateOrDownscaleBase64(dataUrl));
    };
    img.src = dataUrl;
  });
}

function truncateOrDownscaleBase64(dataUrl: string): string {
  if (!dataUrl) return "";
  if (dataUrl.length <= 100000) return dataUrl;
  return dataUrl.slice(0, 100000);
}

// Atomic Complete Attendance & Evidence Saver (Unified Cloud Firestore Transaction)
export interface CompleteAttendancePayload {
  personalStatus?: "present" | "absent" | null;
  erpStatus?: "Present" | "Absent" | null;
  note?: string | null;
  photoDataUrl?: string | null;
  clientCapturedAt?: string | null;
}

export async function saveCompleteAttendanceRecord(
  uid: string,
  sessionId: string,
  payload: CompleteAttendancePayload
): Promise<{ success: boolean; session: ClassSessionItem; message: string }> {
  if (!uid) {
    throw new Error("Student authentication required to record attendance.");
  }

  const receiptAt = new Date().toISOString();
  const captureTimestamp = payload.clientCapturedAt || receiptAt;

  // 1. Photo evidence processing with guaranteed inline compression:
  let compressedPhotoUrl: string | null = null;
  if (payload.photoDataUrl && payload.photoDataUrl.startsWith("data:")) {
    try {
      compressedPhotoUrl = await compressImageBase64(payload.photoDataUrl, 320, 0.5);
    } catch {
      compressedPhotoUrl = truncateOrDownscaleBase64(payload.photoDataUrl);
    }
  } else if (payload.photoDataUrl && payload.photoDataUrl.startsWith("http")) {
    compressedPhotoUrl = payload.photoDataUrl;
  }

  let storageDownloadUrl: string | null = null;
  let storagePath: string | null = null;

  // Attempt Storage upload only if Storage is available; do NOT assign broken storagePath if it fails!
  if (payload.photoDataUrl && payload.photoDataUrl.startsWith("data:")) {
    try {
      const tryPath = `users/${uid}/attendance/${sessionId}/${Date.now()}.jpg`;
      const storageRef = ref(storage, tryPath);
      await uploadString(storageRef, payload.photoDataUrl, "data_url", {
        contentType: "image/jpeg",
        customMetadata: {
          sessionId,
          studentId: uid,
          clientCapturedAt: captureTimestamp,
        },
      });
      storageDownloadUrl = await getDownloadURL(storageRef);
      storagePath = tryPath;
    } catch (storageErr) {
      console.warn("Storage upload notice (falling back to durable inline persistence):", storageErr);
    }
  }

  const sessionRef = doc(db, "users", uid, "classSessions", sessionId);

  const updatedSession = await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    let session: ClassSessionItem;

    if (!sessionSnap.exists()) {
      const defaultData = buildDefaultSistecData(uid);
      const found = defaultData.sessions.find((s) => s.id === sessionId);
      if (!found) {
        throw new Error("Class session not found.");
      }
      session = found;
    } else {
      session = sessionSnap.data() as ClassSessionItem;
    }

    // Strict Permanent Immutability: Present can never be converted to Absent
    if (session.personalStatus === "present" && payload.personalStatus && payload.personalStatus !== "present") {
      throw new Error("Attendance for this class session has already been recorded as Present and is permanently locked.");
    }
    if (session.personalStatus === "frozen" && payload.personalStatus) {
      throw new Error("Cannot mark attendance for a frozen class session.");
    }
    if (session.personalStatus === "cancelled" && payload.personalStatus) {
      throw new Error("Cannot mark attendance for a cancelled class session.");
    }

    const isHistoricalTraining = session.subjectId === PYTHON_TRAINING_SUBJECT.id || (session as any).isSpecialTraining;
    const isP7TestClass = session.slot === "P7" || session.subjectId === "sub-test-class-p7" || session.subjectCode === "TEST-P7";

    // ONLY validate window boundaries when student is actively marking AttendWise Present!
    // Students can save ERP status, Keynotes, or Camera Photos at ANY time independently without being blocked!
    if (!isHistoricalTraining && payload.personalStatus === "present" && session.personalStatus !== "present") {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      if (!isP7TestClass && session.scheduledDate !== today) {
        throw new Error("Attendance can only be marked for today's scheduled classes.");
      }

      const now = Date.now();
      const startMs = new Date(session.scheduledStartAt).getTime();
      const endMs = new Date(session.scheduledEndAt).getTime();

      if (now < startMs) {
        const diffMins = Math.ceil((startMs - now) / 60000);
        throw new Error(`Attendance window has not opened yet. Class begins in ${diffMins} minute(s).`);
      }

      if (now >= endMs) {
        transaction.set(sessionRef, {
          ...session,
          personalStatus: "absent",
          absentType: "automatic_overdue",
          finalized: true,
          finalizedAt: new Date(endMs).toISOString(),
        }, { merge: true });
        throw new Error("Attendance window closed at scheduled end time. The session has been recorded as Absent.");
      }
    }

    // Resolve ERP status locking (independent from AttendWise personal attendance)
    let finalErpStatus: "Present" | "Absent" | null = session.erpStatus ?? null;
    let finalErpRecordedAt: string | null = session.erpRecordedAt ?? null;
    if (payload.erpStatus !== undefined && payload.erpStatus !== null) {
      if (session.erpStatus !== null && session.erpStatus !== undefined && session.erpStatus !== payload.erpStatus) {
        throw new Error(`ERP attendance is already permanently recorded as ${session.erpStatus} and is uneditable.`);
      }
      finalErpStatus = payload.erpStatus;
      finalErpRecordedAt = session.erpRecordedAt || receiptAt;
    }

    // Resolve Keynote / Note (independent from ERP and AttendWise personal attendance)
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

    // Resolve Personal Status (AttendWise attendance)
    const finalPersonalStatus: ClassSessionItem["personalStatus"] =
      payload.personalStatus !== undefined && payload.personalStatus !== null
        ? payload.personalStatus
        : session.personalStatus;

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

    const finalClientCaptureAt = finalPersonalStatus === "present" || compressedPhotoUrl
      ? (captureTimestamp || session.clientCaptureAt || receiptAt)
      : (session.clientCaptureAt ?? null);

    const finalPhotoUrl = compressedPhotoUrl || storageDownloadUrl || session.photoDataUrl || null;
    const finalStoragePath = storagePath || session.evidenceStoragePath || null;
    const hasPhoto = Boolean(finalPhotoUrl || finalStoragePath);

    // Explicitly construct sanitized session object with ZERO undefined properties
    const result: ClassSessionItem = {
      ...session,
      id: sessionId,
      studentId: uid,
      subjectId: session.subjectId,
      subjectName: session.subjectName,
      subjectCode: session.subjectCode,
      timetableEntryId: session.timetableEntryId ?? null,
      slot: session.slot,
      scheduledDate: session.scheduledDate,
      scheduledStartAt: session.scheduledStartAt,
      scheduledEndAt: session.scheduledEndAt,
      category: session.category,
      room: session.room ?? null,
      personalStatus: finalPersonalStatus,
      absentType: finalAbsentType,
      finalized: isFinalized,
      finalizedAt: finalFinalizedAt,
      serverReceiptAt: finalServerReceiptAt,
      clientCaptureAt: finalClientCaptureAt,
      evidenceAvailable: hasPhoto,
      photoDataUrl: finalPhotoUrl,
      evidenceStoragePath: finalStoragePath,
      note: finalNote,
      erpStatus: finalErpStatus,
      erpRecordedAt: finalErpRecordedAt,
      cancelledAt: session.cancelledAt ?? null,
      academicDayNumber: session.academicDayNumber ?? null,
      updatedAt: receiptAt,
    };

    transaction.set(sessionRef, result, { merge: true });

    // Record authoritative audit events only for fields that actually changed
    if (payload.personalStatus && payload.personalStatus !== session.personalStatus) {
      const eventRef = doc(db, "users", uid, "attendanceEvents", `event-${sessionId}-${Date.now()}`);
      transaction.set(eventRef, {
        id: `event-${sessionId}-${Date.now()}`,
        sessionId,
        eventType: payload.personalStatus === "present" ? "attendance_marked_present" : "attendance_marked_absent",
        serverTimestamp: receiptAt,
        message: payload.personalStatus === "present"
          ? `Attendance marked Present with server receipt time.${finalErpStatus ? ` ERP: ${finalErpStatus}.` : ""}`
          : `Attendance marked Absent by student.${finalErpStatus ? ` ERP: ${finalErpStatus}.` : ""}`,
      });
    }

    if (finalErpStatus && (!session.erpStatus || session.erpStatus !== finalErpStatus)) {
      const erpEventRef = doc(db, "users", uid, "attendanceEvents", `event-erp-${sessionId}-${Date.now()}`);
      transaction.set(erpEventRef, {
        id: `event-erp-${sessionId}-${Date.now()}`,
        sessionId,
        eventType: "erp_status_recorded",
        serverTimestamp: receiptAt,
        message: `ERP status recorded as ${finalErpStatus} (Permanent & Uneditable).`,
      });
    }

    if (finalNote && (!session.note || session.note !== finalNote)) {
      const noteEventRef = doc(db, "users", uid, "attendanceEvents", `event-note-${sessionId}-${Date.now()}`);
      transaction.set(noteEventRef, {
        id: `event-note-${sessionId}-${Date.now()}`,
        sessionId,
        eventType: "note_updated",
        serverTimestamp: receiptAt,
        message: `Keynote saved permanently as "${finalNote}" (Immutable & Uneditable).`,
      });
    }

    if (finalPhotoUrl && (!session.photoDataUrl || session.photoDataUrl !== finalPhotoUrl)) {
      const metaRef = doc(db, "users", uid, "evidenceMetadata", `meta-${sessionId}`);
      transaction.set(metaRef, {
        id: `meta-${sessionId}`,
        sessionId,
        dataUrl: finalPhotoUrl,
        storageUrl: storageDownloadUrl || null,
        storagePath: finalStoragePath,
        clientCapturedAt: captureTimestamp,
        uploadedAt: receiptAt,
      });
    }

    return result;
  });

  // 3. Post-write confirmation check to ensure Cloud Firestore document persistence
  try {
    const checkSnap = await getDoc(sessionRef);
    if (checkSnap.exists()) {
      const checkData = checkSnap.data() as ClassSessionItem;
      // If photo was provided in payload but missing on committed server doc, enforce fallback merge set
      if (
        updatedSession.photoDataUrl &&
        (!checkData.photoDataUrl || checkData.photoDataUrl !== updatedSession.photoDataUrl)
      ) {
        await setDoc(
          sessionRef,
          {
            photoDataUrl: updatedSession.photoDataUrl,
            evidenceAvailable: true,
            evidenceStoragePath: updatedSession.evidenceStoragePath || null,
          },
          { merge: true }
        );
      }
    }
  } catch (confirmErr) {
    console.warn("Post-transaction confirmation check notice (write was already committed):", confirmErr);
  }

  return {
    success: true,
    session: updatedSession,
    message: "Attendance record and evidence saved and verified in Cloud Firestore.",
  };
}

// Mark Present inside the exact scheduled window (delegates to atomic complete saver)
export async function markSessionPresent(
  uid: string,
  sessionId: string,
  evidenceDataUrl?: string,
  note?: string,
  clientCapturedAt?: string
): Promise<{ success: boolean; message: string }> {
  const res = await saveCompleteAttendanceRecord(uid, sessionId, {
    personalStatus: "present",
    photoDataUrl: evidenceDataUrl,
    note,
    clientCapturedAt,
  });
  return { success: true, message: res.message };
}

// Resolve evidence download URL durably from session fields, Storage reference, or evidenceMetadata fallback
export async function resolveSessionEvidenceUrl(
  uid: string,
  session: ClassSessionItem
): Promise<string | null> {
  if (session.photoDataUrl && (session.photoDataUrl.startsWith("http") || session.photoDataUrl.startsWith("data:"))) {
    return session.photoDataUrl;
  }
  if (session.evidenceStoragePath) {
    try {
      const storageRef = ref(storage, session.evidenceStoragePath);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (e) {
      console.warn("Storage getDownloadURL notice:", e);
    }
  }
  try {
    const metaSnap = await getDoc(doc(db, "users", uid, "evidenceMetadata", `meta-${session.id}`));
    if (metaSnap.exists()) {
      const data = metaSnap.data();
      if (data?.storageUrl) return data.storageUrl;
      if (data?.dataUrl) return data.dataUrl;
    }
  } catch (e) {
    console.warn("Could not load evidence metadata fallback:", e);
  }
  return null;
}

// Mark Absent manually on the attendance card (finalized and uneditable)
export async function markSessionAbsent(
  uid: string,
  sessionId: string,
  note?: string
): Promise<{ success: boolean; message: string }> {
  const sessionRef = doc(db, "users", uid, "classSessions", sessionId);

  return await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    let session: ClassSessionItem;

    if (!sessionSnap.exists()) {
      const defaultData = buildDefaultSistecData(uid);
      const found = defaultData.sessions.find((s) => s.id === sessionId);
      if (!found) {
        throw new Error("Class session not found.");
      }
      session = found;
    } else {
      session = sessionSnap.data() as ClassSessionItem;
    }

    // Strictly protect Present records from being changed to Absent
    if (session.personalStatus === "present") {
      throw new Error("Attendance for this class session has already been recorded as Present and is permanently locked.");
    }
    if (session.finalized || session.personalStatus === "absent" || session.personalStatus === "frozen") {
      throw new Error("Attendance for this class session is already recorded and is uneditable.");
    }

    const isHistoricalTraining = session.subjectId === PYTHON_TRAINING_SUBJECT.id || (session as any).isSpecialTraining;
    const isP7TestClass = session.slot === "P7" || session.subjectId === "sub-test-class-p7" || session.subjectCode === "TEST-P7";

    if (!isHistoricalTraining && !isP7TestClass) {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      if (session.scheduledDate !== today) {
        throw new Error("Attendance can only be marked for today's scheduled classes.");
      }
    }

    const nowIso = new Date().toISOString();
    const cleanNote = note?.trim() || session.note || null;
    transaction.set(sessionRef, {
      ...session,
      personalStatus: "absent",
      absentType: "manual_student",
      finalized: true,
      finalizedAt: nowIso,
      note: cleanNote,
    }, { merge: true });

    const eventRef = doc(db, "users", uid, "attendanceEvents", `event-absent-${sessionId}-${Date.now()}`);
    transaction.set(eventRef, {
      id: `event-absent-${sessionId}-${Date.now()}`,
      sessionId,
      eventType: isHistoricalTraining ? "training_absent_marked" : "absent_marked_student",
      serverTimestamp: nowIso,
      message: isHistoricalTraining
        ? "Python Training attendance marked Absent by student (Uneditable)."
        : "Attendance marked Absent by student (Uneditable).",
    });

    return { success: true, message: "Attendance marked Absent by student (Uneditable)." };
  });
}

// Record manual observed ERP status (strictly uneditable once entered, available before, during or after class, one time only)
export async function recordSessionErpStatus(
  uid: string,
  sessionId: string,
  status: "Present" | "Absent"
): Promise<void> {
  const sessionRef = doc(db, "users", uid, "classSessions", sessionId);

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    let session: ClassSessionItem;

    if (!sessionSnap.exists()) {
      const defaultData = buildDefaultSistecData(uid);
      const found = defaultData.sessions.find((s) => s.id === sessionId);
      if (!found) {
        throw new Error("Class session not found.");
      }
      session = found;
    } else {
      session = sessionSnap.data() as ClassSessionItem;
    }

    if (session.personalStatus === "cancelled" || session.personalStatus === "frozen") {
      throw new Error("Cannot record ERP status for a cancelled or frozen class.");
    }

    // Once ERP is marked, it should not get entered after that (strictly one time only check)
    if (session.erpStatus !== null && session.erpStatus !== undefined) {
      throw new Error("ERP attendance has already been recorded and is uneditable.");
    }

    const nowIso = new Date().toISOString();
    // ERP status update ONLY - strictly independent from AttendWise personal attendance
    transaction.set(sessionRef, {
      ...session,
      erpStatus: status,
      erpRecordedAt: nowIso,
    }, { merge: true });

    const eventRef = doc(db, "users", uid, "attendanceEvents", `event-erp-${sessionId}-${Date.now()}`);
    transaction.set(eventRef, {
      id: `event-erp-${sessionId}-${Date.now()}`,
      sessionId,
      eventType: "erp_status_recorded",
      serverTimestamp: nowIso,
      message: `ERP status recorded as ${status} (Permanent & Uneditable).`,
    });
  });
}

// Update note / keynote for a class session (strict one-time save, immutable once saved)
export async function updateSessionNote(
  uid: string,
  sessionId: string,
  note: string
): Promise<void> {
  const sessionRef = doc(db, "users", uid, "classSessions", sessionId);

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    let session: ClassSessionItem;

    if (!sessionSnap.exists()) {
      const defaultData = buildDefaultSistecData(uid);
      const found = defaultData.sessions.find((s) => s.id === sessionId);
      if (!found) {
        throw new Error("Class session not found.");
      }
      session = found;
    } else {
      session = sessionSnap.data() as ClassSessionItem;
    }

    // If note is already set to the exact same text, treat as successfully persisted (idempotent)
    if (session.note && session.note.trim() === note.trim()) {
      return;
    }

    if (session.note !== null && session.note !== undefined && session.note.trim() !== "") {
      throw new Error("Keynote/Note has already been saved and is permanently immutable and uneditable.");
    }

    if (!note.trim()) {
      throw new Error("Please enter a valid keynote/note.");
    }

    transaction.set(sessionRef, {
      ...session,
      note: note.trim(),
    }, { merge: true });

    const eventRef = doc(db, "users", uid, "attendanceEvents", `event-note-${sessionId}-${Date.now()}`);
    transaction.set(eventRef, {
      id: `event-note-${sessionId}-${Date.now()}`,
      sessionId,
      eventType: "note_updated",
      serverTimestamp: new Date().toISOString(),
      message: `Keynote saved permanently as "${note.trim()}" (Immutable & Uneditable).`,
    });
  });
}

// Cancel class session
export async function cancelClassSession(uid: string, sessionId: string): Promise<void> {
  const sessionRef = doc(db, "users", uid, "classSessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    throw new Error("Class session not found.");
  }

  const session = sessionSnap.data() as ClassSessionItem;
  if (session.finalized && session.personalStatus !== "upcoming") {
    throw new Error("Finalized sessions cannot be cancelled.");
  }

  const now = new Date().toISOString();
  await updateDoc(sessionRef, {
    personalStatus: "cancelled",
    finalized: true,
    cancelledAt: now,
    finalizedAt: now,
  });

  const eventRef = doc(db, "users", uid, "attendanceEvents", `event-cancel-${sessionId}-${Date.now()}`);
  await setDoc(eventRef, {
    id: `event-cancel-${sessionId}-${Date.now()}`,
    sessionId,
    eventType: "session_cancelled",
    serverTimestamp: now,
    message: "Class session cancelled and excluded from attendance denominators.",
  });
}

// Auto-finalize overdue sessions safely without ever overwriting Present records
export async function finalizeExpiredSessionsForStudent(
  uid: string,
  sessions: ClassSessionItem[]
): Promise<void> {
  const now = Date.now();
  const overdueUpcoming = sessions.filter(
    (s) => !s.finalized && s.personalStatus === "upcoming" && new Date(s.scheduledEndAt).getTime() <= now
  );

  for (const session of overdueUpcoming) {
    try {
      const sessionRef = doc(db, "users", uid, "classSessions", session.id);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(sessionRef);
        if (!snap.exists()) return;
        const currentData = snap.data() as ClassSessionItem;

        // CRITICAL INVARIANT: Never overwrite Present, Frozen, Cancelled, or already finalized records!
        if (
          currentData.personalStatus === "present" ||
          currentData.finalized ||
          currentData.personalStatus === "frozen" ||
          currentData.personalStatus === "cancelled" ||
          currentData.personalStatus === "absent"
        ) {
          return;
        }

        const endMs = new Date(currentData.scheduledEndAt).getTime();
        if (now < endMs) return;

        const finalizedAt = new Date(currentData.scheduledEndAt).toISOString();
        transaction.update(sessionRef, {
          personalStatus: "absent",
          absentType: "automatic_overdue",
          finalized: true,
          finalizedAt,
        });

        const eventRef = doc(db, "users", uid, "attendanceEvents", `event-fin-${session.id}-${Date.now()}`);
        transaction.set(eventRef, {
          id: `event-fin-${session.id}-${Date.now()}`,
          sessionId: session.id,
          eventType: "session_finalized_automatic",
          serverTimestamp: finalizedAt,
          message: "Attendance window closed; automatically recorded as Absent.",
        });
      });
    } catch (e) {
      console.warn("Error finalizing session safely:", session.id, e);
    }
  }
}

import { getCachedStore, setCachedStore } from "./idb-cache";
import { computeFullAnalytics, isSessionEligible } from "./analytics-calculator";

// Freeze class session (excluded from all attendance calculations and denominators)
export async function freezeClassSession(uid: string, sessionId: string): Promise<void> {
  const now = new Date().toISOString();

  // 1. Persist to Firestore if online & authenticated
  if (auth.currentUser && !uid.startsWith("local-")) {
    try {
      const sessionRef = doc(db, "users", uid, "classSessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);
      const prevData = sessionSnap.exists() ? (sessionSnap.data() as ClassSessionItem) : null;
      const prevStatus = prevData?.personalStatus !== "frozen" ? prevData?.personalStatus : "absent";
      const prevErp = prevData?.erpStatus ?? null;

      if (!sessionSnap.exists()) {
        const defaultData = buildDefaultSistecData(uid);
        const found = defaultData.sessions.find((s) => s.id === sessionId);
        const baseSession = found || {
          id: sessionId,
          studentId: uid,
          subjectId: "sub-unknown",
          subjectName: "Subject",
          subjectCode: "CODE",
          timetableEntryId: null,
          slot: "P1",
          scheduledDate: formatDateKey(new Date()),
          scheduledStartAt: now,
          scheduledEndAt: now,
          category: "Theory",
          personalStatus: "unmarked",
          erpStatus: null,
          finalized: false,
          createdAt: now,
        };

        await setDoc(sessionRef, {
          ...baseSession,
          personalStatus: "frozen",
          finalized: true,
          frozenAt: now,
          finalizedAt: now,
          previousPersonalStatus: prevStatus,
          previousErpStatus: prevErp,
          updatedAt: now,
        });
      } else {
        await setDoc(
          sessionRef,
          {
            personalStatus: "frozen",
            finalized: true,
            frozenAt: now,
            finalizedAt: now,
            previousPersonalStatus: prevStatus,
            previousErpStatus: prevErp,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      const eventRef = doc(db, "users", uid, "attendanceEvents", `event-freeze-${sessionId}-${Date.now()}`);
      await setDoc(eventRef, {
        id: `event-freeze-${sessionId}-${Date.now()}`,
        sessionId,
        eventType: "session_frozen",
        serverTimestamp: now,
        message: "Class session frozen and excluded from all attendance calculations.",
      });
    } catch (e) {
      console.warn("Firestore update error in freezeClassSession:", e);
      if (auth.currentUser && auth.currentUser.uid === uid) {
        handleFirestoreError(e, OperationType.WRITE, `users/${uid}/classSessions/${sessionId}`);
      }
    }
  }

  // 2. Always persist to IndexedDB local cache so it survives refreshes & offline
  try {
    const cachedSessions = await getCachedStore<ClassSessionItem>("sessions");
    if (cachedSessions && cachedSessions.length > 0) {
      const updated = cachedSessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              personalStatus: "frozen" as const,
              finalized: true,
              frozenAt: now,
              finalizedAt: now,
              previousPersonalStatus: s.personalStatus !== "frozen" ? s.personalStatus : "absent",
              previousErpStatus: s.erpStatus ?? null,
            }
          : s
      );
      await setCachedStore("sessions", updated);
    }
  } catch (err) {
    console.warn("IDB cache update error in freezeClassSession:", err);
  }
}

// Unfreeze class session (restores class to eligible calculations with original state preserved)
export async function unfreezeClassSession(uid: string, sessionId: string): Promise<void> {
  const now = new Date().toISOString();

  if (auth.currentUser && !uid.startsWith("local-")) {
    try {
      const sessionRef = doc(db, "users", uid, "classSessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);
      const sessionData = sessionSnap.exists() ? (sessionSnap.data() as ClassSessionItem) : null;

      // Restore to previous personal status, default to absent if class has already passed
      const restoredStatus =
        sessionData?.previousPersonalStatus === "present"
          ? "present"
          : "absent";

      await setDoc(
        sessionRef,
        {
          personalStatus: restoredStatus,
          frozenAt: null,
          finalized: true,
          finalizedAt: sessionData?.finalizedAt || now,
          updatedAt: now,
        },
        { merge: true }
      );

      const eventRef = doc(db, "users", uid, "attendanceEvents", `event-unfreeze-${sessionId}-${Date.now()}`);
      await setDoc(eventRef, {
        id: `event-unfreeze-${sessionId}-${Date.now()}`,
        sessionId,
        eventType: "session_unfrozen",
        serverTimestamp: now,
        message: `Class session unfrozen and restored to calculations as ${restoredStatus}.`,
      });
    } catch (e) {
      console.warn("Firestore update error in unfreezeClassSession:", e);
      if (auth.currentUser && auth.currentUser.uid === uid) {
        handleFirestoreError(e, OperationType.WRITE, `users/${uid}/classSessions/${sessionId}`);
      }
    }
  }

  try {
    const cachedSessions = await getCachedStore<ClassSessionItem>("sessions");
    if (cachedSessions && cachedSessions.length > 0) {
      const updated = cachedSessions.map((s) => {
        if (s.id !== sessionId) return s;
        const restoredStatus =
          (s as any).previousPersonalStatus === "present" ? "present" : "absent";
        return {
          ...s,
          personalStatus: restoredStatus as any,
          frozenAt: null,
          finalized: true,
        };
      });
      await setCachedStore("sessions", updated);
    }
  } catch (err) {
    console.warn("IDB cache update error in unfreezeClassSession:", err);
  }
}

// Attendance calculations adhering strictly to Part 4, 5, 6, 7 & 10:
// Both AttendWise and ERP percentage use the IDENTICAL shared denominator (total eligible completed unfrozen classes).
// Zero denominator returns null (displays N/A).
export function computeAttendanceStats(sessions: ClassSessionItem[]) {
  const full = computeFullAnalytics(sessions);

  return {
    overall: full.overall,
    theory: full.theory.attendwise,
    practical: full.practical.attendwise,
    erp: full.erp,
    erpNotEnteredCount: full.erp.notEnteredCount,
    matchCount: full.comparison.matchingCount,
    discrepancyCount: full.comparison.discrepancyCount,
    frozenCount: full.overview.frozenCount,
    cancelledCount: full.overview.cancelledCount,
    totalFinalized: full.overview.totalEligibleCompleted,
    upcomingCount: full.overview.upcomingCount,
    full,
  };
}
export async function uploadSessionPhoto(
  uid: string,
  sessionId: string,
  photoDataUrl: string
): Promise<string> {
  const storageRef = ref(storage, `users/${uid}/attendance/${sessionId}/${Date.now()}.jpg`);
  await uploadString(storageRef, photoDataUrl, "data_url");
  return await getDownloadURL(storageRef);
}

// Synchronize class sessions when a calendar date override is updated
export function syncSessionsForDate(dateKey: string, isWorking: boolean) {
  try {
    const rawSessions = localStorage.getItem("sistec_class_sessions");
    let sessions: ClassSessionItem[] = rawSessions ? JSON.parse(rawSessions) : [];

    if (!isWorking) {
      // Strictly protect Present and finalized sessions from ever being deleted
      sessions = sessions.filter((s) => s.scheduledDate !== dateKey || s.personalStatus === "present" || s.finalized);
    } else {
      const existing = sessions.filter((s) => s.scheduledDate === dateKey);
      if (existing.length === 0) {
        const rawTimetable = localStorage.getItem("sistec_timetable");
        const timetable: TimetableItem[] = rawTimetable ? JSON.parse(rawTimetable) : [];
        const [y, m, d] = dateKey.split("-").map(Number);
        const dateObj = new Date(Date.UTC(y!, m! - 1, d!));
        const weekday = (dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay());
        const matchingEntries = timetable.filter((e) => e.active && e.dayOfWeek === weekday);
        const now = new Date();

        for (const entry of matchingEntries) {
          const sessionId = `session-${entry.id}-${dateKey}`;
          const startAt = makeIstDateTime(dateKey, entry.startTime);
          const endAt = makeIstDateTime(dateKey, entry.endTime);
          const isOverdue = now.getTime() >= endAt.getTime();
          sessions.push({
            id: sessionId,
            studentId: entry.studentId,
            subjectId: entry.subjectId,
            subjectName: entry.subjectName,
            subjectCode: entry.subjectCode,
            timetableEntryId: entry.id,
            slot: entry.slot,
            scheduledDate: dateKey,
            scheduledStartAt: startAt.toISOString(),
            scheduledEndAt: endAt.toISOString(),
            category: entry.category,
            room: entry.room ?? null,
            personalStatus: isOverdue ? "absent" : "upcoming",
            erpStatus: null,
            note: null,
            finalized: isOverdue,
            finalizedAt: isOverdue ? endAt.toISOString() : null,
            serverReceiptAt: null,
            clientCaptureAt: null,
            cancelledAt: null,
            evidenceAvailable: false,
            academicDayNumber: 99,
          });
        }
      }
    }
    localStorage.setItem("sistec_class_sessions", JSON.stringify(sessions));
    window.dispatchEvent(new Event("sistec-sessions-updated"));
  } catch (err) {
    console.error("Error syncing sessions for date:", err);
  }
}

