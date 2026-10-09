import { describe, expect, it } from "vitest";
import { createStatisticsExportWorkbook } from "../client/src/lib/statisticsExport";

describe("statisticsExport", () => {
  it("creates the agreed result and selected-unit worksheets without exposing phones", async () => {
    const workbook = await createStatisticsExportWorkbook({
      projectName: "松園",
      title: "出席意願",
      options: [
        { id: 1, name: "出席", count: 2, units: [{ unitNumber: "A1" }, { unitNumber: "A2" }] },
        { id: 2, name: "委託", count: 1, units: [{ unitNumber: "B1" }] },
      ],
    });

    const resultSheet = workbook.getWorksheet("統計結果");
    const unitSheet = workbook.getWorksheet("點選戶別");
    expect(resultSheet?.getCell("A2").value).toBe("出席");
    expect(resultSheet?.getCell("B2").value).toBe(2);
    expect(unitSheet?.getCell("A2").value).toBe("出席");
    expect(unitSheet?.getCell("B2").value).toBe("A1");
    expect(unitSheet?.getCell("B4").value).toBe("B1");
  });

  it("escapes spreadsheet-formula prefixes in options and units", async () => {
    const workbook = await createStatisticsExportWorkbook({
      projectName: "松園",
      title: "測試",
      options: [{ id: 1, name: "=SUM(1,1)", count: 1, units: [{ unitNumber: "+A1" }] }],
    });

    const resultSheet = workbook.getWorksheet("統計結果");
    const unitSheet = workbook.getWorksheet("點選戶別");
    expect(resultSheet?.getCell("A2").value).toBe("'=SUM(1,1)");
    expect(unitSheet?.getCell("B2").value).toBe("'+A1");
  });
});
