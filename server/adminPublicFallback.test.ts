import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
      setHeader: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

describe("admin unauthenticated fallback queries", () => {
  it("returns empty dashboard data instead of throwing before login", async () => {
    const caller = appRouter.createCaller(createGuestContext());

    const result = await caller.admin.dashboard();

    expect(result).toEqual({
      companies: [],
      projects: [],
      residents: [],
      links: [],
      slots: [],
      bookings: [],
      reschedules: [],
    });
  });

  it("returns an empty booking list instead of throwing before login", async () => {
    const caller = appRouter.createCaller(createGuestContext());

    const result = await caller.admin.searchBookings({});

    expect(result).toEqual([]);
  });
});
