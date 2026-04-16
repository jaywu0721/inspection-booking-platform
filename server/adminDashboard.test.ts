import { describe, expect, it } from "vitest";
import { buildBookingLinkUrl, buildBookingLinkUrlMap, filterResidentsByProject } from "../client/src/lib/adminDashboard";

describe("admin dashboard helpers", () => {
  it("filters residents by selected project", () => {
    const residents = [
      { id: 1, projectId: 10, unitNumber: "A-4-A" },
      { id: 2, projectId: 10, unitNumber: "A-5-A" },
      { id: 3, projectId: 11, unitNumber: "B-3-B" },
    ];

    expect(filterResidentsByProject(residents, "10")).toEqual([
      { id: 1, projectId: 10, unitNumber: "A-4-A" },
      { id: 2, projectId: 10, unitNumber: "A-5-A" },
    ]);
    expect(filterResidentsByProject(residents, "")).toEqual(residents);
    expect(filterResidentsByProject(residents, "0")).toEqual(residents);
  });

  it("builds a shareable booking url", () => {
    expect(
      buildBookingLinkUrl({
        origin: "https://inspectionshop-chxaqqnk.manus.space",
        companySlug: "yisin",
        projectSlug: "yisin-demo",
        type: "initial",
      })
    ).toBe("https://inspectionshop-chxaqqnk.manus.space/?company=yisin&project=yisin-demo&type=initial");
  });

  it("builds link urls for rows with matching company and project slugs", () => {
    const urlMap = buildBookingLinkUrlMap({
      origin: "https://inspectionshop-chxaqqnk.manus.space",
      companies: [{ id: 1, slug: "yisin", name: "鷁欣建設" }],
      projects: [{ id: 9, slug: "alpha", name: "Alpha", companyId: 1 }],
      links: [
        { id: 100, companyId: 1, projectId: 9, type: "initial" },
        { id: 101, companyId: 1, projectId: 999, type: "reinspect" },
      ],
    });

    expect(urlMap.get(100)).toBe("https://inspectionshop-chxaqqnk.manus.space/?company=yisin&project=alpha&type=initial");
    expect(urlMap.get(101)).toBeNull();
  });
});
