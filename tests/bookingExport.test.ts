import { describe, expect, it } from "vitest";
import { buildBookingExportRows, createBookingExportWorkbook, formatBookingExportDateLabel } from "../client/src/lib/bookingExport";
import type { AdminBookingRecordRow } from "../client/src/components/AdminBookingRecordsTable";

const sampleBookings: AdminBookingRecordRow[] = [
  {
    id: 2,
    companyId: 10,
    projectId: 20,
    linkId: 30,
    slotId: 41,
    companyName: "鷁欣建設",
    projectName: "A1",
    bookingType: "initial",
    unitNumberSnapshot: "12F-2",
    phoneNumberSnapshot: "0912000002",
    gmail: "owner2@example.com",
    hasInspectionCompany: false,
    status: "booked",
    internalNote: null,
    createdAtMs: 2,
    updatedAtMs: 2,
    slotDate: new Date("2026-06-20T00:00:00.000Z"),
    startLabel: "14:00",
    endLabel: "15:30",
  },
  {
    id: 1,
    companyId: 10,
    projectId: 20,
    linkId: 30,
    slotId: 40,
    companyName: "鷁欣建設",
    projectName: "A1",
    bookingType: "initial",
    unitNumberSnapshot: "12F-1",
    phoneNumberSnapshot: "0912000001",
    gmail: "owner1@example.com",
    hasInspectionCompany: true,
    status: "booked",
    internalNote: null,
    createdAtMs: 1,
    updatedAtMs: 1,
    slotDate: new Date("2026-06-20T00:00:00.000Z"),
    startLabel: "09:00",
    endLabel: "10:30",
  },
  {
    id: 3,
    companyId: 10,
    projectId: 20,
    linkId: 31,
    slotId: 42,
    companyName: "鷁欣建設",
    projectName: "A1",
    bookingType: "reinspect",
    unitNumberSnapshot: "15F-3",
    phoneNumberSnapshot: "0912000003",
    gmail: "owner3@example.com",
    hasInspectionCompany: false,
    status: "rescheduled",
    internalNote: "改期",
    createdAtMs: 3,
    updatedAtMs: 3,
    slotDate: new Date("2026-06-21T00:00:00.000Z"),
    startLabel: "09:00",
    endLabel: "10:30",
  },
];

describe("bookingExport", () => {
  it("formats Taipei date labels as month/day with weekday", () => {
    expect(formatBookingExportDateLabel("2026-06-20")).toBe("6/20(六)");
  });

  it("groups bookings by date and sorts each day by time", () => {
    const rows = buildBookingExportRows(sampleBookings);

    expect(rows).toEqual([
      {
        dateKey: "2026-06-20",
        dateLabel: "6/20(六)",
        cells: [
          { value: "12F-1(09:00-10:30)", highlight: true },
          { value: "12F-2(14:00-15:30)", highlight: false },
        ],
      },
      {
        dateKey: "2026-06-21",
        dateLabel: "6/21(日)",
        cells: [{ value: "15F-3(09:00-10:30)", highlight: false }],
      },
    ]);
  });

  it("creates a workbook and highlights inspection-company bookings in yellow", async () => {
    const workbook = await createBookingExportWorkbook(sampleBookings);
    const worksheet = workbook.getWorksheet("驗屋預約");

    expect(worksheet).toBeTruthy();
    expect(worksheet?.getCell("A1").value).toBe("6/20(六)");
    expect(worksheet?.getCell("B1").value).toBe("12F-1(09:00-10:30)");
    expect(worksheet?.getCell("C1").value).toBe("12F-2(14:00-15:30)");
    expect(worksheet?.getCell("A2").value).toBe("6/21(日)");
    expect(worksheet?.getCell("B2").value).toBe("15F-3(09:00-10:30)");
    expect(worksheet?.getCell("B1").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00FFFF00" },
    });
    expect(worksheet?.getCell("C1").fill).toBeUndefined();
  });
});
