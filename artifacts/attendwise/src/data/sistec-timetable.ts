export interface SistecSubjectSeed {
  id: string;
  code: string;
  name: string;
  category: "Theory" | "Practical";
  iconKey: string;
  reviewNeeded?: boolean;
  notes?: string;
}

export interface SistecSlotSeed {
  slot: string; // P1 - P6
  dayOfWeek: number; // 1 (Mon) - 6 (Sat)
  subjectId: string;
  startTime: string; // HH:mm in IST
  endTime: string; // HH:mm in IST
  category: "Theory" | "Practical";
  room?: string;
  teacherName?: string | null;
}

// Institution: SISTec, Sagar Institute of Science & Technology, Bhopal
// Course: AIDS 3 SEM 2 YR | Session: ODD SEM 2026-27 | Timetable Date: 16/10/2026
export const SISTEC_METADATA = {
  institution: "Sagar Institute of Science & Technology (SISTec)",
  campus: "Gandhinagar, Bhopal, MP",
  course: "AIDS 3 SEM 2 YR",
  session: "ODD SEM 2026-27",
  effectiveDate: "16/10/2026",
  timezone: "Asia/Kolkata",
};

// Slots definition per attested SISTec schedule:
// P1: 9:35 AM – 10:35 AM
// P2: 10:35 AM – 11:35 AM
// P3: 11:35 AM – 12:35 PM
// P4: 12:35 PM – 1:35 PM
// Lunch interval: 1:35 PM – 2:10 PM
// P5: 2:10 PM – 3:10 PM
// P6: 3:10 PM – 4:10 PM
export const SISTEC_TIME_SLOTS = [
  { slot: "P1", start: "09:35", end: "10:35", label: "9:35 AM – 10:35 AM" },
  { slot: "P2", start: "10:35", end: "11:35", label: "10:35 AM – 11:35 AM" },
  { slot: "P3", start: "11:35", end: "12:35", label: "11:35 AM – 12:35 PM" },
  { slot: "P4", start: "12:35", end: "13:35", label: "12:35 PM – 1:35 PM" },
  // Lunch interval 1:35 PM – 2:10 PM (Excluded from classes)
  { slot: "P5", start: "14:10", end: "15:10", label: "2:10 PM – 3:10 PM" },
  { slot: "P6", start: "15:10", end: "16:10", label: "3:10 PM – 4:10 PM" },
];

export const SISTEC_SUBJECTS: SistecSubjectSeed[] = [
  {
    id: "sub-ad-301",
    code: "AD-301",
    name: "Technical Communication",
    category: "Theory",
    iconKey: "message-square",
  },
  {
    id: "sub-ad-302",
    code: "AD-302",
    name: "Probability and Statistics",
    category: "Theory",
    iconKey: "pie-chart",
  },
  {
    id: "sub-ad-303-t",
    code: "AD-303",
    name: "Data Structure / Sa",
    category: "Theory",
    iconKey: "database",
    reviewNeeded: true,
    notes: "Abbreviated label in source PDF schedule ('Data Structure / Sa')",
  },
  {
    id: "sub-ad-303-p",
    code: "AD-303",
    name: "Data Structure / S",
    category: "Practical",
    iconKey: "code-2",
    reviewNeeded: true,
    notes: "Abbreviated label in source PDF schedule ('Data Structure / S (P)')",
  },
  {
    id: "sub-ad-304-t",
    code: "AD-304",
    name: "Artificial Intelligence",
    category: "Theory",
    iconKey: "sparkles",
  },
  {
    id: "sub-ad-304-p",
    code: "AD-304",
    name: "Artificial Intelligence",
    category: "Practical",
    iconKey: "sparkles",
  },
  {
    id: "sub-ad-305",
    code: "AD-305",
    name: "Object Oriented Programming",
    category: "Practical",
    iconKey: "cpu",
  },
  {
    id: "sub-ad-306",
    code: "AD-306",
    name: "Computer Workshop/I",
    category: "Practical",
    iconKey: "wrench",
    reviewNeeded: true,
    notes: "Abbreviated label in source PDF schedule ('Computer Workshop/I (P)')",
  },
  {
    id: "sub-ad-cp-313",
    code: "AD-CP-313",
    name: "Competitive Programming",
    category: "Theory",
    iconKey: "terminal",
  },
  {
    id: "sub-ad-crt-315",
    code: "AD-CRT-315",
    name: "CRT (Aptitude)",
    category: "Theory",
    iconKey: "brain",
  },
  {
    id: "sub-ad-crt-316",
    code: "AD-CRT-316",
    name: "CRT (Communication)",
    category: "Theory",
    iconKey: "users",
  },
  {
    id: "sub-ad-lib-312",
    code: "AD-LIB-312",
    name: "Library (Self Study)",
    category: "Theory",
    iconKey: "book-open",
  },
];

