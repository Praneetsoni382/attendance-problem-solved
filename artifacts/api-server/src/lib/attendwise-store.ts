import { randomUUID } from "node:crypto";
import type {
  AttendanceEvent,
  AttendanceEventEventType,
  AttendanceMetric,
  ClassSession,
  ComparisonEntry,
  ComparisonStatus,
  ComparisonSummary,
  DashboardSummary,
  DemoSessionResult,
  ErpStatus,
  MarkPresentInput,
  PersonalStatus,
  StudentProfile,
  Subject,
  SubjectAttendance,
  SubjectCategory,
  SubjectInput,
  SubjectUpdate,
  TimetableEntry,
  TimetableInput,
  TimetableUpdate,
  TodayDashboard,
} from "@workspace/api-zod";

export const DEMO_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 330;
const ATTENDANCE_TARGET = 75;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface SessionFilters {
  from?: Date;
  to?: Date;
  subjectId?: string;
  category?: SubjectCategory;
  personalStatus?: PersonalStatus;
  comparisonStatus?: ComparisonStatus;
}

export interface MarkPresentResult {
  session: ClassSession;
  receiptAt: Date;
}

export type StoreErrorCode = "not_found" | "conflict" | "outside_window" | "bad_request";

export class AttendWiseStoreError extends Error {
  constructor(
    public readonly code: StoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AttendWiseStoreError";
  }
}

interface PrivateEvidence {
  dataUrl: string;
  clientCapturedAt: Date | null;
}

interface CategorySeed {
  name: string;
  category: SubjectCategory;
  iconKey: string;
}

interface TimetableSeed {
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
}

const DEMO_STUDENT_ID = "demo-student-praneet";

const profile: StudentProfile = {
  id: DEMO_STUDENT_ID,
  displayName: "Praneet",
  email: "praneet.student@example.edu",
  timezone: DEMO_TIMEZONE,
  attendanceTarget: ATTENDANCE_TARGET,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
};

const subjectSeeds: CategorySeed[] = [
  { name: "Data Structures", category: "Theory", iconKey: "code" },
  { name: "Database Systems", category: "Theory", iconKey: "database" },
  { name: "Operating Systems", category: "Theory", iconKey: "cpu" },
  { name: "Web Development Lab", category: "Practical", iconKey: "monitor" },
  { name: "Computer Networks", category: "Practical", iconKey: "network" },
];

const subjects: Subject[] = subjectSeeds.map((seed, index) => {
  const createdAt = new Date("2026-09-15T04:00:00.000Z");
  return {
    id: `subject-${index + 1}`,
    studentId: DEMO_STUDENT_ID,
    name: seed.name,
    category: seed.category,
    iconKey: seed.iconKey,
    createdAt,
    updatedAt: createdAt,
  };
});

