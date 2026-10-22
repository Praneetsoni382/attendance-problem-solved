// SISTec Gandhi Nagar Academic Calendar (Session: AUG-DEC 2026)
// Source of truth: Official GN Academic Calendar for B.Tech 3rd Semester
// Sagar Institute of Science & Technology (SISTec), Bhopal

export type CalendarDayType = "teaching" | "holiday" | "exam" | "training" | "off";

export interface CalendarDayInfo {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 1 (Mon) - 7 (Sun)
  type: CalendarDayType;
  dayNumber?: number; // 1 to 57 for B.Tech 3rd teaching days
  title: string;
  description?: string;
  isWorkingDay: boolean;
}

export interface AcademicHoliday {
  date: string; // YYYY-MM-DD or range
  startDate: string;
  endDate: string;
  name: string;
  description?: string;
}

// Official Holidays declared in SISTec GN Academic Calendar (Aug-Dec 2026)
export const SISTEC_OFFICIAL_HOLIDAYS: AcademicHoliday[] = [
  {
    date: "2026-08-15",
    startDate: "2026-08-15",
    endDate: "2026-08-15",
    name: "Independence Day",
    description: "National Holiday",
  },
  {
    date: "2026-08-28",
    startDate: "2026-08-28",
    endDate: "2026-08-28",
    name: "Raksha Bandhan",
    description: "Festival Holiday",
  },
  {
    date: "2026-09-04",
    startDate: "2026-09-04",
    endDate: "2026-09-04",
    name: "Janmashtami",
    description: "Festival Holiday",
  },
  {
    date: "2026-09-14",
    startDate: "2026-09-14",
    endDate: "2026-09-14",
    name: "Ganesh Chaturthi",
    description: "Festival Holiday",
  },
  {
    date: "2026-10-02",
    startDate: "2026-10-02",
    endDate: "2026-10-02",
    name: "Gandhi Jayanti",
    description: "National Holiday",
  },
  {
    date: "2026-10-19",
    startDate: "2026-10-19",
    endDate: "2026-10-19",
    name: "Durga Navmi",
    description: "Festival Holiday",
  },
  {
    date: "2026-10-20",
    startDate: "2026-10-20",
    endDate: "2026-10-20",
    name: "Vijay Dashmi",
    description: "Dussehra Festival Holiday",
  },
  {
    date: "2026-11-06 to 2026-11-10",
    startDate: "2026-11-06",
    endDate: "2026-11-10",
    name: "Diwali Holidays",
    description: "Deepawali Festival Break (5 days)",
  },
  {
    date: "2026-12-03",
    startDate: "2026-12-03",
    endDate: "2026-12-03",
    name: "Gas Tragedy Memorial Day",
    description: "Bhopal Gas Tragedy Commemoration Day",
  },
  {
    date: "2026-12-25",
    startDate: "2026-12-25",
    endDate: "2026-12-25",
    name: "Christmas",
    description: "Festival Holiday",
  },
];

// Special Academic Events for B.Tech 3rd Semester
export const SISTEC_ACADEMIC_EVENTS = [
  {
    startDate: "2026-09-07",
    endDate: "2026-09-18",
    title: "Training Period",
    type: "training",
    description: "Pre-semester skills training (excluding Sept 14 Ganesh Chaturthi holiday)",
  },
  {
    startDate: "2026-11-23",
    endDate: "2026-11-27",
    title: "Mid-Semester Test I (MST-I)",
    type: "exam",
    description: "First mid-semester theory & lab evaluations",
  },
  {
    startDate: "2026-12-17",
    endDate: "2026-12-23",
    title: "Mid-Semester Test II (MST-II)",
    type: "exam",
    description: "Second mid-semester examinations",
  },
  {
    startDate: "2026-12-28",
    endDate: "2026-12-31",
    title: "RGPV University Exam / Prep",
    type: "exam",
    description: "RGPV Semester Final Examinations",
  },
];

