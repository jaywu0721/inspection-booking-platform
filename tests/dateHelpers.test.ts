import { describe, expect, it } from "vitest";

import {
  createStableDateFromDateOnly,
  formatDateInTaipei,
  formatDateTimeInTaipei,
  getDateKeyInTaipei,
  resolveDateValue,
} from "../client/src/lib/dateHelpers";

describe("dateHelpers", () => {
  it("parses YYYY-MM-DD into UTC noon instead of browser-local midnight", () => {
    const resolved = resolveDateValue("2026-05-31");

    expect(resolved.toISOString()).toBe("2026-05-31T12:00:00.000Z");
    expect(createStableDateFromDateOnly("2026-05-31").toISOString()).toBe("2026-05-31T12:00:00.000Z");
  });

  it("formats date-only and datetime values with the same Asia/Taipei rules", () => {
    expect(formatDateInTaipei("2026-05-31")).toBe("2026/05/31");
    expect(getDateKeyInTaipei("2026-05-31")).toBe("2026-05-31");
    expect(formatDateTimeInTaipei("2026-05-31T16:00:00.000Z")).toContain("2026/06/01");
  });
});