const timetableSeeds: TimetableSeed[] = [
  { subjectId: "subject-1", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", room: "B-204" },
  { subjectId: "subject-3", dayOfWeek: 1, startTime: "11:00", endTime: "12:00", room: "A-108" },
  { subjectId: "subject-2", dayOfWeek: 2, startTime: "10:00", endTime: "11:00", room: "B-102" },
  { subjectId: "subject-4", dayOfWeek: 2, startTime: "13:00", endTime: "14:30", room: "Lab 3" },
  { subjectId: "subject-5", dayOfWeek: 3, startTime: "09:00", endTime: "10:30", room: "Lab 1" },
  { subjectId: "subject-1", dayOfWeek: 3, startTime: "11:00", endTime: "12:00", room: "B-204" },
  { subjectId: "subject-4", dayOfWeek: 4, startTime: "10:30", endTime: "12:00", room: "Lab 3" },
  { subjectId: "subject-2", dayOfWeek: 4, startTime: "13:30", endTime: "14:30", room: "B-102" },
  { subjectId: "subject-3", dayOfWeek: 5, startTime: "09:30", endTime: "10:30", room: "A-108" },
  { subjectId: "subject-5", dayOfWeek: 5, startTime: "11:00", endTime: "12:30", room: "Lab 1" },
  { subjectId: "subject-4", dayOfWeek: 6, startTime: "10:00", endTime: "11:30", room: "Lab 3" },
  { subjectId: "subject-2", dayOfWeek: 6, startTime: "12:00", endTime: "13:00", room: "B-102" },
];

const timetableEntries: TimetableEntry[] = timetableSeeds.map((seed, index) => {
  const subject = subjects.find((item) => item.id === seed.subjectId);
  if (!subject) {
    throw new Error(`Seed timetable subject ${seed.subjectId} does not exist.`);
  }
  const createdAt = new Date("2026-09-15T04:00:00.000Z");
  return {
    id: `timetable-${index + 1}`,
    studentId: DEMO_STUDENT_ID,
    subjectId: subject.id,
    subjectName: subject.name,
    dayOfWeek: seed.dayOfWeek,
    startTime: seed.startTime,
    endTime: seed.endTime,
    category: subject.category,
    room: seed.room,
    active: true,
    createdAt,
    updatedAt: createdAt,
  };
});

const sessions: ClassSession[] = [];
const eventsBySession = new Map<string, AttendanceEvent[]>();
const evidenceBySession = new Map<string, PrivateEvidence>();
let demoActive = false;
let finalizerTimer: NodeJS.Timeout | undefined;

function localDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEMO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function utcDateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addDays(dateKey: string, amount: number): string {
  const date = utcDateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function weekdayForDateKey(dateKey: string): number {
  const weekday = utcDateFromKey(dateKey).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function istDateTime(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hours === undefined ||
    minutes === undefined
  ) {
    throw new Error(`Invalid IST date/time: ${dateKey} ${time}`);
  }
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes) -
      IST_OFFSET_MINUTES * 60 * 1000,
  );
}

function localTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DEMO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function dayOrdinal(dateKey: string): number {
  return Math.floor(utcDateFromKey(dateKey).getTime() / DAY_IN_MS);
}

function recordEvent(
  sessionId: string,
  eventType: AttendanceEventEventType,
  message: string,
  serverTimestamp: Date,
): void {
  const event: AttendanceEvent = {
    id: randomUUID(),
    sessionId,
    eventType,
    serverTimestamp,
    message,
  };
  const list = eventsBySession.get(sessionId) ?? [];
  list.push(event);
  eventsBySession.set(sessionId, list);
}

function findSubject(subjectId: string): Subject | undefined {
  return subjects.find((subject) => subject.id === subjectId);
}

