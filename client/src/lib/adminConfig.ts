export const DEFAULT_SLOT_PRESETS = [
  { startLabel: "09:00", endLabel: "10:30" },
  { startLabel: "10:30", endLabel: "12:00" },
  { startLabel: "14:00", endLabel: "15:30" },
  { startLabel: "15:30", endLabel: "17:00" },
] as const;

export function createProjectSlug(name: string, companyId: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || `project-${Date.now()}`}-${companyId || "new"}`;
}
