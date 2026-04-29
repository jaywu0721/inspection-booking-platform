import { describe, expect, it } from "vitest";
import { formatInspectionCompanyLabel } from "../client/src/components/AdminBookingRecordsTable";

describe("formatInspectionCompanyLabel", () => {
  it("returns 有 when the booking includes an inspection company", () => {
    expect(formatInspectionCompanyLabel(true)).toBe("有");
  });

  it("returns 無 when the booking does not include an inspection company", () => {
    expect(formatInspectionCompanyLabel(false)).toBe("無");
  });
});
