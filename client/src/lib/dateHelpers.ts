export function createStableDateFromDateOnly(dateInput: string) {
  const [yearText, monthText, dayText] = dateInput.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date(Number.NaN);
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function resolveDateValue(dateValue: string | number | Date) {
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return createStableDateFromDateOnly(dateValue);
  }

  return new Date(dateValue);
}

export function formatDateInTaipei(dateValue: string | number | Date) {
  return resolveDateValue(dateValue).toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTimeInTaipei(dateValue: string | number | Date) {
  return resolveDateValue(dateValue).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getDateKeyInTaipei(dateValue: string | number | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(resolveDateValue(dateValue));
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}
