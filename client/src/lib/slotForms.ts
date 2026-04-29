type LinkRecord = {
  id: number;
  projectId: number;
  type?: string;
  isEnabled?: boolean;
};

type SlotRecord = {
  id: number;
  projectId: number;
  linkId: number | null;
  slotDate: Date;
  startLabel: string;
  endLabel: string;
  capacity: number;
  isActive: boolean;
};

export type EditablePreset = {
  key: string;
  startLabel: string;
  endLabel: string;
};

export type SlotDateMode = "single" | "range";

export type SlotFormInput = {
  id?: string;
  linkId: string;
  slotDate: string;
  rangeStartDate?: string;
  rangeEndDate?: string;
  dateMode?: SlotDateMode;
  startLabel: string;
  endLabel: string;
  capacity: string;
  isActive: boolean;
};

const DEFAULT_PRESET_SLOTS: EditablePreset[] = [
  { key: "preset-1", startLabel: "09:00", endLabel: "10:30" },
  { key: "preset-2", startLabel: "10:30", endLabel: "12:00" },
  { key: "preset-3", startLabel: "14:00", endLabel: "15:30" },
  { key: "preset-4", startLabel: "15:30", endLabel: "17:00" },
];

function parseCapacity(capacityValue: string) {
  const capacity = Number(capacityValue);
  if (!Number.isFinite(capacity) || capacity < 1) {
    return { ok: false as const, message: "名額至少要 1 位" };
  }

  return { ok: true as const, capacity };
}

function enumerateDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return { ok: false as const, message: "請先完整選擇日期區間" };
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false as const, message: "日期區間格式不正確" };
  }

  if (start > end) {
    return { ok: false as const, message: "日期區間的開始日期不能晚於結束日期" };
  }

  const result: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return { ok: true as const, dates: result };
}

export function getLinksForProject<T extends LinkRecord>(links: T[], projectId: string) {
  const parsedProjectId = Number(projectId);
  if (!parsedProjectId) return [] as T[];
  return links.filter(link => link.projectId === parsedProjectId);
}

export function filterSlotsByLink<T extends SlotRecord>(slots: T[], linkId: string) {
  const parsedLinkId = Number(linkId);
  if (!parsedLinkId) {
    return slots.filter(slot => slot.linkId != null);
  }
  return slots.filter(slot => slot.linkId === parsedLinkId);
}

export function createEditableSlotPresets() {
  return DEFAULT_PRESET_SLOTS.map(preset => ({ ...preset }));
}

export function createEmptySlotForm() {
  return {
    id: "",
    companyId: "",
    projectId: "",
    linkId: "",
    slotDate: "",
    rangeStartDate: "",
    rangeEndDate: "",
    dateMode: "single" as SlotDateMode,
    startLabel: "09:00",
    endLabel: "10:30",
    capacity: "1",
    isActive: true,
  };
}

export function validateSingleSlotForm(input: SlotFormInput) {
  if (!Number(input.linkId)) {
    return { ok: false as const, message: "請先選擇要設定時段的預約連結" };
  }

  if (!input.slotDate) {
    return { ok: false as const, message: "請先選擇時段日期" };
  }

  const capacityResult = parseCapacity(input.capacity);
  if (!capacityResult.ok) {
    return capacityResult;
  }

  if (!input.startLabel.trim() || !input.endLabel.trim()) {
    return { ok: false as const, message: "請完整填寫時段起訖時間" };
  }

  const parsedId = Number(input.id);

  return {
    ok: true as const,
    payload: {
      id: Number.isInteger(parsedId) && parsedId > 0 ? parsedId : undefined,
      linkId: Number(input.linkId),
      slotDate: new Date(input.slotDate),
      startLabel: input.startLabel.trim(),
      endLabel: input.endLabel.trim(),
      capacity: capacityResult.capacity,
      isActive: input.isActive,
    },
  };
}

export function buildPresetSlotPayloads(
  input: Pick<SlotFormInput, "linkId" | "slotDate" | "rangeStartDate" | "rangeEndDate" | "dateMode" | "capacity" | "isActive">,
  presets: EditablePreset[]
) {
  if (!Number(input.linkId)) {
    return { ok: false as const, message: "請先選擇要設定時段的預約連結" };
  }

  const capacityResult = parseCapacity(input.capacity);
  if (!capacityResult.ok) {
    return capacityResult;
  }

  const dateMode = input.dateMode === "range" ? "range" : "single";
  const dateResult =
    dateMode === "range"
      ? enumerateDateRange(input.rangeStartDate || "", input.rangeEndDate || "")
      : input.slotDate
        ? { ok: true as const, dates: [new Date(input.slotDate)] }
        : { ok: false as const, message: "請先選擇時段日期" };

  if (!dateResult.ok) {
    return dateResult;
  }

  const seen = new Set<string>();
  const payloads = [] as Array<{
    linkId: number;
    slotDate: Date;
    startLabel: string;
    endLabel: string;
    capacity: number;
    isActive: boolean;
  }>;

  for (const preset of presets) {
    const startLabel = preset.startLabel.trim();
    const endLabel = preset.endLabel.trim();
    if (!startLabel || !endLabel) {
      return { ok: false as const, message: "每一筆預設時段都必須填寫起訖時間" };
    }

    const key = `${startLabel}-${endLabel}`;
    if (seen.has(key)) {
      return { ok: false as const, message: `預設時段 ${key} 重複，請先修正後再建立` };
    }
    seen.add(key);

    for (const date of dateResult.dates) {
      payloads.push({
        linkId: Number(input.linkId),
        slotDate: new Date(date),
        startLabel,
        endLabel,
        capacity: capacityResult.capacity,
        isActive: input.isActive,
      });
    }
  }

  return { ok: true as const, payloads };
}
