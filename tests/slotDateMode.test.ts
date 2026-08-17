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

  it("skips blank presets and builds payloads only for filled ones", () => {
    const presets = [
      { key: "preset-1", startLabel: "08:10", endLabel: "10:00" },
      { key: "preset-2", startLabel: "", endLabel: "" },
      { key: "preset-3", startLabel: "14:00", endLabel: "16:00" },
      { key: "preset-4", startLabel: "", endLabel: "" },
    ];

    const result = buildPresetSlotPayloads(
      { linkId: "30", dateMode: "single", slotDate: "2026-05-10", rangeStartDate: "", rangeEndDate: "", capacity: "1", isActive: true },
      presets
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payloads).toHaveLength(2);
    expect(result.payloads[0].startLabel).toBe("08:10");
    expect(result.payloads[1].startLabel).toBe("14:00");
  });

  it("rejects when all presets are blank", () => {
    const presets = [
      { key: "preset-1", startLabel: "", endLabel: "" },
      { key: "preset-2", startLabel: "", endLabel: "" },
      { key: "preset-3", startLabel: "", endLabel: "" },
      { key: "preset-4", startLabel: "", endLabel: "" },
    ];

    const result = buildPresetSlotPayloads(
      { linkId: "30", dateMode: "single", slotDate: "2026-05-10", rangeStartDate: "", rangeEndDate: "", capacity: "1", isActive: true },
      presets
    );

    expect(result).toEqual({ ok: false, message: "請至少填寫一筆有效的預設時段" });
  });

  it("rejects a preset with only start or only end filled", () => {
    const presets = [
      { key: "preset-1", startLabel: "09:00", endLabel: "" },
      { key: "preset-2", startLabel: "", endLabel: "" },
      { key: "preset-3", startLabel: "", endLabel: "" },
      { key: "preset-4", startLabel: "", endLabel: "" },
    ];

    const result = buildPresetSlotPayloads(
      { linkId: "30", dateMode: "single", slotDate: "2026-05-10", rangeStartDate: "", rangeEndDate: "", capacity: "1", isActive: true },
      presets
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("起訖時間不完整");
  });
});
