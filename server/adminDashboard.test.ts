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

  it("builds a shareable booking url from link token", () => {
    expect(
      buildBookingLinkUrl({
        origin: "https://inspectionshop-chxaqqnk.manus.space",
        shareToken: "link-token-123",
      })
    ).toBe("https://inspectionshop-chxaqqnk.manus.space/?link=link-token-123");
  });

  it("builds link urls for rows with matching company, project and share token", () => {
    const urlMap = buildBookingLinkUrlMap({
      origin: "https://inspectionshop-chxaqqnk.manus.space",
      companies: [{ id: 1, slug: "yisin", name: "鷁欣建設" }],
      projects: [{ id: 9, slug: "alpha", name: "Alpha", companyId: 1 }],
      links: [
        { id: 100, companyId: 1, projectId: 9, shareToken: "alpha-token" },
        { id: 101, companyId: 1, projectId: 999, shareToken: "missing-project" },
        { id: 102, companyId: 1, projectId: 9, shareToken: null },
      ],
    });

    expect(urlMap.get(100)).toBe("https://inspectionshop-chxaqqnk.manus.space/?link=alpha-token");
    expect(urlMap.get(101)).toBeNull();
    expect(urlMap.get(102)).toBeNull();
  });
});
