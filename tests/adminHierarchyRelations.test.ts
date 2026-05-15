import { describe, expect, it } from "vitest";
import { getProjectsForCompany } from "../client/src/lib/adminForms";
import { filterResidentsByProject, findUnbookedResidentsForProject } from "../client/src/lib/adminDashboard";
import { filterSlotsByLink, getLinksForProject } from "../client/src/lib/slotForms";

describe("admin hierarchy relation helpers", () => {
  it("keeps projects under the selected company only", () => {
    const projects = [
      { id: 11, name: "鷁欣一案", companyId: 1 },
      { id: 12, name: "鷁欣二案", companyId: 1 },
      { id: 21, name: "鷁崎一案", companyId: 2 },
    ];

    expect(getProjectsForCompany(projects, "1")).toEqual([
      { id: 11, name: "鷁欣一案", companyId: 1 },
      { id: 12, name: "鷁欣二案", companyId: 1 },
    ]);
  });

  it("keeps residents and links under the selected project only", () => {
    const residents = [
      { id: 1, projectId: 11, unitNumber: "A1-01" },
      { id: 2, projectId: 11, unitNumber: "A1-02" },
      { id: 3, projectId: 21, unitNumber: "B1-01" },
    ];
    const links = [
      { id: 100, projectId: 11, type: "initial", isEnabled: true },
      { id: 101, projectId: 11, type: "reinspect", isEnabled: false },
      { id: 200, projectId: 21, type: "initial", isEnabled: true },
    ];

    expect(filterResidentsByProject(residents, "11")).toEqual([
      { id: 1, projectId: 11, unitNumber: "A1-01" },
      { id: 2, projectId: 11, unitNumber: "A1-02" },
    ]);
    expect(getLinksForProject(links, "11")).toEqual([
      { id: 100, projectId: 11, type: "initial", isEnabled: true },
      { id: 101, projectId: 11, type: "reinspect", isEnabled: false },
    ]);
  });

  it("keeps slots under the selected link only", () => {
    const slots = [
      { id: 1000, projectId: 11, linkId: 100, slotDate: new Date("2026-06-01T01:00:00.000Z"), startLabel: "09:00", endLabel: "10:30", capacity: 1, isActive: true },
      { id: 1001, projectId: 11, linkId: 100, slotDate: new Date("2026-06-01T02:00:00.000Z"), startLabel: "10:30", endLabel: "12:00", capacity: 1, isActive: true },
      { id: 2000, projectId: 11, linkId: 101, slotDate: new Date("2026-06-02T01:00:00.000Z"), startLabel: "09:00", endLabel: "10:30", capacity: 1, isActive: true },
    ];

    expect(filterSlotsByLink(slots, "100")).toEqual([
      { id: 1000, projectId: 11, linkId: 100, slotDate: new Date("2026-06-01T01:00:00.000Z"), startLabel: "09:00", endLabel: "10:30", capacity: 1, isActive: true },
      { id: 1001, projectId: 11, linkId: 100, slotDate: new Date("2026-06-01T02:00:00.000Z"), startLabel: "10:30", endLabel: "12:00", capacity: 1, isActive: true },
    ]);
  });

  it("finds residents without any non-cancelled booking under the selected link", () => {
    const residents = [
      { id: 1, projectId: 11, unitNumber: "A1-01", phoneNumber: "0911", note: "已通知" },
      { id: 2, projectId: 11, unitNumber: "A1-02", phoneNumber: "0922", note: "" },
      { id: 3, projectId: 11, unitNumber: "a1-03", phoneNumber: "0933", note: "大小寫測試" },
      { id: 4, projectId: 21, unitNumber: "B1-01", phoneNumber: "0944", note: "其他建案" },
      { id: 5, projectId: 11, unitNumber: " A1-02 ", phoneNumber: "0955", note: "同戶第二聯絡人" },
    ];
    const bookings = [
      { id: 10, projectId: 11, linkId: 100, unitNumberSnapshot: "A1-01", status: "booked" },
      { id: 11, projectId: 11, linkId: 100, unitNumberSnapshot: "A1-03", status: "cancelled" },
      { id: 12, projectId: 11, linkId: 101, unitNumberSnapshot: "A1-02", status: "booked" },
      { id: 13, projectId: 21, linkId: 200, unitNumberSnapshot: "B1-01", status: "booked" },
    ];

    expect(findUnbookedResidentsForProject({ residents, bookings, projectId: "11", linkId: "100" })).toEqual([
      { id: 2, projectId: 11, unitNumber: "A1-02", phoneNumber: "0922", note: "" },
      { id: 3, projectId: 11, unitNumber: "a1-03", phoneNumber: "0933", note: "大小寫測試" },
    ]);
  });
});