function buildSession(
  entry: TimetableEntry,
  dateKey: string,
  now: Date,
): ClassSession {
  const scheduledStartAt = istDateTime(dateKey, entry.startTime);
  const scheduledEndAt = istDateTime(dateKey, entry.endTime);
  const date = utcDateFromKey(dateKey);
  const id = `session-${entry.id}-${dateKey}`;
  const isFuture = scheduledEndAt.getTime() > now.getTime();
  const isUpcoming = isFuture;
  const ordinal = dayOrdinal(dateKey);
  const seedValue = Math.abs((ordinal * 7 + Number(entry.id.replace(/\D/g, "")) * 13) % 17);
  const cancelled = !isUpcoming && seedValue === 2;
  const absent = !isUpcoming && (seedValue === 0 || seedValue === 8);
  const personalStatus: PersonalStatus = isUpcoming
    ? "upcoming"
    : cancelled
      ? "cancelled"
      : absent
        ? "absent"
        : "present";
  const finalized = !isUpcoming;
  const createdAt = new Date(
    Math.min(now.getTime(), scheduledStartAt.getTime() - 10 * 60 * 1000),
  );
  const serverReceiptAt =
    personalStatus === "present"
      ? new Date(scheduledStartAt.getTime() + 2 * 60 * 1000)
      : null;
  let erpStatus: ErpStatus | null = null;
  if (finalized && personalStatus !== "cancelled" && seedValue % 5 !== 0) {
    const personal = personalStatus === "present" ? "Present" : "Absent";
    erpStatus =
      seedValue % 7 === 0
        ? personal === "Present"
          ? "Absent"
          : "Present"
        : personal;
  }
  const session: ClassSession = {
    id,
    studentId: DEMO_STUDENT_ID,
    subjectId: entry.subjectId,
    subjectName: entry.subjectName,
    timetableEntryId: entry.id,
    scheduledDate: date,
    scheduledStartAt,
    scheduledEndAt,
    category: entry.category,
    room: entry.room,
    personalStatus,
    erpStatus,
    canMarkPresent: false,
    finalized,
    finalizedAt: finalized ? scheduledEndAt : null,
    serverReceiptAt,
    clientCaptureAt: null,
    cancelledAt: personalStatus === "cancelled" ? scheduledStartAt : null,
    evidenceAvailable: false,
    createdAt,
  };
  sessions.push(session);
  recordEvent(id, "session_created", "Class session created from the weekly timetable.", createdAt);
  if (personalStatus === "present" && serverReceiptAt) {
    recordEvent(id, "present_marked", "Attendance recorded for the demo history.", serverReceiptAt);
  }
  if (finalized) {
    recordEvent(id, "session_finalized", "Class window closed; attendance record finalized.", scheduledEndAt);
  }
  if (personalStatus === "cancelled") {
    recordEvent(id, "session_cancelled", "Class was cancelled and excluded from attendance totals.", scheduledStartAt);
  }
  if (erpStatus) {
    recordEvent(id, "erp_status_recorded", `ERP status manually recorded as ${erpStatus}.`, createdAt);
  }
  return session;
}

function createLiveDemoSession(now: Date): void {
  const dateKey = localDateKey(now);
  const scheduledStartAt = new Date(now.getTime() - 60 * 1000);
  const scheduledEndAt = new Date(now.getTime() + 25 * 60 * 1000);
  const session: ClassSession = {
    id: "live-demo-session",
    studentId: DEMO_STUDENT_ID,
    subjectId: "subject-1",
    subjectName: "Data Structures",
    timetableEntryId: null,
    scheduledDate: utcDateFromKey(dateKey),
    scheduledStartAt,
    scheduledEndAt,
    category: "Theory",
    room: "Demo classroom",
    personalStatus: "upcoming",
    erpStatus: null,
    canMarkPresent: true,
    finalized: false,
    finalizedAt: null,
    serverReceiptAt: null,
    clientCaptureAt: null,
    cancelledAt: null,
    evidenceAvailable: false,
    createdAt: now,
  };
  sessions.push(session);
  recordEvent(session.id, "session_created", "Live attendance demo is ready.", now);
}

function seedSessions(now: Date): void {
  const today = localDateKey(now);
  for (let offset = -28; offset <= 7; offset += 1) {
    const dateKey = addDays(today, offset);
    const weekday = weekdayForDateKey(dateKey);
    for (const entry of timetableEntries) {
      if (!entry.active || entry.dayOfWeek !== weekday) continue;
      const alreadySeeded = sessions.some(
        (session) =>
          session.timetableEntryId === entry.id &&
          localDateKey(session.scheduledDate) === dateKey,
      );
      if (!alreadySeeded) buildSession(entry, dateKey, now);
    }
  }
  createLiveDemoSession(now);
}

seedSessions(new Date());

function isAttendanceEligible(session: ClassSession): boolean {
  return (
    session.finalized &&
    (session.personalStatus === "present" || session.personalStatus === "absent")
  );
}

function getComparisonStatus(session: ClassSession): ComparisonStatus {
  if (session.erpStatus === null) return "erp_not_entered";
  const personalErpStatus = session.personalStatus === "present" ? "Present" : "Absent";
  return session.erpStatus === personalErpStatus ? "match" : "potential_discrepancy";
}

