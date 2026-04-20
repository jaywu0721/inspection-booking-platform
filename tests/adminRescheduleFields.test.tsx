/** @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminRescheduleFields } from "../client/src/components/AdminRescheduleFields";
import { triggerRescheduleAvailabilitySync } from "../client/src/lib/adminRescheduleInteractions";

describe("AdminRescheduleFields", () => {
  it("re-syncs availability when the admin changes the date", () => {
    const onChangeDate = vi.fn();
    const onSyncAvailability = vi.fn();

    render(
      <AdminRescheduleFields
        slotDate="2026-05-04"
        newSlotId=""
        note=""
        dateOptions={[
          { value: "2026-05-04", label: "2026/05/04" },
          { value: "2026-05-05", label: "2026/05/05" },
        ]}
        slotOptions={[]}
        isFetching={false}
        isSubmitting={false}
        onChangeDate={value => {
          onChangeDate(value);
          onSyncAvailability();
        }}
        onChangeSlot={vi.fn()}
        onChangeNote={vi.fn()}
        onSyncAvailability={onSyncAvailability}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("新日期"), { target: { value: "2026-05-05" } });

    expect(onChangeDate).toHaveBeenCalledWith("2026-05-05");
    expect(onSyncAvailability).toHaveBeenCalledTimes(1);
  });

  it("re-syncs availability when the slot dropdown is opened", () => {
    const onSyncAvailability = vi.fn();

    triggerRescheduleAvailabilitySync(onSyncAvailability);

    expect(onSyncAvailability).toHaveBeenCalledTimes(1);
  });

  it("shows remaining capacity and keeps same-day current slot selectable only when it still has capacity", () => {
    const { rerender } = render(
      <AdminRescheduleFields
        slotDate="2026-05-04"
        newSlotId=""
        note=""
        dateOptions={[{ value: "2026-05-04", label: "2026/05/04" }]}
        slotOptions={[
          { id: 1, startLabel: "10:30", endLabel: "12:00", remaining: 1, isCurrentSlot: true },
          { id: 2, startLabel: "14:00", endLabel: "15:30", remaining: 0, isCurrentSlot: false },
        ]}
        isFetching={false}
        isSubmitting={false}
        onChangeDate={vi.fn()}
        onChangeSlot={vi.fn()}
        onChangeNote={vi.fn()}
        onSyncAvailability={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const currentSlotOption = screen.getByRole("option", { name: "10:30-12:00 / 餘額 1 / 目前時段" });
    const fullSlotOption = screen.getByRole("option", { name: "14:00-15:30 / 餘額 0" });

    expect(currentSlotOption.hasAttribute("disabled")).toBe(false);
    expect(fullSlotOption.hasAttribute("disabled")).toBe(true);

    rerender(
      <AdminRescheduleFields
        slotDate="2026-05-04"
        newSlotId=""
        note=""
        dateOptions={[{ value: "2026-05-04", label: "2026/05/04" }]}
        slotOptions={[{ id: 1, startLabel: "10:30", endLabel: "12:00", remaining: 0, isCurrentSlot: true }]}
        isFetching={false}
        isSubmitting={false}
        onChangeDate={vi.fn()}
        onChangeSlot={vi.fn()}
        onChangeNote={vi.fn()}
        onSyncAvailability={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const fullCurrentSlotOption = screen.getByRole("option", { name: "10:30-12:00 / 餘額 0 / 目前時段" });
    expect(fullCurrentSlotOption.hasAttribute("disabled")).toBe(true);
  });
});
