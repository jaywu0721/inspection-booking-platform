import ExcelJS from "exceljs";

export type StatisticExportOption = {
  id: number;
  name: string;
  count: number;
  units: Array<{ unitNumber: string }>;
};

function escapeSpreadsheetValue(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export async function createStatisticsExportWorkbook(input: {
  projectName: string;
  title: string;
  options: StatisticExportOption[];
}) {
  const workbook = new ExcelJS.Workbook();
  const resultSheet = workbook.addWorksheet("統計結果");
  const unitSheet = workbook.addWorksheet("點選戶別");

  resultSheet.columns = [
    { header: "選項", key: "option", width: 42 },
    { header: "統計數量", key: "count", width: 14 },
  ];
  unitSheet.columns = [
    { header: "選項", key: "option", width: 42 },
    { header: "戶別", key: "unit", width: 24 },
  ];

  input.options.forEach(option => {
    resultSheet.addRow({ option: escapeSpreadsheetValue(option.name), count: option.count });
    option.units.forEach(unit => {
      unitSheet.addRow({ option: escapeSpreadsheetValue(option.name), unit: escapeSpreadsheetValue(unit.unitNumber) });
    });
  });

  [resultSheet, unitSheet].forEach(sheet => {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  });

  return workbook;
}

export async function downloadStatisticsExportWorkbook(input: {
  projectName: string;
  title: string;
  options: StatisticExportOption[];
}) {
  const workbook = await createStatisticsExportWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const dateKey = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  anchor.download = `統計結果_${input.projectName}_${input.title}_${dateKey}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