function sessionView(session: ClassSession, now = new Date()): ClassSession {
  const inWindow =
    now.getTime() >= session.scheduledStartAt.getTime() &&
    now.getTime() < session.scheduledEndAt.getTime();
  return {
    ...session,
    canMarkPresent:
      !session.finalized &&
      session.personalStatus === "upcoming" &&
      inWindow,
  };
}

function ensureFutureSessions(now: Date): void {
  const today = localDateKey(now);
  const expected = new Set<string>();
  for (let offset = 0; offset <= 7; offset += 1) {
    const dateKey = addDays(today, offset);
    const weekday = weekdayForDateKey(dateKey);
    for (const entry of timetableEntries) {
      if (!entry.active || entry.dayOfWeek !== weekday) continue;
      const id = `session-${entry.id}-${dateKey}`;
      expected.add(id);
      const scheduledEndAt = istDateTime(dateKey, entry.endTime);
      if (scheduledEndAt.getTime() <= now.getTime()) continue;
      const existing = sessions.find((session) => session.id === id);
      if (existing) {
        if (!existing.finalized && existing.personalStatus === "upcoming") {
          existing.subjectId = entry.subjectId;
          existing.subjectName = entry.subjectName;
          existing.category = entry.category;
          existing.room = entry.room;
          existing.scheduledStartAt = istDateTime(dateKey, entry.startTime);
          existing.scheduledEndAt = scheduledEndAt;
          existing.scheduledDate = utcDateFromKey(dateKey);
        }
        continue;
      }
      buildSession(entry, dateKey, now);
    }
  }
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const session = sessions[index];
    if (
      session &&
      session.personalStatus === "upcoming" &&
      !session.finalized &&
      session.timetableEntryId !== null &&
      !expected.has(session.id) &&
      session.scheduledStartAt.getTime() > now.getTime()
    ) {
      sessions.splice(index, 1);
      eventsBySession.delete(session.id);
    }
  }
}

export function finalizeExpiredSessions(now = new Date()): void {
  for (const session of sessions) {
    if (
      session.finalized ||
      session.personalStatus !== "upcoming" ||
      session.scheduledEndAt.getTime() > now.getTime()
    ) {
      continue;
    }
    session.personalStatus = "absent";
    session.finalized = true;
    session.finalizedAt = now;
    session.canMarkPresent = false;
    recordEvent(
      session.id,
      "session_finalized",
      "Class window closed; no attendance mark was received, so the session was recorded absent.",
      now,
    );
  }
}

export function startFinalizationJob(): void {
  if (finalizerTimer) return;
  finalizerTimer = setInterval(() => {
    const now = new Date();
    finalizeExpiredSessions(now);
    ensureFutureSessions(now);
  }, 5_000);
  finalizerTimer.unref();
}

export function getDemoSession(): DemoSessionResult {
  return { active: demoActive, profile: { ...profile } };
}

export function startDemoSession(): DemoSessionResult {
  demoActive = true;
  return getDemoSession();
}

export function endDemoSession(): DemoSessionResult {
  demoActive = false;
  return getDemoSession();
}

export function isDemoActive(): boolean {
  return demoActive;
}

export function getProfile(): StudentProfile {
  return { ...profile };
}

export function listSubjects(): Subject[] {
  return subjects.map((subject) => ({ ...subject }));
}

export function createSubject(input: SubjectInput): Subject {
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new AttendWiseStoreError("bad_request", "Subject name is required.");
  }
  if (subjects.some((subject) => subject.name.toLowerCase() === normalizedName.toLowerCase())) {
    throw new AttendWiseStoreError("conflict", "A subject with this name already exists.");
  }
  const now = new Date();
  const subject: Subject = {
    id: randomUUID(),
    studentId: DEMO_STUDENT_ID,
    name: normalizedName,
    category: input.category,
    iconKey: input.iconKey?.trim() || "book",
    createdAt: now,
    updatedAt: now,
  };
  subjects.push(subject);
  return { ...subject };
}

