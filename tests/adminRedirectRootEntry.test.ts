import { afterEach, describe, expect, it, vi } from "vitest";
import { redirectToAdminDashboardAfterLogin } from "../client/src/lib/adminRedirect";

describe("redirectToAdminDashboardAfterLogin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates admin queries and redirects to root admin entry", async () => {
    const meInvalidate = vi.fn().mockResolvedValue(undefined);
    const dashboardInvalidate = vi.fn().mockResolvedValue(undefined);
    const searchBookingsInvalidate = vi.fn().mockResolvedValue(undefined);
    const assign = vi.fn();

    vi.stubGlobal("window", {
      location: {
        assign,
      },
    });

    const utils = {
      adminAuth: {
        me: {
          invalidate: meInvalidate,
        },
      },
      admin: {
        dashboard: {
          invalidate: dashboardInvalidate,
        },
        searchBookings: {
          invalidate: searchBookingsInvalidate,
        },
      },
    } as any;

    await redirectToAdminDashboardAfterLogin(utils);

    expect(meInvalidate).toHaveBeenCalledTimes(1);
    expect(dashboardInvalidate).toHaveBeenCalledTimes(1);
    expect(searchBookingsInvalidate).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/");
  });
});