// Python Training Special Program: 7 September 2026 through 21 September 2026
// Exactly 66 confirmed historical class sessions across 11 training days (6 periods/day)
// Exceptions: Sept 14 (Ganesh Chaturthi - excluded), Sept 19 (Included 6 periods)
export interface PythonTrainingSubjectSeed extends SistecSubjectSeed {
  totalScheduledSessions: number;
  trainingStartDate: string;
  trainingEndDate: string;
  periodsPerDay: number;
  isSpecialTraining: boolean;
}

export const PYTHON_TRAINING_SUBJECT: PythonTrainingSubjectSeed = {
  id: "sub-python-training",
  code: "PYTHON-TRG",
  name: "Python Training",
  category: "Practical",
  iconKey: "terminal",
  totalScheduledSessions: 66,
  trainingStartDate: "2026-09-07",
  trainingEndDate: "2026-09-21",
  periodsPerDay: 6,
  isSpecialTraining: true,
  notes: "Special Python Training Program (7–21 Sept 2026). Exactly 66 confirmed historical class sessions.",
};

// 11 confirmed training days * 6 slots = 66 distinct class sessions
export const PYTHON_TRAINING_DATES: readonly string[] = [
  "2026-09-07", // Day 1 (Mon)
  "2026-09-08", // Day 2 (Tue)
  "2026-09-09", // Day 3 (Wed)
  "2026-09-10", // Day 4 (Thu)
  "2026-09-11", // Day 5 (Fri)
  "2026-09-12", // Day 6 (Sat)
  // 2026-09-13: Sunday (Off)
  // 2026-09-14: Ganesh Chaturthi (Holiday / Excluded per requirements)
  "2026-09-15", // Day 7 (Tue)
  "2026-09-16", // Day 8 (Wed)
  "2026-09-17", // Day 9 (Thu)
  "2026-09-18", // Day 10 (Fri)
  "2026-09-19", // Day 11 (Sat) - included per requirements (6 periods took place)
  // 2026-09-20: Sunday (Off)
  // 2026-09-21: College classes start
];


