import React, { useState } from "react";
import { Link } from "wouter";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Info,
  PartyPopper,
  GraduationCap,
  Award,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/attendwise-design-system/components/ui/card";
import { Badge } from "@workspace/attendwise-design-system/components/ui/badge";
import { Button } from "@workspace/attendwise-design-system/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@workspace/attendwise-design-system/components/ui/alert";
import { Separator } from "@workspace/attendwise-design-system/components/ui/separator";
import {
  SISTEC_OFFICIAL_HOLIDAYS,
  SISTEC_ACADEMIC_EVENTS,
  SISTEC_CALENDAR_SUMMARY,
  getCalendarDayInfo,
  getHolidayInfo,
  getTeachingDayNumber,
  isTeachingDay,
  setCalendarOverride,
  type CalendarDayInfo,
} from "../data/sistec-calendar";
import { formatDateKey, TIMEZONE, syncSessionsForDate } from "../lib/firebase";

const MONTH_DATA = [
  { monthIndex: 7, name: "August 2026", year: 2026, monthNum: "08", days: 31 },
  { monthIndex: 8, name: "September 2026", year: 2026, monthNum: "09", days: 30 },
  { monthIndex: 9, name: "October 2026", year: 2026, monthNum: "10", days: 31 },
  { monthIndex: 10, name: "November 2026", year: 2026, monthNum: "11", days: 30 },
  { monthIndex: 11, name: "December 2026", year: 2026, monthNum: "12", days: 31 },
];

