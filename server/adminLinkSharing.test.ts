import { describe, expect, it } from "vitest";
import { buildBookingLinkUrlMap } from "../client/src/lib/adminDashboard";
import { getAdminDashboardData } from "./db";

describe("admin booking link sharing", () => {
  it("builds shareable booking urls from real dashboard rows", async () => {
    const dashboard = await getAdminDashboardData();
    const initialLink = dashboard.links.find(link => link.type === "initial");

    expect(initialLink).toBeDefined();
    expect(dashboard.companies.length).toBeGreaterThan(0);
    expect(dashboard.projects.length).toBeGreaterThan(0);

    const urlMap = buildBookingLinkUrlMap({
      origin: "https://inspectionshop-chxaqqnk.manus.space",
      companies: dashboard.companies,
      projects: dashboard.projects,
      links: dashboard.links,
    });

    const company = dashboard.companies.find(item => item.id === initialLink!.companyId);
    const project = dashboard.projects.find(item => item.id === initialLink!.projectId);

    expect(company).toBeDefined();
    expect(project).toBeDefined();
    expect(urlMap.get(initialLink!.id)).toBe(
      `https://inspectionshop-chxaqqnk.manus.space/?company=${company!.slug}&project=${project!.slug}&type=${initialLink!.type}`
    );
  });
});
