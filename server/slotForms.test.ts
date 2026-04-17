import { describe, expect, it } from "vitest";

import {
  buildPresetSlotPayloads,
  createEditableSlotPresets,
  filterSlotsByLink,
  validateSingleSlotForm,
} from "../client/src/lib/slotForms";

describe("slotForms helper", () => {
  it("filters slot rows by booking link id", () => {
    const filtered = filterSlotsByLink(
      [
        {
          id: 1,
          projectId: 10,
          linkId: 100,
          slotDate: new Date("2026-04-20T00:00:00.000Z"),
          startLabel: "09:00",
          endLabel: "10:30",
          capacity: 2,
          isActive: true,
        },
        {
          id: 2,
          projectId: 10,
          linkId: 200,
          slotDate: new Date("2026-04-20T00:00:00.000Z"),
          startLabel: "10:30",
          endLabel: "12:00",
          capacity: 2,
          isActive: true,
        },
        {
          id: 3,
          projectId: 10,
          linkId: null,
          slotDate: new Date("2026-04-20T00:00:00.000Z"),
          startLabel: "14:00",
          endLabel: "15:30",
          capacity: 2,
          isActive: false,
        },
      ],
      "100"
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(1);
  });

  it("requires link, date and capacity before a single slot can be saved", () => {
    expect(
      validateSingleSlotForm({
        linkId: "",
        slotDate: "",
        startLabel: "09:00",
        endLabel: "10:30",
        capacity: "0",
        isActive: true,
      })
    ).toEqual({ ok: false, message: "請先選擇要設定時段的預約連結" });

    expect(
      validateSingleSlotForm({
        linkId: "88",
        slotDate: "2026-04-22",
        startLabel: "09:00",
        endLabel: "10:30",
        capacity: "3",
        isActive: true,
      })
    ).toEqual({
      ok: true,
      payload: {
        linkId: 88,
        slotDate: new Date("2026-04-22"),
        startLabel: "09:00",
        endLabel: "10:30",
        capacity: 3,
        isActive: true,
      },
    });
  });

  it("builds editable preset slot payloads for the selected link and blocks duplicate preset rows", () => {
    const presets = createEditableSlotPresets();
    presets[0] = { ...presets[0], startLabel: "09:15", endLabel: "10:45" };

    const built = buildPresetSlotPayloads(
      {
        linkId: "301",
        slotDate: "2026-04-25",
        capacity: "4",
        isActive: true,
      },
      presets
    );

    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.payloads).toHaveLength(4);
    expect(built.payloads[0]).toMatchObject({
      linkId: 301,
      startLabel: "09:15",
      endLabel: "10:45",
      capacity: 4,
      isActive: true,
    });

    const duplicate = buildPresetSlotPayloads(
      {
        linkId: "301",
        slotDate: "2026-04-25",
        capacity: "4",
        isActive: true,
      },
      [
        { key: "a", startLabel: "09:00", endLabel: "10:30" },
        { key: "b", startLabel: "09:00", endLabel: "10:30" },
      ]
    );

    expect(duplicate).toEqual({
      ok: false,
      message: "預設時段 09:00-10:30 重複，請先修正後再建立",
    });
  });
});