// Full Monday-Saturday schedule matching the exact college timetable PDF with corrected P4 timings
export const SISTEC_TIMETABLE_SLOTS: SistecSlotSeed[] = [
  // MONDAY (Day 1)
  { slot: "P1", dayOfWeek: 1, subjectId: "sub-ad-302", startTime: "09:35", endTime: "10:35", category: "Theory" },
  { slot: "P2", dayOfWeek: 1, subjectId: "sub-ad-304-t", startTime: "10:35", endTime: "11:35", category: "Theory" },
  { slot: "P3", dayOfWeek: 1, subjectId: "sub-ad-305", startTime: "11:35", endTime: "12:35", category: "Practical" },
  { slot: "P4", dayOfWeek: 1, subjectId: "sub-ad-305", startTime: "12:35", endTime: "13:35", category: "Practical" },
  { slot: "P5", dayOfWeek: 1, subjectId: "sub-ad-cp-313", startTime: "14:10", endTime: "15:10", category: "Theory" },
  { slot: "P6", dayOfWeek: 1, subjectId: "sub-ad-cp-313", startTime: "15:10", endTime: "16:10", category: "Theory" },

  // TUESDAY (Day 2)
  { slot: "P1", dayOfWeek: 2, subjectId: "sub-ad-crt-315", startTime: "09:35", endTime: "10:35", category: "Theory" },
  { slot: "P2", dayOfWeek: 2, subjectId: "sub-ad-crt-316", startTime: "10:35", endTime: "11:35", category: "Theory" },
  { slot: "P3", dayOfWeek: 2, subjectId: "sub-ad-302", startTime: "11:35", endTime: "12:35", category: "Theory" },
  { slot: "P4", dayOfWeek: 2, subjectId: "sub-ad-303-t", startTime: "12:35", endTime: "13:35", category: "Theory" },
  { slot: "P5", dayOfWeek: 2, subjectId: "sub-ad-304-t", startTime: "14:10", endTime: "15:10", category: "Theory" },
  { slot: "P6", dayOfWeek: 2, subjectId: "sub-ad-301", startTime: "15:10", endTime: "16:10", category: "Theory" },

  // WEDNESDAY (Day 3)
  { slot: "P1", dayOfWeek: 3, subjectId: "sub-ad-305", startTime: "09:35", endTime: "10:35", category: "Practical" },
  { slot: "P2", dayOfWeek: 3, subjectId: "sub-ad-305", startTime: "10:35", endTime: "11:35", category: "Practical" },
  { slot: "P3", dayOfWeek: 3, subjectId: "sub-ad-303-t", startTime: "11:35", endTime: "12:35", category: "Theory" },
  { slot: "P4", dayOfWeek: 3, subjectId: "sub-ad-301", startTime: "12:35", endTime: "13:35", category: "Theory" },
  { slot: "P5", dayOfWeek: 3, subjectId: "sub-ad-304-t", startTime: "14:10", endTime: "15:10", category: "Theory" },
  { slot: "P6", dayOfWeek: 3, subjectId: "sub-ad-302", startTime: "15:10", endTime: "16:10", category: "Theory" },

  // THURSDAY (Day 4)
  { slot: "P1", dayOfWeek: 4, subjectId: "sub-ad-cp-313", startTime: "09:35", endTime: "10:35", category: "Theory" },
  { slot: "P2", dayOfWeek: 4, subjectId: "sub-ad-cp-313", startTime: "10:35", endTime: "11:35", category: "Theory" },
  { slot: "P3", dayOfWeek: 4, subjectId: "sub-ad-303-p", startTime: "11:35", endTime: "12:35", category: "Practical" },
  { slot: "P4", dayOfWeek: 4, subjectId: "sub-ad-303-p", startTime: "12:35", endTime: "13:35", category: "Practical" },
  { slot: "P5", dayOfWeek: 4, subjectId: "sub-ad-302", startTime: "14:10", endTime: "15:10", category: "Theory" },
  { slot: "P6", dayOfWeek: 4, subjectId: "sub-ad-lib-312", startTime: "15:10", endTime: "16:10", category: "Theory" },

  // FRIDAY (Day 5)
  { slot: "P1", dayOfWeek: 5, subjectId: "sub-ad-304-p", startTime: "09:35", endTime: "10:35", category: "Practical" },
  { slot: "P2", dayOfWeek: 5, subjectId: "sub-ad-304-p", startTime: "10:35", endTime: "11:35", category: "Practical" },
  { slot: "P3", dayOfWeek: 5, subjectId: "sub-ad-305", startTime: "11:35", endTime: "12:35", category: "Practical" },
  { slot: "P4", dayOfWeek: 5, subjectId: "sub-ad-305", startTime: "12:35", endTime: "13:35", category: "Practical" },
  { slot: "P5", dayOfWeek: 5, subjectId: "sub-ad-crt-315", startTime: "14:10", endTime: "15:10", category: "Theory" },
  { slot: "P6", dayOfWeek: 5, subjectId: "sub-ad-crt-316", startTime: "15:10", endTime: "16:10", category: "Theory" },

  // SATURDAY (Day 6)
  { slot: "P1", dayOfWeek: 6, subjectId: "sub-ad-301", startTime: "09:35", endTime: "10:35", category: "Theory" },
  { slot: "P2", dayOfWeek: 6, subjectId: "sub-ad-303-t", startTime: "10:35", endTime: "11:35", category: "Theory" },
  { slot: "P3", dayOfWeek: 6, subjectId: "sub-ad-306", startTime: "11:35", endTime: "12:35", category: "Practical" },
  { slot: "P4", dayOfWeek: 6, subjectId: "sub-ad-306", startTime: "12:35", endTime: "13:35", category: "Practical" },
  { slot: "P5", dayOfWeek: 6, subjectId: "sub-ad-303-p", startTime: "14:10", endTime: "15:10", category: "Practical" },
  { slot: "P6", dayOfWeek: 6, subjectId: "sub-ad-303-p", startTime: "15:10", endTime: "16:10", category: "Practical" },
];
