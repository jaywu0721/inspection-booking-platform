import { describe, expect, it } from "vitest";
import { validateBookingLinkForm } from "../client/src/lib/linkForm";

describe("admin booking link form validation", () => {
  it("blocks submission before company and project are selected", () => {
    const result = validateBookingLinkForm({
      companyId: "",
      projectId: "",
      type: "initial",
      isEnabled: true,
      startsAt: "2026-04-16T09:00",
      endsAt: "2026-04-16T12:00",
      disabledReason: "",
    });

    expect(result).toEqual({
      ok: false,
      message: "請先選擇公司與建案，再確認產生預約連結",
    });
  });

  it("blocks submission before link window is complete", () => {
    const result = validateBookingLinkForm({
      companyId: "1",
      projectId: "2",
      type: "initial",
      isEnabled: true,
      startsAt: "",
      endsAt: "2026-04-16T12:00",
      disabledReason: "",
    });

    expect(result).toEqual({
      ok: false,
      message: "請先填入連結啟用開始與結束時間",
    });
  });

  it("creates a mutation payload only after the form is complete", () => {
    const result = validateBookingLinkForm({
      id: 9,
      companyId: "3",
      projectId: "8",
      type: "reinspect",
      isEnabled: false,
      startsAt: "2026-04-16T09:00",
      endsAt: "2026-04-16T12:00",
      disabledReason: "由管理員暫停",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected completed form to produce payload");
    }

    expect(result.payload).toMatchObject({
      id: 9,
      companyId: 3,
      projectId: 8,
      type: "reinspect",
      isEnabled: false,
      disabledReason: "由管理員暫停",
    });
    expect(result.payload.startsAt).toBeInstanceOf(Date);
    expect(result.payload.endsAt).toBeInstanceOf(Date);
  });
});
