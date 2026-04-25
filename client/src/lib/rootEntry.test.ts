import { describe, expect, it } from "vitest";
import { shouldRenderPublicBookingEntry } from "./rootEntry";

describe("shouldRenderPublicBookingEntry", () => {
  it("returns false for root requests without booking parameters", () => {
    expect(shouldRenderPublicBookingEntry("")).toBe(false);
    expect(shouldRenderPublicBookingEntry("?foo=bar")).toBe(false);
  });

  it("returns true for formal share links with a link token", () => {
    expect(shouldRenderPublicBookingEntry("?link=formal-token")).toBe(true);
  });

  it("returns true for legacy company/project booking links", () => {
    expect(shouldRenderPublicBookingEntry("?company=eagle&project=alpha&type=initial")).toBe(true);
  });
});