export function updateSubject(subjectId: string, input: SubjectUpdate): Subject | undefined {
  const subject = findSubject(subjectId);
  if (!subject) return undefined;
  const nextName = input.name?.trim() ?? subject.name;
  if (!nextName) {
    throw new AttendWiseStoreError("bad_request", "Subject name cannot be empty.");
  }
  if (
    subjects.some(
      (item) => item.id !== subjectId && item.name.toLowerCase() === nextName.toLowerCase(),
    )
  ) {
    throw new AttendWiseStoreError("conflict", "A subject with this name already exists.");
  }
  subject.name = nextName;
  if (input.category) subject.category = input.category;
  if (input.iconKey !== undefined) subject.iconKey = input.iconKey.trim() || "book";
  subject.updatedAt = new Date();
  for (const entry of timetableEntries) {
    if (entry.subjectId === subjectId) {
      entry.subjectName = subject.name;
      entry.category = subject.category;
      entry.updatedAt = subject.updatedAt;
    }
  }
  for (const session of sessions) {
    if (
      session.subjectId === subjectId &&
      !session.finalized &&
      session.scheduledStartAt.getTime() > Date.now()
    ) {
      session.subjectName = subject.name;
      session.category = subject.category;
    }
  }
  return { ...subject };
}

export function deleteSubject(subjectId: string): boolean {
  const index = subjects.findIndex((subject) => subject.id === subjectId);
  if (index < 0) return false;
  const now = Date.now();
  const removedEntryIds = new Set(
    timetableEntries.filter((entry) => entry.subjectId === subjectId).map((entry) => entry.id),
  );
  subjects.splice(index, 1);
  for (let entryIndex = timetableEntries.length - 1; entryIndex >= 0; entryIndex -= 1) {
    if (timetableEntries[entryIndex]?.subjectId === subjectId) {
      timetableEntries.splice(entryIndex, 1);
    }
  }
  for (let sessionIndex = sessions.length - 1; sessionIndex >= 0; sessionIndex -= 1) {
    const session = sessions[sessionIndex];
    if (
      session &&
      session.timetableEntryId &&
      removedEntryIds.has(session.timetableEntryId) &&
      !session.finalized &&
      session.scheduledStartAt.getTime() > now
    ) {
      eventsBySession.delete(session.id);
      sessions.splice(sessionIndex, 1);
    }
  }
  return true;
}

function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === undefined || minutes === undefined) return -1;
  return hours * 60 + minutes;
}

function ensureValidTimetable(
  input: TimetableInput | TimetableUpdate,
  current?: TimetableEntry,
): {
  subject: Subject;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  category: SubjectCategory;
  room: string | null;
} {
  const subjectId = input.subjectId ?? current?.subjectId;
  const subject = subjectId ? findSubject(subjectId) : undefined;
  if (!subject) {
    throw new AttendWiseStoreError("bad_request", "Select an existing subject.");
  }
  const dayOfWeek = input.dayOfWeek ?? current?.dayOfWeek;
  const startTime = input.startTime ?? current?.startTime;
  const endTime = input.endTime ?? current?.endTime;
  const category = input.category ?? current?.category;
  const room = input.room === undefined ? (current?.room ?? null) : input.room;
  if (
    dayOfWeek === undefined ||
    startTime === undefined ||
    endTime === undefined ||
    category === undefined
  ) {
    throw new AttendWiseStoreError("bad_request", "Complete all required timetable fields.");
  }
  if (
    minutesSinceMidnight(startTime) < 0 ||
    minutesSinceMidnight(endTime) <= minutesSinceMidnight(startTime)
  ) {
    throw new AttendWiseStoreError("bad_request", "End time must be later than start time.");
  }
  if (category !== subject.category) {
    throw new AttendWiseStoreError("bad_request", "Timetable category must match the subject.");
  }
  return { subject, dayOfWeek, startTime, endTime, category, room };
}

