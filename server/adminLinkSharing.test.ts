import { describe, expect, it } from "vitest";
import { buildBookingLinkUrlMap } from "../client/src/lib/adminDashboard";
import { getAdminDashboardData } from "./db";

describe("admin booking link sharing", () => {
  it(
    "builds shareable booking urls from real dashboard rows",
    async () => {
      const dashboard = await getAdminDashboardData();
      const initialLink = dashboard.links.find(link => link.type === "initial" && Boolean(link.shareToken));

      expect(initialLink).toBeDefined();
      expect(dashboard.companies.length).toBeGreaterThan(0);
      expect(dashboard.projects.length).toBeGreaterThan(0);
      expect(initialLink?.shareToken).toBeTruthy();

      const urlMap = buildBookingLinkUrlMap({
        origin: "https://inspectionshop-chxaqqnk.manus.space",
        companies: dashboard.companies,
        projects: dashboard.projects,
        links: dashboard.links,
      });

      expect(urlMap.get(initialLink!.id)).toBe(
        `https://inspectionshop-chxaqqnk.manus.space/?link=${initialLink!.shareToken}`
      );
    },
    15000
  );
});
