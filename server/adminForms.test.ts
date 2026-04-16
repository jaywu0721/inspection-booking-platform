import { describe, expect, it } from "vitest";
import { getProjectsForCompany, parsePositiveId, validateResidentForm } from "../client/src/lib/adminForms";

const projects = [
  { id: 11, name: "鷁欣一案", companyId: 1 },
  { id: 12, name: "鷁欣二案", companyId: 1 },
  { id: 21, name: "鷁崎一案", companyId: 2 },
];

describe("admin resident form helpers", () => {
  it("parses only positive integer ids", () => {
    expect(parsePositiveId("1")).toBe(1);
    expect(parsePositiveId("0")).toBeNull();
    expect(parsePositiveId("")).toBeNull();
    expect(parsePositiveId("-3")).toBeNull();
    expect(parsePositiveId("1.5")).toBeNull();
  });

  it("returns only projects under the selected company", () => {
    expect(getProjectsForCompany(projects, "1")).toEqual([
      { id: 11, name: "鷁欣一案", companyId: 1 },
      { id: 12, name: "鷁欣二案", companyId: 1 },
    ]);
    expect(getProjectsForCompany(projects, "2")).toEqual([{ id: 21, name: "鷁崎一案", companyId: 2 }]);
    expect(getProjectsForCompany(projects, "")).toEqual([]);
  });

  it("blocks resident submission when company or project is missing", () => {
    expect(
      validateResidentForm(
        { companyId: "", projectId: "", unitNumber: "A-4-A", phoneNumber: "0912345678", note: "" },
        projects
      )
    ).toBe("請先選擇公司，再儲存住戶資料");

    expect(
      validateResidentForm(
        { companyId: "1", projectId: "", unitNumber: "A-4-A", phoneNumber: "0912345678", note: "" },
        projects
      )
    ).toBe("請先選擇建案，再儲存住戶資料");
  });

  it("blocks cross-company project selection", () => {
    expect(
      validateResidentForm(
        { companyId: "1", projectId: "21", unitNumber: "A-4-A", phoneNumber: "0912345678", note: "" },
        projects
      )
    ).toBe("所選建案不屬於目前公司，請重新選擇");
  });

  it("accepts a valid resident draft", () => {
    expect(
      validateResidentForm(
        { companyId: "1", projectId: "11", unitNumber: "A-4-A", phoneNumber: "0912345678", note: "備註" },
        projects
      )
    ).toBeNull();
  });
});
