import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ClassSessionItem, SubjectItem } from "./firebase";

export interface AttendanceReportFilterCriteria {
  subjectId?: string;
  category?: string;
  personalStatus?: string;
  erpStatus?: string;
  from?: string;
  to?: string;
}

export interface AttendanceReportOptions {
  studentName: string;
  studentEmail: string;
  institution?: string;
  course?: string;
  filters: AttendanceReportFilterCriteria;
  subjects: SubjectItem[];
  selectedSessions: ClassSessionItem[];
  allFilteredCount: number;
}

// Format date in IST
export function formatISTDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
    }
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

// Format timestamp in IST
export function formatISTDateTime(isoStr?: string | null): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return (
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(d) + " IST"
    );
  } catch {
    return isoStr;
  }
}

// Format time only in IST
export function formatISTTime(isoStr?: string | null): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return isoStr;
  }
}

// Generate human-readable filter criteria string
export function describeFilterCriteria(
  filters: AttendanceReportFilterCriteria,
  subjects: SubjectItem[]
): string {
  const parts: string[] = [];

  if (filters.subjectId) {
    const s = subjects.find((sub) => sub.id === filters.subjectId);
    parts.push(`Subject: ${s ? `${s.name} (${s.code})` : filters.subjectId}`);
  } else {
    parts.push("Subject: All Subjects");
  }

  if (filters.category) {
    parts.push(`Category: ${filters.category}`);
  } else {
    parts.push("Category: All Classes (Theory & Practical)");
  }

  if (filters.personalStatus) {
    const labelMap: Record<string, string> = {
      in_run: "In Run (Active Window)",
      upcoming: "Upcoming",
      present: "Present",
      absent: "Absent",
      frozen: "Class Frozen (Excluded)",
      cancelled: "Cancelled",
    };
    parts.push(`Personal Status: ${labelMap[filters.personalStatus] || filters.personalStatus}`);
  } else {
    parts.push("Personal Status: All Personal Statuses");
  }

  if (filters.erpStatus) {
    const erpMap: Record<string, string> = {
      Present: "ERP Present",
      Absent: "ERP Absent",
      not_entered: "ERP Not Entered",
    };
    parts.push(`ERP Status: ${erpMap[filters.erpStatus] || filters.erpStatus}`);
  } else {
    parts.push("ERP Status: All ERP Statuses");
  }

  if (filters.from && filters.to) {
    parts.push(`Date Range: ${formatISTDate(filters.from)} to ${formatISTDate(filters.to)}`);
  } else if (filters.from) {
    parts.push(`Date Range: From ${formatISTDate(filters.from)} onwards`);
  } else if (filters.to) {
    parts.push(`Date Range: Up to ${formatISTDate(filters.to)}`);
  } else {
    parts.push("Date Range: All Scheduled Dates");
  }

  return parts.join("  |  ");
}

/**
 * Generate and download exactly ONE consolidated PDF containing every selected class,
 * with each class represented in its own clearly labelled section and all available
 * associated data and original photo evidence.
 */
