import { useState, useMemo, useEffect } from "react";
import {
  Layers,
  TableProperties,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCheck,
  X,
} from "lucide-react";
import { Button } from "@workspace/attendwise-design-system/components/ui/button";
import { Badge } from "@workspace/attendwise-design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/attendwise-design-system/components/ui/card";
import { Checkbox } from "@workspace/attendwise-design-system/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/attendwise-design-system/components/ui/select";
import { toast } from "sonner";
import type {
  ClassSessionItem,
  SubjectItem,
  StudentProfile,
} from "../lib/firebase";
import { resolveSessionEvidenceUrl } from "../lib/firebase";
import {
  exportConsolidatedAttendancePDF,
  type AttendanceReportFilterCriteria,
} from "../lib/attendance-report-generator";

export interface AttendanceHistoryContentProps {
  sessions: ClassSessionItem[];
  filteredSessions: ClassSessionItem[];
  subjects: SubjectItem[];
  user?: { uid: string; displayName?: string | null; email?: string | null } | null;
  profile?: StudentProfile | null;
  filters: AttendanceReportFilterCriteria;
  isAnyFilterActive: boolean;
  activeFilterSummary: string;
  todayKey: string;
  sessionsInitialLoading?: boolean;
  onOpenCard: (session: ClassSessionItem) => void;
  onViewPhoto: (url: string, captureTime?: string | null, session?: ClassSessionItem) => void;
  renderEvidenceRow: (session: ClassSessionItem) => React.ReactNode;
  renderStatusBadge: (status: string) => React.ReactNode;
  statusLabelFn: (session: ClassSessionItem) => string;
  formatDateFn: (val?: unknown) => string;
  formatClockFn: (val?: unknown) => string;
}