// Complete date-by-date lookup for B.Tech 3rd Semester (August 1, 2026 to December 31, 2026)
// Exactly 57 instructional teaching days as specified in the official SISTec calendar
export const BTECH_3RD_TEACHING_DAYS: Record<string, number> = {
  // September 2026 (Days 1 - 9)
  "2026-09-21": 1,
  "2026-09-22": 2,
  "2026-09-23": 3,
  "2026-09-24": 4,
  "2026-09-25": 5,
  "2026-09-26": 6, // Working Saturday
  "2026-09-28": 7,
  "2026-09-29": 8,
  "2026-09-30": 9,

  // October 2026 (Days 10 - 31, excluding Oct 17 which is off per calendar image)
  "2026-10-01": 10,
  "2026-10-05": 11,
  "2026-10-06": 12,
  "2026-10-07": 13,
  "2026-10-08": 14,
  "2026-10-09": 15,
  "2026-10-10": 16, // Working Saturday
  "2026-10-12": 17,
  "2026-10-13": 18,
  "2026-10-14": 19,
  "2026-10-15": 20,
  "2026-10-16": 21,
  // 2026-10-17 is off (*) per official calendar image
  "2026-10-21": 22,
  "2026-10-22": 23,
  "2026-10-23": 24,
  "2026-10-24": 25, // Working Saturday
  "2026-10-26": 26,
  "2026-10-27": 27,
  "2026-10-28": 28,
  "2026-10-29": 29,
  "2026-10-30": 30,
  "2026-10-31": 31, // Working Saturday

  // November 2026 (Days 32 - 49, including MST-I green exam working days)
  "2026-11-02": 32,
  "2026-11-03": 33,
  "2026-11-04": 34,
  "2026-11-05": 35,
  // 2026-11-06 to 2026-11-10: Diwali Holidays
  "2026-11-11": 36,
  "2026-11-12": 37,
  "2026-11-13": 38,
  "2026-11-14": 39, // Working Saturday
  "2026-11-16": 40,
  "2026-11-17": 41,
  "2026-11-18": 42,
  "2026-11-19": 43,
  "2026-11-20": 44,
  // MST-I (Green working/exam days for B.Tech 3rd)
  "2026-11-23": 45,
  "2026-11-24": 46,
  "2026-11-25": 47,
  "2026-11-26": 48,
  "2026-11-27": 49,
  "2026-11-30": 50,

  // December 2026 (Days 51 - 71, including MST-II and RGPV Exam working/exam days)
  "2026-12-01": 51,
  "2026-12-02": 52,
  // 2026-12-03: Gas Tragedy Memorial Holiday
  "2026-12-04": 53,
  "2026-12-07": 54,
  "2026-12-08": 55,
  "2026-12-09": 56,
  "2026-12-10": 57,
  "2026-12-11": 58,
  "2026-12-12": 59, // Working Saturday
  "2026-12-14": 60,
  "2026-12-15": 61,
  "2026-12-16": 62, // Final instructional day!
  // MST-II (Green working/exam days for B.Tech 3rd)
  "2026-12-17": 63,
  "2026-12-18": 64,
  "2026-12-21": 65,
  "2026-12-22": 66,
  "2026-12-23": 67,
  // 2026-12-25: Christmas Holiday
  // RGPV Exam working/exam days for B.Tech 3rd
  "2026-12-28": 68,
  "2026-12-29": 69,
  "2026-12-30": 70,
  "2026-12-31": 71,
};

// Calendar Overrides Storage & Management
export interface CalendarOverride {
  date: string;
  isWorking: boolean;
  type: CalendarDayType;
  title: string;
  description?: string;
}