export async function exportConsolidatedAttendancePDF(
  options: AttendanceReportOptions
): Promise<{ success: boolean; reportId: string; totalClasses: number; filename: string }> {
  const {
    studentName,
    studentEmail,
    institution = "Sagar Institute of Science and Technology (SISTec)",
    course = "B.Tech Computer Science & Engineering (3rd Semester)",
    filters,
    subjects,
    selectedSessions,
  } = options;

  if (!selectedSessions || selectedSessions.length === 0) {
    throw new Error("No classes selected for report generation. Please select at least one class.");
  }

  // Sort selected sessions chronologically (or reverse chronologically: newest to oldest)
  const sortedSessions = [...selectedSessions].sort(
    (a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime()
  );

  const reportId = `AW-REP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase()}`;
  const nowIST = formatISTDateTime(new Date().toISOString());
  const filterSummary = describeFilterCriteria(filters, subjects);

  // Initialize jsPDF (A4 portrait, mm units)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Colors
  const navy = [26, 43, 76]; // Primary dark
  const blue = [37, 99, 235]; // Accent blue
  const slateDark = [51, 65, 85];
  const slateLight = [241, 245, 249];
  const borderGray = [226, 232, 240];
  const emeraldGreen = [16, 149, 93];
  const roseRed = [225, 29, 72];
  const skyBlue = [2, 132, 199];
  const amberOrange = [217, 119, 6];

  // ==========================================
  // PAGE 1: OFFICIAL COVER & AUDIT SUMMARY
  // ==========================================

  // Top Banner
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, pageWidth, 42, "F");

  // Accent Line
  doc.setFillColor(blue[0], blue[1], blue[2]);
  doc.rect(0, 42, pageWidth, 2.5, "F");

  // Title in Banner
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ATTENDWISE · CONSOLIDATED ATTENDANCE REPORT", margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(219, 234, 254);
  doc.text("OFFICIAL ATTENDANCE AUDIT & EVIDENCE DOSSIER", margin, 26);
  doc.text(`${institution} · ${course}`, margin, 34);

  // Report Badge / ID in banner top-right
  doc.setFont("courier", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`REPORT ID: ${reportId}`, pageWidth - margin, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${nowIST}`, pageWidth - margin, 26, { align: "right" });
  doc.text(`Total Records: ${sortedSessions.length} Classes`, pageWidth - margin, 34, { align: "right" });

  let curY = 52;

  // Metadata Card
  doc.setFillColor(slateLight[0], slateLight[1], slateLight[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, curY, contentWidth, 34, 2, 2, "FD");

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("AUDIT REPORT METADATA & RECIPIENT INFORMATION", margin + 4, curY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);

  doc.text(`Student Name:`, margin + 4, curY + 13);
  doc.setFont("helvetica", "bold");
  doc.text(`${studentName}`, margin + 26, curY + 13);
  doc.setFont("helvetica", "normal");

  doc.text(`Student Email:`, margin + 95, curY + 13);
  doc.setFont("helvetica", "bold");
  doc.text(`${studentEmail}`, margin + 116, curY + 13);
  doc.setFont("helvetica", "normal");

  doc.text(`Institution:`, margin + 4, curY + 19);
  doc.text(`${institution}`, margin + 26, curY + 19);

  doc.text(`Academic Scope:`, margin + 95, curY + 19);
  doc.text(`${course}`, margin + 120, curY + 19);

  doc.text(`Report Generation:`, margin + 4, curY + 25);
  doc.setFont("helvetica", "bold");
  doc.text(`${nowIST}`, margin + 32, curY + 25);
  doc.setFont("helvetica", "normal");

  doc.text(`Classes Included:`, margin + 95, curY + 25);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(blue[0], blue[1], blue[2]);
  doc.text(`${sortedSessions.length} Classes Selected`, margin + 122, curY + 25);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.setFont("helvetica", "normal");

  doc.text(`Applied Filters:`, margin + 4, curY + 31);
  const filterSplit = doc.splitTextToSize(filterSummary, contentWidth - 30);
  doc.setFont("helvetica", "italic");
  doc.text(filterSplit[0] || "All Classes", margin + 26, curY + 31);

  // ==========================================
  // CONSOLIDATED CLASSES SUMMARY TABLE (Starting on Page 1)
  // ==========================================
  const tableStartY = 92;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text("CONSOLIDATED CLASSES SUMMARY TABLE", margin, tableStartY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text(
    `Index of all ${sortedSessions.length} included class sessions · Report ID: ${reportId} · Generated: ${nowIST}`,
    margin,
    tableStartY + 4.5
  );

  const tableRows = sortedSessions.map((session, idx) => {
    const awStatus =
      session.personalStatus === "present"
        ? "Present"
        : session.personalStatus === "absent"
        ? "Absent"
        : session.personalStatus === "frozen"
        ? "Frozen"
        : session.personalStatus === "cancelled"
        ? "Cancelled"
        : "Upcoming";

    const erp =
      session.erpStatus === "Present"
        ? "Present"
        : session.erpStatus === "Absent"
        ? "Absent"
        : "Not Entered";

    const hasPhoto = Boolean(session.photoDataUrl || session.evidenceStoragePath || session.evidenceAvailable);
    const photoText = hasPhoto ? "Photo Attached" : "None";
    const noteText = session.note && session.note.trim() ? session.note.trim() : "—";

    const timingStr = `${formatISTTime(session.scheduledStartAt)} - ${formatISTTime(session.scheduledEndAt)}`;

    return [
      String(idx + 1),
      session.scheduledDate,
      session.slot || "—",
      timingStr,
      `${session.subjectCode}\n${session.subjectName}`,
      session.category || "Theory",
      awStatus,
      session.serverReceiptAt ? formatISTDateTime(session.serverReceiptAt) : (session.finalizedAt ? formatISTDateTime(session.finalizedAt) : "—"),
      erp,
      session.erpRecordedAt ? formatISTDateTime(session.erpRecordedAt) : "—",
      noteText.length > 25 ? `${noteText.substring(0, 25)}…` : noteText,
      photoText,
    ];
  });

  autoTable(doc, {
    startY: tableStartY + 7,
    head: [
      [
        "#",
        "Date",
        "Slot",
        "Time (IST)",
        "Subject (Code & Name)",
        "Type",
        "AttendWise",
        "AW Marked At (IST)",
        "ERP Status",
        "ERP Recorded (IST)",
        "Keynote",
        "Evidence",
      ],
    ],
    body: tableRows,
    theme: "grid",
    styles: {
      fontSize: 6.5,
      cellPadding: 1.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [51, 65, 85],
      valign: "middle",
    },
    headStyles: {
      fillColor: [26, 43, 76],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 6 },
      1: { halign: "center", cellWidth: 15 },
      2: { halign: "center", cellWidth: 9 },
      3: { halign: "center", cellWidth: 17 },
      4: { cellWidth: 29 },
      5: { halign: "center", cellWidth: 12 },
      6: { halign: "center", cellWidth: 14 },
      7: { cellWidth: 19, fontSize: 5.5 },
      8: { halign: "center", cellWidth: 14 },
      9: { cellWidth: 18, fontSize: 5.5 },
      10: { cellWidth: 16, fontSize: 5.5 },
      11: { halign: "center", cellWidth: 13, fontSize: 6 },
    },
    didParseCell: (data) => {
      // Color-code AttendWise & ERP status cells
      if (data.section === "body") {
        if (data.column.index === 6) {
          if (data.cell.raw === "Present") {
            data.cell.styles.textColor = [16, 149, 93];
            data.cell.styles.fontStyle = "bold";
          } else if (data.cell.raw === "Absent") {
            data.cell.styles.textColor = [225, 29, 72];
            data.cell.styles.fontStyle = "bold";
          } else if (data.cell.raw === "Frozen") {
            data.cell.styles.textColor = [2, 132, 199];
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.column.index === 8) {
          if (data.cell.raw === "Present") {
            data.cell.styles.textColor = [16, 149, 93];
            data.cell.styles.fontStyle = "bold";
          } else if (data.cell.raw === "Absent") {
            data.cell.styles.textColor = [225, 29, 72];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [161, 98, 7];
            data.cell.styles.fontStyle = "italic";
          }
        }
      }
    },
    margin: { left: margin, right: margin, top: 18, bottom: 15 },
  });

  // ==========================================
  // DETAILED CLASS-BY-CLASS SECTIONS
  // ==========================================
  // Start on a fresh page for detailed records
  doc.addPage();

  let sectionY = 20;

  for (let i = 0; i < sortedSessions.length; i++) {
    const session = sortedSessions[i]!;
    const classNumber = i + 1;
    const hasPhoto = Boolean(session.photoDataUrl && session.photoDataUrl.startsWith("data:"));
    const boxHeight = hasPhoto ? 68 : 46;
    const estimatedHeight = boxHeight + 15;

    // Check if we need a new page for this class section
    if (sectionY + estimatedHeight > pageHeight - 16) {
      doc.addPage();
      sectionY = 20;
    }

    // Class Section Header Bar
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.roundedRect(margin, sectionY, contentWidth, 7, 1.5, 1.5, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(
      `CLASS RECORD #${classNumber} OF ${sortedSessions.length}:  ${session.subjectName.toUpperCase()} (${session.subjectCode}) — ${session.slot || "—"}`,
      margin + 3,
      sectionY + 4.8,
      { maxWidth: contentWidth - 48 }
    );

    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(219, 234, 254);
    doc.text(`ID: ${session.id}`, pageWidth - margin - 3, sectionY + 4.8, { align: "right" });

    sectionY += 9;

    // Section Content Box
    doc.setFillColor(252, 253, 254);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(margin, sectionY, contentWidth, boxHeight, 1.5, 1.5, "FD");

    // Grid of Details - 2 Columns Layout to completely prevent text collision
    doc.setFontSize(7.5);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);

    const col1X = margin + 4;  // 18 mm
    const col2X = margin + 92; // 106 mm (leaving 86 mm width for col 2 up to 192 mm)
    let textY = sectionY + 5;

    // Row 1: Schedule & Timing (Col 1) | Scheduled Window (Col 2)
    doc.setFont("helvetica", "bold");
    doc.text("Schedule & Timing:", col1X, textY);
    doc.setFont("helvetica", "normal");
    doc.text(`${formatISTDate(session.scheduledDate)} · ${session.slot || "—"}`, col1X + 27, textY, { maxWidth: 59 });

    doc.setFont("helvetica", "bold");
    doc.text("Scheduled Window:", col2X, textY);
    doc.setFont("helvetica", "normal");
    doc.text(`${formatISTTime(session.scheduledStartAt)} – ${formatISTTime(session.scheduledEndAt)} IST`, col2X + 28, textY, { maxWidth: 56 });

    textY += 5;

    // Row 2: Course Type (Col 1) | Classroom / Academic Day (Col 2)
    doc.setFont("helvetica", "bold");
    doc.text("Course Type:", col1X, textY);
    doc.setFont("helvetica", "normal");
    doc.text(`${session.category || "Theory"} (${session.subjectCode})`, col1X + 27, textY, { maxWidth: 59 });

    doc.setFont("helvetica", "bold");
    doc.text("Classroom / Day:", col2X, textY);
    doc.setFont("helvetica", "normal");
    const roomAndDay = `${session.room || "Classroom"} · ${session.academicDayNumber ? `Day ${session.academicDayNumber}` : "Std Schedule"}`;
    doc.text(roomAndDay, col2X + 28, textY, { maxWidth: 56 });

    textY += 5;

    // Divider line inside card
    doc.setDrawColor(235, 240, 245);
    doc.line(col1X, textY - 1.5, pageWidth - margin - 4, textY - 1.5);

    // Row 3: AttendWise Attendance Record (Col 1) | AW Receipt Timestamp (Col 2)
    doc.setFont("helvetica", "bold");
    doc.text("AttendWise Status:", col1X, textY + 2);

    let awStatusColor = slateDark;
    let awStatusLabel = "Upcoming / Unmarked";
    if (session.personalStatus === "present") {
      awStatusColor = emeraldGreen;
      awStatusLabel = "PRESENT (Verified)";
    } else if (session.personalStatus === "absent") {
      awStatusColor = roseRed;
      awStatusLabel = `ABSENT (${session.absentType === "automatic_overdue" ? "Automatic Overdue" : "Marked by Student"})`;
    } else if (session.personalStatus === "frozen") {
      awStatusColor = skyBlue;
      awStatusLabel = "FROZEN (Excluded)";
    } else if (session.personalStatus === "cancelled") {
      awStatusColor = amberOrange;
      awStatusLabel = "CANCELLED";
    }

    doc.setTextColor(awStatusColor[0], awStatusColor[1], awStatusColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(awStatusLabel, col1X + 27, textY + 2, { maxWidth: 59 });

    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.setFont("helvetica", "bold");
    doc.text("AW Receipt Time:", col2X, textY + 2);
    doc.setFont("helvetica", "normal");
    const awTimestamp = session.serverReceiptAt
      ? formatISTDateTime(session.serverReceiptAt)
      : session.finalizedAt
      ? formatISTDateTime(session.finalizedAt)
      : "— Not Marked / Pending —";
    doc.text(awTimestamp, col2X + 28, textY + 2, { maxWidth: 56 });

    textY += 5.5;

    // Row 4: ERP Portal Status Record (Col 1) | ERP Entry Timestamp (Col 2)
    doc.setFont("helvetica", "bold");
    doc.text("ERP Portal Status:", col1X, textY + 1.5);

    let erpColor = amberOrange;
    let erpLabel = "— ERP Not Entered —";
    if (session.erpStatus === "Present") {
      erpColor = emeraldGreen;
      erpLabel = "PRESENT (Permanent & Locked)";
    } else if (session.erpStatus === "Absent") {
      erpColor = roseRed;
      erpLabel = "ABSENT (Permanent & Locked)";
    }

    doc.setTextColor(erpColor[0], erpColor[1], erpColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(erpLabel, col1X + 27, textY + 1.5, { maxWidth: 59 });

    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.setFont("helvetica", "bold");
    doc.text("ERP Entry Time:", col2X, textY + 1.5);
    doc.setFont("helvetica", "normal");
    const erpTimestamp = session.erpRecordedAt ? formatISTDateTime(session.erpRecordedAt) : "— Not Entered on Portal —";
    doc.text(erpTimestamp, col2X + 28, textY + 1.5, { maxWidth: 56 });

    textY += 5.5;

    // Row 5: Freeze & Finalized State (Col 1) | Device Capture (Col 2)
    doc.setFont("helvetica", "bold");
    doc.text("Freeze Status:", col1X, textY + 1);
    doc.setFont("helvetica", "normal");
    const freezeAndFinal = `${session.personalStatus === "frozen" ? "Frozen (Excluded)" : "Not Frozen"} · ${session.finalized ? "Finalized" : "Pending"}`;
    doc.text(freezeAndFinal, col1X + 27, textY + 1, { maxWidth: 59 });

    doc.setFont("helvetica", "bold");
    doc.text("Device Capture:", col2X, textY + 1);
    doc.setFont("helvetica", "normal");
    const deviceTime = session.clientCaptureAt ? `${formatISTTime(session.clientCaptureAt)} IST` : "— Not Captured —";
    doc.text(deviceTime, col2X + 28, textY + 1, { maxWidth: 56 });

    textY += 5.5;

    // Row 6: Academic Keynote (spanning full card width)
    doc.setFont("helvetica", "bold");
    doc.text("Academic Keynote:", col1X, textY + 0.5);
    doc.setFont("helvetica", session.note ? "normal" : "italic");
    doc.setTextColor(session.note ? navy[0] : 140, session.note ? navy[1] : 140, session.note ? navy[2] : 140);
    const noteText = session.note && session.note.trim() ? `"${session.note.trim()}"` : "— No Keynote Saved for this Class —";
    doc.text(noteText, col1X + 27, textY + 0.5, { maxWidth: contentWidth - 34 });

    textY += 5;

    // Row 7: Photo Evidence Container
    doc.setDrawColor(235, 240, 245);
    doc.line(col1X, textY - 1, pageWidth - margin - 4, textY - 1);

    if (hasPhoto && session.photoDataUrl) {
      // Embed Image
      try {
        const imgX = col1X;
        const imgY = textY + 1;
        const imgW = 34; // mm
        const imgH = 24; // mm

        // Format detection
        const imgFormat = session.photoDataUrl.includes("png") ? "PNG" : "JPEG";
        doc.addImage(session.photoDataUrl, imgFormat, imgX, imgY, imgW, imgH);

        // Photo info text beside the thumbnail
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.text("ORIGINAL PHOTO EVIDENCE EMBEDDED", imgX + imgW + 4, imgY + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
        doc.text(`Capture Timestamp: ${formatISTDateTime(session.clientCaptureAt || session.serverReceiptAt || session.finalizedAt)}`, imgX + imgW + 4, imgY + 10, { maxWidth: contentWidth - imgW - 12 });
        doc.text(`Verification: Verified authentic student camera capture saved in data vault.`, imgX + imgW + 4, imgY + 14, { maxWidth: contentWidth - imgW - 12 });
        if (session.evidenceStoragePath) {
          doc.text(`Cloud Storage Path: ${session.evidenceStoragePath}`, imgX + imgW + 4, imgY + 18, { maxWidth: contentWidth - imgW - 12 });
        }
      } catch (imgErr) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(amberOrange[0], amberOrange[1], amberOrange[2]);
        doc.text(
          `⚠️ Evidence Disclosure: Photo evidence logged in records, but inline preview could not be decoded.`,
          col1X,
          textY + 4,
          { maxWidth: contentWidth - 10 }
        );
      }
    } else if (session.evidenceStoragePath || session.evidenceAvailable) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.text(
        `ℹ️ Evidence Disclosure: Camera snapshot registered in storage (${session.evidenceStoragePath || "cloud path"}), image data offline.`,
        col1X,
        textY + 3,
        { maxWidth: contentWidth - 10 }
      );
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text("— No Photo Evidence Captured for this Class —", col1X, textY + 3);
    }

    sectionY += boxHeight + 6;
  }

  // ==========================================
  // RUNNING HEADER & RUNNING FOOTER (Two-pass)
  // ==========================================
  const totalPages = doc.internal.pages.length - 1; // jsPDF 1-indexed

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // Skip running header on cover page (page 1)
    if (pageNum > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `AttendWise Consolidated Attendance Report · SISTec Student Vault  |  Report ID: ${reportId}`,
        margin,
        9
      );
      doc.text(`Generated: ${nowIST}`, pageWidth - margin, 9, { align: "right" });

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, 11, pageWidth - margin, 11);
    }

    // Running Footer on every page
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `AttendWise Secure Audit · Authentic Student Records  |  Included Classes: ${sortedSessions.length}`,
      margin,
      pageHeight - 6.5
    );

    doc.setFont("helvetica", "bold");
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 6.5, { align: "right" });
  }

  const filename = `AttendWise_Consolidated_Report_${new Date().toISOString().slice(0, 10)}_${reportId}.pdf`;
  doc.save(filename);

  return {
    success: true,
    reportId,
    totalClasses: sortedSessions.length,
    filename,
  };
}