export default function AcademicCalendarView() {
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(2); // Default to October 2026 (index 2)
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDayForEdit, setSelectedDayForEdit] = useState<CalendarDayInfo | null>(null);

  React.useEffect(() => {
    const handleUpdate = () => setRefreshKey((k) => k + 1);
    window.addEventListener("sistec-calendar-updated", handleUpdate);
    return () => window.removeEventListener("sistec-calendar-updated", handleUpdate);
  }, []);

  const currentMonth = MONTH_DATA[selectedMonthIdx]!;

  const todayDateKey = formatDateKey(new Date());
  const todayInfo = getCalendarDayInfo(todayDateKey);

  // Generate grid days for current selected month
  // Monday = 1 ... Sunday = 7
  const firstDayOfMonth = new Date(Date.UTC(currentMonth.year, currentMonth.monthIndex, 1));
  const rawFirstWeekday = firstDayOfMonth.getUTCDay(); // 0 is Sun, 1 is Mon...
  const firstWeekday = rawFirstWeekday === 0 ? 7 : rawFirstWeekday; // 1 (Mon) - 7 (Sun)

  const daysInGrid: (CalendarDayInfo | null)[] = [];
  // Leading empty cells
  for (let i = 1; i < firstWeekday; i++) {
    daysInGrid.push(null);
  }

  for (let day = 1; day <= currentMonth.days; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateKey = `${currentMonth.year}-${currentMonth.monthNum}-${dayStr}`;
    daysInGrid.push(getCalendarDayInfo(dateKey));
  }

  // Trailing empty cells to fill grid row
  while (daysInGrid.length % 7 !== 0) {
    daysInGrid.push(null);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarRange className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Academic Calendar</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Sagar Institute of Science & Technology (SISTec) · Gandhi Nagar Campus, Bhopal
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
            B.Tech 3rd Sem · Session: Aug–Dec 2026
          </Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs">
            Python Training: 11 Days · 66 Classes
          </Badge>
          <Badge variant="outline" className="bg-muted text-xs">
            57 Academic Teaching Days
          </Badge>
        </div>
      </div>

      {/* Today's Status Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">Today's Academic Status</span>
                <span className="text-xs text-muted-foreground">({todayDateKey})</span>
                {todayInfo.type === "teaching" ? (
                  <Badge className="bg-primary text-primary-foreground text-xs font-semibold">
                    Teaching Day {todayInfo.dayNumber} of 57
                  </Badge>
                ) : todayInfo.type === "training" ? (
                  <Badge className="bg-amber-600 text-white text-xs font-semibold">
                    Python Training Day {todayInfo.dayNumber} of 11 (6 Periods)
                  </Badge>
                ) : todayInfo.type === "holiday" ? (
                  <Badge variant="destructive" className="text-xs font-semibold">
                    Holiday: {todayInfo.title}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {todayInfo.title}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {todayInfo.type === "teaching"
                  ? "Classes are scheduled per your timetable. Attendance window active during class hours."
                  : todayInfo.type === "training"
                  ? "Python Training day. 6 training periods scheduled. Treated as eligible regular classes."
                  : "No classes scheduled today. This day does not count toward your attendance totals."}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 text-xs">
            <Link
              href="/timetable"
              className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 font-medium border shadow-xs hover:bg-muted"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" /> View Timetable
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Python Training</p>
              <Sparkles className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600">66 Classes</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Sept 7–19 · 11 days (6 periods/day)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Teaching Days</p>
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">57 Days</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Numbered instructional teaching days</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Official Holidays</p>
              <PartyPopper className="h-4 w-4 text-destructive" />
            </div>
            <p className="mt-2 text-2xl font-bold text-destructive">10 Holidays</p>
            <p className="mt-1 text-[11px] text-muted-foreground">0 classes held · Excluded from attendance</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Mid-Semester Test I</p>
              <Award className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-lg font-bold text-emerald-600">23 – 27 Nov</p>
            <p className="mt-1 text-[11px] text-muted-foreground">MST-I Examinations (5 days)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Mid-Semester Test II</p>
              <Award className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-lg font-bold text-emerald-600">17 – 23 Dec</p>
            <p className="mt-1 text-[11px] text-muted-foreground">MST-II Examinations</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Calendar Card */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <CardTitle className="text-lg">Semester Calendar View</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Source: SISTec Gandhi Nagar Academic Calendar (Session: AUG-DEC 2026)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={selectedMonthIdx === 0}
              onClick={() => setSelectedMonthIdx((p) => Math.max(0, p - 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center font-semibold text-sm">
              {currentMonth.name}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={selectedMonthIdx === MONTH_DATA.length - 1}
              onClick={() => setSelectedMonthIdx((p) => Math.min(MONTH_DATA.length - 1, p + 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-muted-foreground mb-2">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div className="text-foreground">Sat</div>
            <div className="text-destructive/80">Sun</div>
          </div>

          {/* Month Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {daysInGrid.map((dayInfo, idx) => {
              if (!dayInfo) {
                return <div key={`empty-${idx}`} className="h-20 sm:h-24 rounded-lg bg-muted/20" />;
              }

              const isToday = dayInfo.date === todayDateKey;
              const isTeaching = dayInfo.type === "teaching";
              const isHoliday = dayInfo.type === "holiday";
              const isExam = dayInfo.type === "exam";
              const isTraining = dayInfo.type === "training";
              const dayNum = parseInt(dayInfo.date.split("-")[2]!, 10);

              let bgClasses = "bg-card border hover:border-primary/40";
              if (isToday) {
                bgClasses = "border-primary bg-primary/5 ring-2 ring-primary/30";
              } else if (isHoliday) {
                bgClasses = "border-destructive/30 bg-destructive/10 text-destructive";
              } else if (isExam) {
                bgClasses = "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
              } else if (isTraining) {
                bgClasses = "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
              } else if (isTeaching) {
                bgClasses = "border-primary/20 bg-card hover:bg-muted/40";
              } else {
                bgClasses = "border-border/60 bg-muted/30 text-muted-foreground";
              }

              return (
                <div
                  key={dayInfo.date}
                  onClick={() => setSelectedDayForEdit(dayInfo)}
                  className={`min-h-20 sm:min-h-24 p-1.5 sm:p-2 rounded-lg flex flex-col justify-between transition-all cursor-pointer hover:ring-2 hover:ring-primary/50 ${bgClasses}`}
                  title="Click to edit date status (Working / Off / Holiday)"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday ? "rounded-full bg-primary text-primary-foreground h-5 w-5 flex items-center justify-center" : ""
                      }`}
                    >
                      {dayNum}
                    </span>
                    {isTeaching && dayInfo.dayNumber ? (
                      <span className="text-[10px] font-mono font-semibold px-1 rounded bg-primary/10 text-primary">
                        Day {dayInfo.dayNumber}
                      </span>
                    ) : isTraining && dayInfo.dayNumber ? (
                      <span className="text-[10px] font-mono font-semibold px-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Day {dayInfo.dayNumber}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1">
                    {isHoliday ? (
                      <p className="text-[10px] sm:text-[11px] font-semibold leading-tight text-destructive truncate">
                        {dayInfo.title}
                      </p>
                    ) : isExam ? (
                      <p className="text-[10px] sm:text-[11px] font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        {dayInfo.title}
                      </p>
                    ) : isTraining ? (
                      <p className="text-[10px] sm:text-[11px] font-semibold leading-tight text-amber-700 dark:text-amber-300">
                        Python Training
                      </p>
                    ) : isTeaching ? (
                      <p className="text-[10px] text-muted-foreground hidden sm:block">6 Slots Scheduled</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/70 hidden sm:block">No Classes</p>
                    )}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                    {isTeaching ? (
                      <span className="text-primary font-medium">Working</span>
                    ) : isTraining ? (
                      <span className="text-amber-700 dark:text-amber-300 font-semibold">6 Training Slots</span>
                    ) : (
                      <span>{dayInfo.dayOfWeek === 7 ? "Sunday" : "Off"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-5 text-xs text-muted-foreground border-t pt-4">
            <span className="font-semibold text-foreground">Calendar Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-primary/40 bg-card" />
              <span>Teaching Day (Days 1–57)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-destructive/20 border border-destructive/40" />
              <span className="text-destructive font-medium">Official Holiday (No classes)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-500/20 border border-emerald-500/40" />
              <span>MST-I / MST-II Exam</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-500/20 border border-amber-500/40" />
              <span>Training</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-muted/50 border" />
              <span>Sunday / Alternate Sat Off</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Official Holidays Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PartyPopper className="h-4 w-4 text-destructive" /> Official College Holidays (AUG – DEC 2026)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              These dates have zero scheduled classes and are strictly excluded from attendance calculations.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {SISTEC_OFFICIAL_HOLIDAYS.map((h, i) => {
              const isUpcoming = todayDateKey <= h.endDate;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-3 text-xs transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{h.name}</p>
                      {isUpcoming ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          Upcoming
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Passed
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{h.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-medium text-xs text-destructive">{h.date}</span>
                    <span className="block text-[10px] text-muted-foreground">0 Classes</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Academic Rules & Attendance Policy */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Attendance & Holiday Integrity Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <div className="rounded-lg bg-muted/50 p-3">
                <span className="font-semibold text-foreground block mb-1">
                  Holiday Exemption Guarantee
                </span>
                When a holiday occurs (e.g. Gandhi Jayanti, Durga Navmi, Diwali, Gas Tragedy, Christmas), no class sessions are created. Your attendance denominator is unaffected and never penalized.
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <span className="font-semibold text-foreground block mb-1">
                  Attendance Formula
                </span>
                <code className="text-xs font-mono bg-background px-2 py-1 rounded border block mt-1">
                  Attendance % = (Classes Present / Total Finalized Classes Held) × 100
                </code>
                Cancelled classes, holidays, and Sundays are excluded from both numerator and denominator.
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <span className="font-semibold text-foreground block mb-1">
                  B.Tech 3rd Semester Milestone Dates
                </span>
                <ul className="space-y-1 mt-1">
                  <li>• Teaching Commencement: 21 September 2026 (Day 1)</li>
                  <li>• MST-I Mid-Sem Exams: 23 – 27 November 2026</li>
                  <li>• Teaching Concludes: 16 December 2026 (Day 57)</li>
                  <li>• MST-II Mid-Sem Exams: 17 – 23 December 2026</li>
                  <li>• RGPV Final Exams: 28 – 31 December 2026</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Date Edit Modal Dialog */}
      {selectedDayForEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" /> Edit Calendar Date
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedDayForEdit.date}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Customize working status or holidays. Automatic synchronization will update all classes and attendance records instantly.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Title:</span>
                  <span className="font-semibold text-foreground">{selectedDayForEdit.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`font-semibold ${selectedDayForEdit.isWorkingDay ? "text-primary" : "text-destructive"}`}>
                    {selectedDayForEdit.isWorkingDay ? "Working Day" : "Off / Non-Working"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Button
                  className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    setCalendarOverride(selectedDayForEdit.date, {
                      date: selectedDayForEdit.date,
                      isWorking: true,
                      type: "teaching",
                      title: "Custom Working Day",
                      description: "Manually set as working day by student",
                    });
                    syncSessionsForDate(selectedDayForEdit.date, true);
                    setSelectedDayForEdit(null);
                  }}
                >
                  <GraduationCap className="h-4 w-4" />
                  Set as Working Day (Show Classes)
                </Button>

                <Button
                  variant="destructive"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    setCalendarOverride(selectedDayForEdit.date, {
                      date: selectedDayForEdit.date,
                      isWorking: false,
                      type: "off",
                      title: "Custom Off Day",
                      description: "Manually set as off day by student",
                    });
                    syncSessionsForDate(selectedDayForEdit.date, false);
                    setSelectedDayForEdit(null);
                  }}
                >
                  <PartyPopper className="h-4 w-4" />
                  Set as Off / Holiday (Exclude Classes)
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-muted-foreground"
                  onClick={() => {
                    setCalendarOverride(selectedDayForEdit.date, null);
                    syncSessionsForDate(selectedDayForEdit.date, true);
                    setSelectedDayForEdit(null);
                  }}
                >
                  Reset to Default Academic Calendar
                </Button>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDayForEdit(null)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
