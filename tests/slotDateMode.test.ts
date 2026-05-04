import { describe, expect, it } from "vitest";

import { buildPresetSlotPayloads, createEditableSlotPresets, createEmptySlotForm, validateSingleSlotForm } from "../client/src/lib/slotForms";

describe("slot date mode helpers", () => {
  it("keeps single-date validation for manual slot editing and creation", () => {
    const form = {
      ...createEmptySlotForm(),
      linkId: "30",
      slotDate: "2026-05-12",
      startLabel: "09:00",
      endLabel: "10:30",
      capacity: "2",
    };

    const result = validateSingleSlotForm(form);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.linkId).toBe(30);
    expect(result.payload.capacity).toBe(2);
    expect(result.payload.slotDate.toISOString()).toBe("2026-05-12T12:00:00.000Z");
  });

  it("builds preset payloads for every date inside the selected date range", () => {
    const presets = createEditableSlotPresets().slice(0, 2);

    const result = buildPresetSlotPayloads(
      {
        linkId: "30",
        dateMode: "range",
        rangeStartDate: "2026-05-10",
        rangeEndDate: "2026-05-12",
        slotDate: "",
        capacity: "1",
        isActive: true,
      },
      presets
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payloads).toHaveLength(6);
    expect(result.payloads.map(payload => payload.slotDate.toISOString())).toEqual([
      "2026-05-10T12:00:00.000Z",
      "2026-05-11T12:00:00.000Z",
      "2026-05-12T12:00:00.000Z",
      "2026-05-10T12:00:00.000Z",
      "2026-05-11T12:00:00.000Z",
      "2026-05-12T12:00:00.000Z",
    ]);
  });

  it("rejects invalid date ranges before creating preset slots", () => {
    const result = buildPresetSlotPayloads(
      {
        linkId: "30",
        dateMode: "range",
        rangeStartDate: "2026-05-12",
        rangeEndDate: "2026-05-10",
        slotDate: "",
        capacity: "1",
        isActive: true,
      },
      createEditableSlotPresets()
    );

    expect(result).toEqual({
      ok: false,
      message: "日期區間的開始日期不能晚於結束日期",
    });
  });
});
