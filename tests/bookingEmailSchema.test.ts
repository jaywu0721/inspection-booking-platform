import { describe, expect, it } from "vitest";

import { bookingEmailSchema } from "../shared/bookingEmail";

describe("bookingEmailSchema", () => {
  it("accepts an empty string for optional booking email", () => {
    const result = bookingEmailSchema.safeParse("");

    expect(result.success).toBe(true);
  });

  it("accepts a non-gmail email address", () => {
    const result = bookingEmailSchema.safeParse("owner@yahoo.com");

    expect(result.success).toBe(true);
  });

  it("rejects malformed email values", () => {
    const result = bookingEmailSchema.safeParse("not-an-email");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("請填寫有效的 Email 信箱");
    }
  });
});