export function getCalendarOverrides(): Record<string, CalendarOverride> {
  try {
    const raw = localStorage.getItem("sistec_calendar_overrides");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setCalendarOverride(dateKey: string, override: CalendarOverride | null) {
  const overrides = getCalendarOverrides();
  if (!override) {
    delete overrides[dateKey];
  } else {
    overrides[dateKey] = override;
  }
  localStorage.setItem("sistec_calendar_overrides", JSON.stringify(overrides));
  window.dispatchEvent(new Event("sistec-calendar-updated"));
}

// Quick helper to check if a specific date (YYYY-MM-DD) is an official holiday
export function getHolidayInfo(dateKey: string): AcademicHoliday | undefined {
  return SISTEC_OFFICIAL_HOLIDAYS.find((h) => dateKey >= h.startDate && dateKey <= h.endDate);
}

// Quick helper to check if a specific date is a teaching day
export function isTeachingDay(dateKey: string): boolean {
  const overrides = getCalendarOverrides();
  if (overrides[dateKey]) {
    return overrides[dateKey]!.isWorking;
  }
  return dateKey in BTECH_3RD_TEACHING_DAYS;
}

// Get the teaching day number (1 - 57) if applicable
export function getTeachingDayNumber(dateKey: string): number | null {
  const overrides = getCalendarOverrides();
  if (overrides[dateKey]) {
    return overrides[dateKey]!.isWorking ? (BTECH_3RD_TEACHING_DAYS[dateKey] ?? 99) : null;
  }
  return BTECH_3RD_TEACHING_DAYS[dateKey] ?? null;
}

// Get full day information for any date in the semester
export function getCalendarDayInfo(dateKey: string): CalendarDayInfo {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dateObj = new Date(Date.UTC(y!, m! - 1, d!));
  const dayOfWeek = (dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay()); // 1 (Mon) - 7 (Sun)

  // 0. Check custom user override
  const overrides = getCalendarOverrides();
  if (overrides[dateKey]) {
    const ov = overrides[dateKey]!;
    return {
      date: dateKey,
      dayOfWeek,
      type: ov.type,
      title: ov.title,
      description: ov.description ?? (ov.isWorking ? "Custom Working Day Override" : "Custom Off / Holiday Override"),
      isWorkingDay: ov.isWorking,
      dayNumber: ov.isWorking ? (BTECH_3RD_TEACHING_DAYS[dateKey] ?? 99) : undefined,
    };
  }

  // 1. Check for official holiday
  const holiday = getHolidayInfo(dateKey);
  if (holiday) {
    return {
      date: dateKey,
      dayOfWeek,
      type: "holiday",
      title: holiday.name,
      description: holiday.description,
      isWorkingDay: false,
    };
  }

  // 2.5 Check for Python Training working dates (Sept 7 to Sept 19, excluding Sept 14 Ganesh Chaturthi and Sept 13 Sunday)
  if (
    dateKey >= "2026-09-07" &&
    dateKey <= "2026-09-19" &&
    dateKey !== "2026-09-14" &&
    dateKey !== "2026-09-13"
  ) {
    return {
      date: dateKey,
      dayOfWeek,
      type: "training",
      title: dateKey === "2026-09-19" ? "Python Training (Saturday Working)" : "Python Training Day",
      description: "Confirmed working training day - 6 periods took place",
      isWorkingDay: true,
    };
  }

  // 2. Check for Sunday
  if (dayOfWeek === 7) {
    return {
      date: dateKey,
      dayOfWeek,
      type: "off",
      title: "Sunday",
      description: "Weekly Holiday",
      isWorkingDay: false,
    };
  }

  // 3. Check for teaching day
  const dayNumber = getTeachingDayNumber(dateKey);
  if (dayNumber !== null) {
    return {
      date: dateKey,
      dayOfWeek,
      type: "teaching",
      dayNumber,
      title: `Academic Day ${dayNumber}`,
      description: `Instructional Teaching Day ${dayNumber} of 57`,
      isWorkingDay: true,
    };
  }

  // 4. Check for MST Exams or Training
  for (const evt of SISTEC_ACADEMIC_EVENTS) {
    if (dateKey >= evt.startDate && dateKey <= evt.endDate) {
      return {
        date: dateKey,
        dayOfWeek,
        type: evt.type as CalendarDayType,
        title: evt.title,
        description: evt.description,
        isWorkingDay: evt.type === "exam",
      };
    }
  }

  // 5. Default non-working / alternate Saturday or break day
  return {
    date: dateKey,
    dayOfWeek,
    type: "off",
    title: dayOfWeek === 6 ? "Alternate Saturday Off" : "Non-Instructional Day",
    description: "No scheduled regular classes per academic calendar",
    isWorkingDay: false,
  };
}

// Summary stats of B.Tech 3rd academic semester
export const SISTEC_CALENDAR_SUMMARY = {
  semester: "B.Tech 3rd Semester",
  session: "AUG - DEC 2026",
  totalTeachingDays: 57,
  officialHolidaysCount: 10,
  teachingStart: "2026-09-21",
  teachingEnd: "2026-12-16",
  mst1: "23/11/2026 – 27/11/2026",
  mst2: "17/12/2026 – 23/12/2026",
  rgpvExam: "28/12/2026 – 31/12/2026",
};
