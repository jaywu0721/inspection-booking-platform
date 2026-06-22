import ExcelJS from "exceljs";
import type { AdminBookingRecordRow } from "@/components/AdminBookingRecordsTable";
import { createStableDateFromDateOnly, getDateKeyInTaipei } from "@/lib/dateHelpers";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;
const DATE_COLUMN_WIDTH = 12;
const BOOKING_COLUMN_WIDTH = 18;
const INSPECTION_COMPANY_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "00FFFF00" },
};

type BookingExportCell = {
  value: string;
  highlight: boolean;
};

export type BookingExportRow = {
  dateKey: string;
  dateLabel: string;
  cells: BookingExportCell[];
};

function getTimeSortValue(label: string) {
  const [hourText = "0", minuteText = "0"] = label.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return hour * 60 + minute;
}

export function formatBookingExportDateLabel(dateValue: string | number | Date) {
  const dateKey = getDateKeyInTaipei(dateValue);
  const stableDate = createStableDateFromDateOnly(dateKey);
  const [, monthText = "0", dayText = "0"] = dateKey.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  const weekday = WEEKDAY_LABELS[stableDate.getUTCDay()] ?? "";

  return `${month}/${day}(${weekday})`;
}

export function buildBookingExportRows(bookings: AdminBookingRecordRow[]) {
  const grouped = new Map<string, BookingExportCell[]>();

  const sortedBookings = [...bookings].sort((left, right) => {
    const leftDate = getDateKeyInTaipei(left.slotDate);
    const rightDate = getDateKeyInTaipei(right.slotDate);

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    const timeDiff = getTimeSortValue(left.startLabel) - getTimeSortValue(right.startLabel);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    const endTimeDiff = getTimeSortValue(left.endLabel) - getTimeSortValue(right.endLabel);
    if (endTimeDiff !== 0) {
      return endTimeDiff;
    }

    return left.unitNumberSnapshot.localeCompare(right.unitNumberSnapshot, "zh-Hant", { numeric: true, sensitivity: "base" });
  });

  sortedBookings.forEach(booking => {
    const dateKey = getDateKeyInTaipei(booking.slotDate);
    const current = grouped.get(dateKey) ?? [];
    current.push({
      value: `${booking.unitNumberSnapshot}(${booking.startLabel}-${booking.endLabel})`,
      highlight: booking.hasInspectionCompany,
    });
    grouped.set(dateKey, current);
  });

  return Array.from(grouped.entries()).map(([dateKey, cells]) => ({
    dateKey,
    dateLabel: formatBookingExportDateLabel(dateKey),
    cells,
  }));
}

export async function createBookingExportWorkbook(bookings: AdminBookingRecordRow[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("驗屋預約");
  const rows = buildBookingExportRows(bookings);
  const maxBookingCount = Math.max(1, ...rows.map(row => row.cells.length));

  worksheet.getColumn(1).width = DATE_COLUMN_WIDTH;
  for (let columnIndex = 0; columnIndex < maxBookingCount; columnIndex += 1) {
    worksheet.getColumn(columnIndex + 2).width = BOOKING_COLUMN_WIDTH;
  }

  rows.forEach((row, rowIndex) => {
    const excelRowIndex = rowIndex + 1;
    worksheet.getCell(excelRowIndex, 1).value = row.dateLabel;
    row.cells.forEach((cell: BookingExportCell, cellIndex: number) => {
      const excelCell = worksheet.getCell(excelRowIndex, cellIndex + 2);
      excelCell.value = cell.value;
      if (cell.highlight) {
        excelCell.fill = INSPECTION_COMPANY_FILL;
      }
    });
  });

  return workbook;
}

export async function downloadBookingListWorkbook(bookings: AdminBookingRecordRow[]) {
  const workbook = await createBookingExportWorkbook(bookings);
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "驗屋預約清單.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}
