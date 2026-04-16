import { describe, expect, it, vi, afterEach } from "vitest";
import { redirectToAdminDashboardAfterLogin } from "./AdminPage";

describe("redirectToAdminDashboardAfterLogin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates admin queries and redirects to /admin", async () => {
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
    expect(assign).toHaveBeenCalledWith("/admin");
  });
});
