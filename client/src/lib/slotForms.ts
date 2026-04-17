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

type EditablePreset = {
  key: string;
  startLabel: string;
  endLabel: string;
};

type SlotFormInput = {
  linkId: string;
  slotDate: string;
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

export function validateSingleSlotForm(input: SlotFormInput) {
  if (!Number(input.linkId)) {
    return { ok: false as const, message: "請先選擇要設定時段的預約連結" };
  }

  if (!input.slotDate) {
    return { ok: false as const, message: "請先選擇時段日期" };
  }

  const capacity = Number(input.capacity);
  if (!Number.isFinite(capacity) || capacity < 1) {
    return { ok: false as const, message: "名額至少要 1 位" };
  }

  if (!input.startLabel.trim() || !input.endLabel.trim()) {
    return { ok: false as const, message: "請完整填寫時段起訖時間" };
  }

  return {
    ok: true as const,
    payload: {
      linkId: Number(input.linkId),
      slotDate: new Date(input.slotDate),
      startLabel: input.startLabel.trim(),
      endLabel: input.endLabel.trim(),
      capacity,
      isActive: input.isActive,
    },
  };
}

export function buildPresetSlotPayloads(
  input: Pick<SlotFormInput, "linkId" | "slotDate" | "capacity" | "isActive">,
  presets: EditablePreset[]
) {
  if (!Number(input.linkId)) {
    return { ok: false as const, message: "請先選擇要設定時段的預約連結" };
  }

  if (!input.slotDate) {
    return { ok: false as const, message: "請先選擇時段日期" };
  }

  const capacity = Number(input.capacity);
  if (!Number.isFinite(capacity) || capacity < 1) {
    return { ok: false as const, message: "名額至少要 1 位" };
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

    payloads.push({
      linkId: Number(input.linkId),
      slotDate: new Date(input.slotDate),
      startLabel,
      endLabel,
      capacity,
      isActive: input.isActive,
    });
  }

  return { ok: true as const, payloads };
}