export function AttendanceHistoryContent({
  filteredSessions,
  subjects,
  user,
  profile,
  filters,
  isAnyFilterActive,
  activeFilterSummary,
  todayKey,
  sessionsInitialLoading = false,
  onOpenCard,
  renderEvidenceRow,
  renderStatusBadge,
  statusLabelFn,
  formatDateFn,
  formatClockFn,
}: AttendanceHistoryContentProps) {
  // Selection state for multiple classes across all pagination pages
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  // Export loading indicator
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Automatically prune stale selections whenever filters or filteredSessions change
  useEffect(() => {
    const validIdSet = new Set(filteredSessions.map((s) => s.id));
    setSelectedIds((prev) => {
      const pruned = prev.filter((id) => validIdSet.has(id));
      if (pruned.length === prev.length) return prev;
      return pruned;
    });
    // Reset to page 1 on filter changes
    setCurrentPage(1);
  }, [filters, filteredSessions]);

  // Selected sessions strictly matching the active filter criteria
  const selectedFilteredSessions = useMemo(() => {
    const idSet = new Set(selectedIds);
    return filteredSessions.filter((s) => idSet.has(s.id));
  }, [filteredSessions, selectedIds]);

  const isAllSelected =
    filteredSessions.length > 0 &&
    selectedFilteredSessions.length === filteredSessions.length;

  const isSomeSelected =
    selectedFilteredSessions.length > 0 && !isAllSelected;

  // Toggle select all filtered classes
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSessions.map((s) => s.id));
    }
  };

  // Toggle individual class selection
  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Deselect all
  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Pagination calculation
  const effectivePageSize = pageSize === 0 ? filteredSessions.length : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / (effectivePageSize || 1)));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (activePage - 1) * effectivePageSize;
  const endIndex = Math.min(startIndex + effectivePageSize, filteredSessions.length);
  const pageSessions = useMemo(() => {
    if (pageSize === 0) return filteredSessions;
    return filteredSessions.slice(startIndex, endIndex);
  }, [filteredSessions, startIndex, endIndex, pageSize]);

  // Generate and download ONE consolidated PDF for all selected classes
  const handleExportPDF = async () => {
    if (selectedFilteredSessions.length === 0) {
      toast.error("Please select at least one class to export.");
      return;
    }

    setIsExportingPdf(true);
    const toastId = toast.loading(
      `Preparing single consolidated PDF report for ${selectedFilteredSessions.length} classes...`
    );

    try {
      // Resolve evidence photos if available in storage or remote
      const resolvedSessions = await Promise.all(
        selectedFilteredSessions.map(async (session) => {
          if (session.photoDataUrl && session.photoDataUrl.startsWith("data:")) {
            return session;
          }
          try {
            const url = await resolveSessionEvidenceUrl(
              session.studentId || user?.uid || "",
              session
            );
            if (url) {
              return { ...session, photoDataUrl: url };
            }
          } catch (e) {
            console.warn("Evidence photo resolution notice:", e);
          }
          return session;
        })
      );

      const result = await exportConsolidatedAttendancePDF({
        studentName: profile?.displayName || user?.displayName || "Student",
        studentEmail: profile?.email || user?.email || "",
        institution: profile?.institution || "Sagar Institute of Science and Technology (SISTec)",
        course: profile?.course || "B.Tech Computer Science & Engineering (3rd Semester)",
        filters,
        subjects,
        selectedSessions: resolvedSessions,
        allFilteredCount: filteredSessions.length,
      });

      toast.success(
        `Successfully generated single consolidated PDF report (${result.totalClasses} classes included)!`,
        { id: toastId }
      );
    } catch (err: unknown) {
      console.error("PDF export error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`PDF export failed: ${msg}`, { id: toastId });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <Card className="shadow-xs border">
      <CardHeader className="flex flex-col gap-3 pb-3">
        {/* Header Title & Filter Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" /> Total Classes:
            </CardTitle>
            <Badge
              variant="secondary"
              className="font-mono text-xs font-bold px-2.5 py-0.5 bg-primary/10 text-primary border-primary/20"
            >
              {filteredSessions.length} {filteredSessions.length === 1 ? "Class" : "Classes"}
            </Badge>
            {isAnyFilterActive ? (
              <span className="text-[11px] text-muted-foreground font-medium">
                (Filtered by: <strong className="text-foreground font-medium">{activeFilterSummary}</strong>)
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                (All scheduled classes)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
            <span className="text-muted-foreground text-[10px]">Breakdown:</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {filteredSessions.filter((s) => s.personalStatus === "present").length} Present
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {filteredSessions.filter((s) => s.personalStatus === "absent").length} Absent
            </Badge>
            {filteredSessions.filter((s) => s.personalStatus === "frozen").length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300"
              >
                {filteredSessions.filter((s) => s.personalStatus === "frozen").length} Frozen
              </Badge>
            )}
            {filteredSessions.filter((s) => s.personalStatus === "upcoming").length > 0 && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {filteredSessions.filter((s) => s.personalStatus === "upcoming").length} Upcoming
              </Badge>
            )}
          </div>
        </div>

        {/* Consolidated Multi-Selection & Report Export Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-primary/10">
          {/* Left: Select All & Selection Counter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-filtered-classes"
                checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                onCheckedChange={handleToggleSelectAll}
                disabled={filteredSessions.length === 0}
                aria-label="Select All Filtered Classes"
                className="cursor-pointer"
              />
              <label
                htmlFor="select-all-filtered-classes"
                className="text-xs font-semibold cursor-pointer select-none text-foreground flex items-center gap-1.5"
              >
                Select All Filtered Classes
                <span className="text-[11px] text-muted-foreground font-normal">
                  ({filteredSessions.length})
                </span>
              </label>
            </div>

            {/* Selection Counter */}
            <Badge
              variant={selectedFilteredSessions.length > 0 ? "default" : "outline"}
              className={`text-[11px] px-2 py-0.5 font-medium transition-colors ${
                selectedFilteredSessions.length > 0
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {selectedFilteredSessions.length} of {filteredSessions.length} classes selected
            </Badge>

            {selectedFilteredSessions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" /> Clear selection
              </Button>
            )}
          </div>

          {/* Right: Consolidated Export Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleExportPDF}
              disabled={selectedFilteredSessions.length === 0 || isExportingPdf}
              className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs cursor-pointer"
              title="Generate and download one consolidated PDF containing all selected classes"
            >
              {isExportingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              Export Selected Classes as One PDF
              {selectedFilteredSessions.length > 0 && (
                <span className="ml-0.5 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono">
                  {selectedFilteredSessions.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Pagination Bar (Top) */}
        {filteredSessions.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground pt-1 px-1">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-foreground">{startIndex + 1}</strong>–<strong className="text-foreground">{endIndex}</strong> of <strong className="text-foreground">{filteredSessions.length}</strong> classes
              </span>
              {pageSize !== 0 && totalPages > 1 && (
                <span>
                  · Page <strong className="text-foreground">{activePage}</strong> of <strong className="text-foreground">{totalPages}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Show:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 w-[95px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="15">15 / page</SelectItem>
                    <SelectItem value="25">25 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="0">All classes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pageSize !== 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={activePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={activePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next Page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {filteredSessions.length ? (
          <div className="divide-y border-t">
            {pageSessions.map((session) => {
              const statusLabel = statusLabelFn(session);
              const isToday = session.scheduledDate === todayKey;
              const isSelected = selectedIds.includes(session.id);

              return (
                <div
                  key={session.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 transition-colors ${
                    isSelected
                      ? "bg-primary/[0.04] dark:bg-primary/[0.08] border-l-2 border-l-primary"
                      : "hover:bg-muted/40"
                  }`}
                >
                  {/* Left: Checkbox & Session Details */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="pt-0.5 shrink-0">
                      <Checkbox
                        id={`select-session-${session.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelectOne(session.id)}
                        aria-label={`Select ${session.subjectName}`}
                        className="cursor-pointer"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex h-5 w-7 items-center justify-center rounded bg-primary/10 text-primary font-mono font-bold text-[11px]">
                          {session.slot}
                        </span>
                        <p className="font-semibold text-sm truncate">{session.subjectName}</p>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {session.subjectCode}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {session.category}
                        </Badge>
                        {session.academicDayNumber ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-primary/5 text-primary border-primary/20"
                          >
                            Day {session.academicDayNumber}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{formatDateFn(session.scheduledDate)}</span>
                        <span>·</span>
                        <span>
                          {formatClockFn(session.scheduledStartAt)} – {formatClockFn(session.scheduledEndAt)} IST
                        </span>
                        {session.room ? <span>· Room: {session.room}</span> : null}
                      </div>

                      {(session.photoDataUrl ||
                        session.evidenceStoragePath ||
                        session.evidenceAvailable ||
                        session.note) ? (
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {(session.photoDataUrl ||
                            session.evidenceStoragePath ||
                            session.evidenceAvailable) &&
                            renderEvidenceRow(session)}
                          {session.note && (
                            <span className="text-[11px] text-primary font-medium bg-primary/5 px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1">
                              💬 Keynote: {session.note}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Right: Badges & View Card Button */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:self-center self-end pl-7 sm:pl-0">
                    {sessionsInitialLoading &&
                    session.personalStatus !== "present" &&
                    session.personalStatus !== "frozen" ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground animate-pulse">
                        Syncing cloud...
                      </Badge>
                    ) : (
                      renderStatusBadge(statusLabel)
                    )}

                    {session.erpStatus ? (
                      <Badge
                        variant="outline"
                        className={
                          session.erpStatus === "Present"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium"
                            : "bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-medium"
                        }
                      >
                        ERP: {session.erpStatus} (Locked)
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">ERP Not Recorded</span>
                    )}

                    <Button
                      size="sm"
                      variant={isToday ? "default" : "outline"}
                      className={`text-xs h-7 gap-1 shadow-xs font-medium ${
                        isToday ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""
                      }`}
                      onClick={() => onOpenCard(session)}
                    >
                      <TableProperties className="h-3 w-3" />
                      {isToday ? "Enter Attendance Card" : "View Card"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Bottom Pagination Bar when multiple pages exist */}
        {filteredSessions.length > 0 && pageSize !== 0 && totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
            <span>
              Page <strong className="text-foreground">{activePage}</strong> of <strong className="text-foreground">{totalPages}</strong> ({filteredSessions.length} total classes)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={activePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3 w-3 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={activePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