function ensureNoOverlap(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  ignoreId?: string,
): void {
  const start = minutesSinceMidnight(startTime);
  const end = minutesSinceMidnight(endTime);
  const overlapping = timetableEntries.find(
    (entry) =>
      entry.active &&
      entry.id !== ignoreId &&
      entry.dayOfWeek === dayOfWeek &&
      start < minutesSinceMidnight(entry.endTime) &&
      end > minutesSinceMidnight(entry.startTime),
  );
  if (overlapping) {
    throw new AttendWiseStoreError(
      "conflict",
      "This class overlaps another timetable entry on the same day.",
    );
  }
}

export function listTimetable(): TimetableEntry[] {
  return timetableEntries
    .filter((entry) => entry.active)
    .map((entry) => {
      const subject = findSubject(entry.subjectId);
      return {
        ...entry,
        subjectName: subject?.name ?? entry.subjectName,
      };
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

export function createTimetableEntry(input: TimetableInput): TimetableEntry {
  const value = ensureValidTimetable(input);
  ensureNoOverlap(value.dayOfWeek, value.startTime, value.endTime);
  const now = new Date();
  const entry: TimetableEntry = {
    id: randomUUID(),
    studentId: DEMO_STUDENT_ID,
    subjectId: value.subject.id,
    subjectName: value.subject.name,
    dayOfWeek: value.dayOfWeek,
    startTime: value.startTime,
    endTime: value.endTime,
    category: value.category,
    room: value.room,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  timetableEntries.push(entry);
  ensureFutureSessions(now);
  return { ...entry };
}

export function updateTimetableEntry(
  entryId: string,
  input: TimetableUpdate,
): TimetableEntry | undefined {
  const entry = timetableEntries.find((item) => item.id === entryId);
  if (!entry) return undefined;
  const value = ensureValidTimetable(input, entry);
  ensureNoOverlap(value.dayOfWeek, value.startTime, value.endTime, entryId);
  entry.subjectId = value.subject.id;
  entry.subjectName = value.subject.name;
  entry.dayOfWeek = value.dayOfWeek;
  entry.startTime = value.startTime;
  entry.endTime = value.endTime;
  entry.category = value.category;
  entry.room = value.room;
  entry.updatedAt = new Date();
  const now = new Date();
  ensureFutureSessions(now);
  return { ...entry };
}

export function deleteTimetableEntry(entryId: string): boolean {
  const index = timetableEntries.findIndex((entry) => entry.id === entryId);
  if (index < 0) return false;
  timetableEntries.splice(index, 1);
  const now = Date.now();
  for (let sessionIndex = sessions.length - 1; sessionIndex >= 0; sessionIndex -= 1) {
    const session = sessions[sessionIndex];
    if (
      session &&
      session.timetableEntryId === entryId &&
      !session.finalized &&
      session.scheduledStartAt.getTime() > now
    ) {
      sessions.splice(sessionIndex, 1);
      eventsBySession.delete(session.id);
    }
  }
  return true;
}

export function listSessions(filters: SessionFilters = {}): ClassSession[] {
  const now = new Date();
  finalizeExpiredSessions(now);
  ensureFutureSessions(now);
  const fromKey = filters.from ? localDateKey(filters.from) : undefined;
  const toKey = filters.to ? localDateKey(filters.to) : undefined;
  return sessions
    .filter((session) => {
      const dateKey = localDateKey(session.scheduledDate);
      if (filters.subjectId && session.subjectId !== filters.subjectId) return false;
      if (filters.category && session.category !== filters.category) return false;
      if (filters.personalStatus && session.personalStatus !== filters.personalStatus) return false;
      if (fromKey && dateKey < fromKey) return false;
      if (toKey && dateKey > toKey) return false;
      if (
        filters.comparisonStatus &&
        (!isAttendanceEligible(session) ||
          getComparisonStatus(session) !== filters.comparisonStatus)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime())
    .map((session) => sessionView(session, now));
}

export function getTodayDashboard(now = new Date()): TodayDashboard {
  finalizeExpiredSessions(now);
  ensureFutureSessions(now);
  const today = localDateKey(now);
  return {
    serverNow: now,
    sessions: sessions
      .filter((session) => localDateKey(session.scheduledDate) === today)
      .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime())
      .map((session) => sessionView(session, now)),
  };
}

export function getSession(sessionId: string): ClassSession | undefined {
  const now = new Date();
  finalizeExpiredSessions(now);
  const session = sessions.find((item) => item.id === sessionId);
  return session ? sessionView(session, now) : undefined;
}

export function getSessionEvents(sessionId: string): AttendanceEvent[] | undefined {
  if (!sessions.some((session) => session.id === sessionId)) return undefined;
  return [...(eventsBySession.get(sessionId) ?? [])].sort(
    (a, b) => a.serverTimestamp.getTime() - b.serverTimestamp.getTime(),
  );
}

export function markPresent(
  sessionId: string,
  input: MarkPresentInput,
  now = new Date(),
): MarkPresentResult {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) throw new AttendWiseStoreError("not_found", "Session not found.");
  if (session.finalized || session.personalStatus !== "upcoming") {
    throw new AttendWiseStoreError("conflict", "This session can no longer be marked present.");
  }
  if (
    now.getTime() < session.scheduledStartAt.getTime() ||
    now.getTime() >= session.scheduledEndAt.getTime()
  ) {
    if (now.getTime() >= session.scheduledEndAt.getTime()) {
      finalizeExpiredSessions(now);
    }
    throw new AttendWiseStoreError(
      "outside_window",
      "Mark Present is only available from the scheduled start time up to, but not including, the scheduled end time.",
    );
  }
  if (
    input.evidenceDataUrl &&
    !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      input.evidenceDataUrl,
    )
  ) {
    throw new AttendWiseStoreError(
      "bad_request",
      "Camera evidence must be a JPEG, PNG, or WebP data URL.",
    );
  }

  const receiptAt = new Date();
  session.personalStatus = "present";
  session.serverReceiptAt = receiptAt;
  session.clientCaptureAt = input.clientCapturedAt ?? null;
  session.evidenceAvailable = Boolean(input.evidenceDataUrl);
  session.canMarkPresent = false;
  if (input.evidenceDataUrl) {
    evidenceBySession.set(sessionId, {
      dataUrl: input.evidenceDataUrl,
      clientCapturedAt: input.clientCapturedAt ?? null,
    });
  }
  recordEvent(
    sessionId,
    "present_marked",
    input.evidenceDataUrl
      ? "Attendance marked present; optional camera image held temporarily in memory and not independently verified."
      : "Attendance marked present; server receipt time recorded.",
    receiptAt,
  );
  return { session: sessionView(session, receiptAt), receiptAt };
}

export function recordErpStatus(
  sessionId: string,
  status: ErpStatus,
): ClassSession | undefined {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return undefined;
  if (!isAttendanceEligible(session)) {
    throw new AttendWiseStoreError(
      "conflict",
      "ERP status can only be entered for a finalized present or absent session.",
    );
  }
  session.erpStatus = status;
  const now = new Date();
  recordEvent(sessionId, "erp_status_recorded", `ERP status manually recorded as ${status}.`, now);
  return sessionView(session, now);
}

export function cancelSession(sessionId: string, now = new Date()): ClassSession | undefined {
  finalizeExpiredSessions(now);
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return undefined;
  if (session.finalized || session.personalStatus !== "upcoming") {
    throw new AttendWiseStoreError("conflict", "This session can no longer be cancelled.");
  }
  if (now.getTime() >= session.scheduledEndAt.getTime()) {
    throw new AttendWiseStoreError("conflict", "The class window has already ended.");
  }
  session.personalStatus = "cancelled";
  session.finalized = true;
  session.cancelledAt = now;
  session.finalizedAt = now;
  session.canMarkPresent = false;
  recordEvent(
    sessionId,
    "session_cancelled",
    "Session cancelled and excluded from attendance totals.",
    now,
  );
  return sessionView(session, now);
}

function metricFor(list: ClassSession[]): AttendanceMetric {
  const eligible = list.filter(isAttendanceEligible);
  const presentCount = eligible.filter((session) => session.personalStatus === "present").length;
  const absentCount = eligible.filter((session) => session.personalStatus === "absent").length;
  const totalEligible = presentCount + absentCount;
  return {
    percentage:
      totalEligible === 0
        ? null
        : Math.round((presentCount / totalEligible) * 1000) / 10,
    presentCount,
    absentCount,
    totalEligible,
  };
}

function erpMetricFor(list: ClassSession[]): AttendanceMetric {
  const eligible = list.filter(isAttendanceEligible);
  const totalEligible = eligible.length;
  const presentCount = eligible.filter((session) => session.erpStatus === "Present").length;
  const absentCount = eligible.filter((session) => session.erpStatus === "Absent").length;
  return {
    percentage:
      totalEligible === 0
        ? null
        : Math.round((presentCount / totalEligible) * 1000) / 10,
    presentCount,
    absentCount,
    totalEligible,
  };
}

export function getDashboardSummary(now = new Date()): DashboardSummary {
  finalizeExpiredSessions(now);
  const eligible = sessions.filter(isAttendanceEligible);
  return {
    overall: metricFor(sessions),
    theory: metricFor(sessions.filter((session) => session.category === "Theory")),
    practical: metricFor(sessions.filter((session) => session.category === "Practical")),
    erp: erpMetricFor(sessions),
    targetPercent: profile.attendanceTarget,
    erpNotEnteredCount: eligible.filter((session) => session.erpStatus === null).length,
    upcomingCount: sessions.filter(
      (session) =>
        !session.finalized &&
        session.personalStatus === "upcoming" &&
        session.scheduledStartAt.getTime() > now.getTime(),
    ).length,
  };
}

export function getSubjectAttendance(): SubjectAttendance[] {
  return subjects
    .map((subject) => {
      const metric = metricFor(sessions.filter((session) => session.subjectId === subject.id));
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        category: subject.category,
        iconKey: subject.iconKey,
        ...metric,
        targetPercent: profile.attendanceTarget,
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

function toComparisonEntry(session: ClassSession): ComparisonEntry {
  return {
    sessionId: session.id,
    subjectId: session.subjectId,
    subjectName: session.subjectName,
    category: session.category,
    scheduledDate: session.scheduledDate,
    personalStatus: session.personalStatus,
    erpStatus: session.erpStatus,
    comparisonStatus: getComparisonStatus(session),
  };
}

export function getErpComparison(): ComparisonSummary {
  const entries = sessions
    .filter(isAttendanceEligible)
    .sort((a, b) => b.scheduledStartAt.getTime() - a.scheduledStartAt.getTime())
    .map(toComparisonEntry);
  return {
    entries,
    matchCount: entries.filter((entry) => entry.comparisonStatus === "match").length,
    discrepancyCount: entries.filter(
      (entry) => entry.comparisonStatus === "potential_discrepancy",
    ).length,
    erpNotEnteredCount: entries.filter(
      (entry) => entry.comparisonStatus === "erp_not_entered",
    ).length,
  };
}

export function getAttendanceHistory(filters: SessionFilters = {}): ClassSession[] {
  return listSessions(filters)
    .filter((session) => session.finalized)
    .sort((a, b) => b.scheduledStartAt.getTime() - a.scheduledStartAt.getTime());
}

export function getEvidenceForInternalUse(sessionId: string): PrivateEvidence | undefined {
  const evidence = evidenceBySession.get(sessionId);
  return evidence ? { ...evidence } : undefined;
}
