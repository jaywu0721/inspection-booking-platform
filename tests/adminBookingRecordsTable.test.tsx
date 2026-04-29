/** @vitest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminBookingRecordsTable } from "../client/src/components/AdminBookingRecordsTable";

describe("AdminBookingRecordsTable", () => {
  it("renders the inspection company column and shows correct labels for each booking", () => {
    render(
      <AdminBookingRecordsTable
        bookings={[
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
            phoneNumberSnapshot: "0912345678",
            gmail: "owner1@example.com",
            hasInspectionCompany: true,
            status: "booked",
            internalNote: null,
            createdAtMs: 1,
            updatedAtMs: 1,
            slotDate: new Date("2026-05-05T00:00:00.000Z"),
            startLabel: "09:00",
            endLabel: "10:30",
          },
          {
            id: 2,
            companyId: 10,
            projectId: 20,
            linkId: 31,
            slotId: 41,
            companyName: "鷁欣建設",
            projectName: "A1",
            bookingType: "reinspect",
            unitNumberSnapshot: "12F-2",
            phoneNumberSnapshot: "0922333444",
            gmail: "owner2@example.com",
            hasInspectionCompany: false,
            status: "rescheduled",
            internalNote: "改期一次",
            createdAtMs: 2,
            updatedAtMs: 2,
            slotDate: new Date("2026-05-06T00:00:00.000Z"),
            startLabel: "14:00",
            endLabel: "15:30",
          },
        ]}
        editingBookingId=""
        rescheduleForm={{ slotDate: "", newSlotId: "", note: "" }}
        dateOptions={[]}
        slotOptions={[]}
        isFetching={false}
        isSubmitting={false}
        onStartEditing={vi.fn()}
        onChangeDate={vi.fn()}
        onChangeSlot={vi.fn()}
        onChangeNote={vi.fn()}
        onSyncAvailability={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("是否驗屋公司")).toBeTruthy();
    expect(screen.getAllByText("有")).toHaveLength(1);
    expect(screen.getAllByText("無")).toHaveLength(1);
  });
});
