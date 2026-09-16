export const CUSTOM_DATE_OPTION_VALUE = "__custom_date__";
export const CUSTOM_SLOT_OPTION_VALUE = "__custom_slot__";

export function getTaipeiTodayDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function validateAdminCustomTimeRange(value: string) {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return { ok: false as const, message: "自訂時段格式須為 HH:mm-HH:mm，例如 14:00-16:00" };
  }

  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = Number(match[3]) * 60 + Number(match[4]);
  if (endMinutes <= startMinutes) {
    return { ok: false as const, message: "自訂時段的結束時間必須晚於開始時間" };
  }

  return { ok: true as const, value: `${match[1]}:${match[2]}-${match[3]}:${match[4]}` };
}