/**
 * Generate and download consolidated Excel spreadsheet (.xlsx) containing all selected classes.
 */
export function exportConsolidatedAttendanceExcel(
  options: AttendanceReportOptions
): { success: boolean; filename: string; totalClasses: number } {
  const {
    studentName,
    studentEmail,
    institution = "SISTec",
    course = "B.Tech Computer Science & Engineering",
    filters,
    subjects,
    selectedSessions,
  } = options;

  if (!selectedSessions || selectedSessions.length === 0) {
    throw new Error("No classes selected for spreadsheet export.");
  }

  const sorted = [...selectedSessions].sort(
    (a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime()
  );

  const reportId = `AW-REP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase()}`;
  const nowIST = formatISTDateTime(new Date().toISOString());

  // Sheet 1: Report Metadata
  const summaryData = [
    ["ATTENDWISE CONSOLIDATED ATTENDANCE REPORT SUMMARY"],
    [],
    ["Report ID", reportId],
    ["Generation Timestamp (IST)", nowIST],
    ["Student Name", studentName],
    ["Student Email", studentEmail],
    ["Institution", institution],
    ["Course / Semester", course],
    ["Active Filters", describeFilterCriteria(filters, subjects)],
    ["Total Classes Selected", sorted.length],
    [],
    ["EXECUTIVE METRICS BREAKDOWN"],
    ["AttendWise Present", sorted.filter((s) => s.personalStatus === "present").length],
    ["AttendWise Absent", sorted.filter((s) => s.personalStatus === "absent").length],
    ["Frozen (Excluded from calculations)", sorted.filter((s) => s.personalStatus === "frozen").length],
    ["Upcoming / Unmarked", sorted.filter((s) => s.personalStatus === "upcoming").length],
    ["ERP Present (Locked)", sorted.filter((s) => s.erpStatus === "Present").length],
    ["ERP Absent (Locked)", sorted.filter((s) => s.erpStatus === "Absent").length],
    ["ERP Not Entered", sorted.filter((s) => !s.erpStatus).length],
    ["Classes with Camera Evidence", sorted.filter((s) => s.photoDataUrl || s.evidenceStoragePath || s.evidenceAvailable).length],
    ["Classes with Keynotes / Notes", sorted.filter((s) => s.note && s.note.trim()).length],
  ];

  // Sheet 2: All Selected Classes Table
  const tableData = [
    [
      "#",
      "Record ID",
      "Scheduled Date",
      "Slot",
      "Start Time (IST)",
      "End Time (IST)",
      "Subject Code",
      "Subject Name",
      "Category",
      "Room",
      "Academic Day",
      "AttendWise Status",
      "AW Finalized",
      "AW Timestamp (IST)",
      "Absent Reason",
      "ERP Status",
      "ERP Recorded (IST)",
      "Freeze Status",
      "Keynote / Remarks",
      "Photo Evidence Available",
      "Photo Storage Reference",
    ],
    ...sorted.map((s, idx) => [
      idx + 1,
      s.id,
      s.scheduledDate,
      s.slot || "—",
      formatISTTime(s.scheduledStartAt),
      formatISTTime(s.scheduledEndAt),
      s.subjectCode,
      s.subjectName,
      s.category,
      s.room || "Classroom / CS Lab",
      s.academicDayNumber || "—",
      s.personalStatus === "present"
        ? "Present"
        : s.personalStatus === "absent"
        ? "Absent"
        : s.personalStatus === "frozen"
        ? "Frozen (Excluded)"
        : s.personalStatus === "cancelled"
        ? "Cancelled"
        : "Upcoming",
      s.finalized ? "Yes" : "No",
      s.serverReceiptAt ? formatISTDateTime(s.serverReceiptAt) : s.finalizedAt ? formatISTDateTime(s.finalizedAt) : "—",
      s.absentType || "—",
      s.erpStatus || "— Not Entered —",
      s.erpRecordedAt ? formatISTDateTime(s.erpRecordedAt) : "—",
      s.personalStatus === "frozen" ? "Frozen (Excluded from Denominators)" : "Active",
      s.note || "— None —",
      s.photoDataUrl || s.evidenceStoragePath || s.evidenceAvailable ? "Yes" : "No",
      s.evidenceStoragePath || (s.photoDataUrl ? "Inline Base64 Payload" : "—"),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  const wsTable = XLSX.utils.aoa_to_sheet(tableData);

  // Column width formatting for table
  wsTable["!cols"] = [
    { wch: 5 },  // #
    { wch: 36 }, // Record ID
    { wch: 14 }, // Date
    { wch: 8 },  // Slot
    { wch: 14 }, // Start
    { wch: 14 }, // End
    { wch: 12 }, // Code
    { wch: 30 }, // Name
    { wch: 10 }, // Category
    { wch: 16 }, // Room
    { wch: 14 }, // Day
    { wch: 16 }, // AW Status
    { wch: 12 }, // Finalized
    { wch: 22 }, // AW Timestamp
    { wch: 18 }, // Absent Reason
    { wch: 18 }, // ERP Status
    { wch: 22 }, // ERP Timestamp
    { wch: 24 }, // Freeze
    { wch: 32 }, // Note
    { wch: 20 }, // Photo
    { wch: 32 }, // Photo ref
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, "Report Summary");
  XLSX.utils.book_append_sheet(wb, wsTable, "Classes Summary");

  const filename = `AttendWise_Consolidated_Report_${new Date().toISOString().slice(0, 10)}_${reportId}.xlsx`;
  XLSX.writeFile(wb, filename);

  return { success: true, filename, totalClasses: sorted.length };
}
