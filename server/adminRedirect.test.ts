import { afterEach, describe, expect, it, vi } from "vitest";
import { redirectToAdminDashboardAfterLogin } from "../client/src/lib/adminRedirect";

describe("redirectToAdminDashboardAfterLogin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates admin caches and redirects to /admin", async () => {
    const meInvalidate = vi.fn().mockResolvedValue(undefined);
    const dashboardInvalidate = vi.fn().mockResolvedValue(undefined);
    const searchBookingsInvalidate = vi.fn().mockResolvedValue(undefined);
    const assign = vi.fn();

    vi.stubGlobal("window", {
      location: {
        assign,
      },
    });

    await redirectToAdminDashboardAfterLogin({
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
    });

    expect(meInvalidate).toHaveBeenCalledTimes(1);
    expect(dashboardInvalidate).toHaveBeenCalledTimes(1);
    expect(searchBookingsInvalidate).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/admin");
  });
});
