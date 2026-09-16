import { describe, expect, it } from "vitest";

import { validateAdminCustomTimeRange } from "../client/src/lib/adminCustomReschedule";
import { parseAdminCustomSlot } from "../server/db";

describe("admin custom reschedule validation", () => {
  it("accepts today in Asia/Taipei and parses a one-field time range", () => {
    const result = parseAdminCustomSlot(
      { slotDate: "2026-09-16", timeRange: "14:00-16:00" },
      new Date("2026-09-16T03:00:00.000Z")
    );

    expect(result).toEqual({
      slotDate: new Date("2026-09-16T12:00:00.000Z"),
      startLabel: "14:00",
      endLabel: "16:00",
    });
  });

  it("rejects a custom date earlier than today in Asia/Taipei", () => {
    expect(() =>
      parseAdminCustomSlot(
        { slotDate: "2026-09-15", timeRange: "14:00-16:00" },
        new Date("2026-09-16T03:00:00.000Z")
      )
    ).toThrow("客製日期不可早於今天");
  });

  it("rejects malformed or reversed custom time ranges", () => {
    expect(validateAdminCustomTimeRange("14:00~16:00")).toEqual({
      ok: false,
      message: "自訂時段格式須為 HH:mm-HH:mm，例如 14:00-16:00",
    });
    expect(validateAdminCustomTimeRange("16:00-14:00")).toEqual({
      ok: false,
      message: "自訂時段的結束時間必須晚於開始時間",
    });
  });
});
