import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";
import {
  AttendWiseStoreError,
  cancelSession,
  createSubject,
  createTimetableEntry,
  deleteSubject,
  deleteTimetableEntry,
  endDemoSession,
  getAttendanceHistory,
  getDashboardSummary,
  getDemoSession,
  getErpComparison,
  getProfile,
  getSession,
  getSessionEvents,
  getSubjectAttendance,
  getTodayDashboard,
  listSessions,
  listSubjects,
  listTimetable,
  markPresent,
  recordErpStatus,
  startDemoSession,
  updateSubject,
  updateTimetableEntry,
} from "../lib/attendwise-store";

const router: IRouter = Router();

function handleStoreError(err: unknown, res: Response) {
  if (err instanceof AttendWiseStoreError) {
    if (err.code === "not_found") return res.status(404).json({ error: err.message });
    if (err.code === "conflict") return res.status(409).json({ error: err.message });
    if (err.code === "outside_window") return res.status(422).json({ error: err.message });
    return res.status(400).json({ error: err.message });
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  return res.status(500).json({ error: message });
}

router.use(healthRouter);

// Demo session & profile
router.get("/demo/session", (_req: Request, res: Response) => {
  res.json(getDemoSession());
});

router.post("/demo/session", (_req: Request, res: Response) => {
  res.json(startDemoSession());
});

router.delete("/demo/session", (_req: Request, res: Response) => {
  res.json(endDemoSession());
});

router.get("/demo/profile", (_req: Request, res: Response) => {
  res.json(getProfile());
});

// Dashboard
router.get("/dashboard/summary", (_req: Request, res: Response) => {
  res.json(getDashboardSummary());
});

router.get("/dashboard/today", (_req: Request, res: Response) => {
  res.json(getTodayDashboard());
});

// Subjects
router.get("/subjects", (_req: Request, res: Response) => {
  res.json(listSubjects());
});

router.post("/subjects", (req: Request, res: Response) => {
  try {
    const created = createSubject(req.body);
    res.status(201).json(created);
  } catch (err) {
    handleStoreError(err, res);
  }
});

router.patch("/subjects/:subjectId", (req: Request, res: Response) => {
  try {
    const updated = updateSubject(req.params.subjectId, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Subject not found." });
    }
    res.json(updated);
  } catch (err) {
    handleStoreError(err, res);
  }
});

router.delete("/subjects/:subjectId", (req: Request, res: Response) => {
  const ok = deleteSubject(req.params.subjectId);
  if (!ok) {
    return res.status(404).json({ error: "Subject not found." });
  }
  res.status(204).end();
});

// Timetable
router.get("/timetable", (_req: Request, res: Response) => {
  res.json(listTimetable());
});

router.post("/timetable", (req: Request, res: Response) => {
  try {
    const created = createTimetableEntry(req.body);
    res.status(201).json(created);
  } catch (err) {
    handleStoreError(err, res);
  }
});

router.patch("/timetable/:entryId", (req: Request, res: Response) => {
  try {
    const updated = updateTimetableEntry(req.params.entryId, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Timetable entry not found." });
    }
    res.json(updated);
  } catch (err) {
    handleStoreError(err, res);
  }
});

router.delete("/timetable/:entryId", (req: Request, res: Response) => {
  const ok = deleteTimetableEntry(req.params.entryId);
  if (!ok) {
    return res.status(404).json({ error: "Timetable entry not found." });
  }
  res.status(204).end();
});

// Sessions
router.get("/sessions", (req: Request, res: Response) => {
  const { from, to, subjectId, category, personalStatus, comparisonStatus } = req.query as Record<string, string | undefined>;
  const sessions = listSessions({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    subjectId,
    category: category as any,
    personalStatus: personalStatus as any,
    comparisonStatus: comparisonStatus as any,
  });
  res.json(sessions);
});

router.get("/sessions/:sessionId", (req: Request, res: Response) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }
  res.json(session);
});

router.post("/sessions/:sessionId/mark-present", (req: Request, res: Response) => {
  try {
    const result = markPresent(req.params.sessionId, req.body);
    res.json(result.session);
  } catch (err) {
    handleStoreError(err, res);
  }
});

router.post("/sessions/:sessionId/erp-status", (req: Request, res: Response) => {
  try {
    const session = recordErpStatus(req.params.sessionId, req.body.status);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    res.json(session);
  } catch (err) {
    handleStoreError(err, res);
  }
});

router.post("/sessions/:sessionId/cancel", (_req: Request, res: Response) => {
  try {
    const session = cancelSession(_req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    res.json(session);
  } catch (err) {
    handleStoreError(err, res);
  }
});

router.get("/sessions/:sessionId/events", (req: Request, res: Response) => {
  const events = getSessionEvents(req.params.sessionId);
  if (!events) {
    return res.status(404).json({ error: "Session not found." });
  }
  res.json(events);
});

// Attendance summary, comparison, history
router.get("/attendance/subjects", (_req: Request, res: Response) => {
  res.json(getSubjectAttendance());
});

router.get("/attendance/comparison", (_req: Request, res: Response) => {
  res.json(getErpComparison());
});

router.get("/attendance/history", (req: Request, res: Response) => {
  const { from, to, subjectId, category, personalStatus, comparisonStatus } = req.query as Record<string, string | undefined>;
  const history = getAttendanceHistory({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    subjectId,
    category: category as any,
    personalStatus: personalStatus as any,
    comparisonStatus: comparisonStatus as any,
  });
  res.json(history);
});

export default router;
