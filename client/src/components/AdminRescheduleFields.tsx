import React from "react";
import { triggerRescheduleAvailabilitySync } from "@/lib/adminRescheduleInteractions";
import { CUSTOM_DATE_OPTION_VALUE, CUSTOM_SLOT_OPTION_VALUE } from "@/lib/adminCustomReschedule";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type DateOption = {
  value: string;
  label: string;
};

type SlotOption = {
  id: number;
  startLabel: string;
  endLabel: string;
  remaining: number;
  isCurrentSlot: boolean;
};

type Props = {
  slotDate: string;
  customDate: string;
  newSlotId: string;
  customTimeRange: string;
  minCustomDate: string;
  note: string;
  hasInspectionCompany: boolean;
  dateOptions: DateOption[];
  slotOptions: SlotOption[];
  isFetching: boolean;
  errorMessage?: string;
  isSubmitting: boolean;
  onChangeDate: (slotDate: string) => void;
  onChangeCustomDate: (customDate: string) => void;
  onChangeSlot: (slotId: string) => void;
  onChangeCustomTimeRange: (timeRange: string) => void;
  onChangeNote: (note: string) => void;
  onChangeHasInspectionCompany: (hasInspectionCompany: boolean) => void;
  onSyncAvailability: () => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function AdminRescheduleFields({
  slotDate,
  customDate,
  newSlotId,
  customTimeRange,
  minCustomDate,
  note,
  hasInspectionCompany,
  dateOptions,
  slotOptions,
  isFetching,
  errorMessage,
  isSubmitting,
  onChangeDate,
  onChangeCustomDate,
  onChangeSlot,
  onChangeCustomTimeRange,
  onChangeNote,
  onChangeHasInspectionCompany,
  onSyncAvailability,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <div className="grid gap-4 py-2 md:grid-cols-5">
      <div className="space-y-2">
        <Label htmlFor="admin-reschedule-date">新日期</Label>
        <select
          id="admin-reschedule-date"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={slotDate}
          onChange={event => onChangeDate(event.target.value)}
        >
          <option value="">請選擇</option>
          {dateOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={CUSTOM_DATE_OPTION_VALUE}>客製日期</option>
        </select>
        {slotDate === CUSTOM_DATE_OPTION_VALUE ? (
          <Input
            id="admin-reschedule-custom-date"
            type="date"
            min={minCustomDate}
            value={customDate}
            onChange={event => onChangeCustomDate(event.target.value)}
            aria-label="客製日期"
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-reschedule-slot">新時段</Label>
        <select
          id="admin-reschedule-slot"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={newSlotId}
          onFocus={() => triggerRescheduleAvailabilitySync(onSyncAvailability)}
          onMouseDown={() => triggerRescheduleAvailabilitySync(onSyncAvailability)}
          onPointerDown={() => triggerRescheduleAvailabilitySync(onSyncAvailability)}
          onClick={() => triggerRescheduleAvailabilitySync(onSyncAvailability)}
          onChange={event => onChangeSlot(event.target.value)}
          disabled={!slotDate || (slotDate === CUSTOM_DATE_OPTION_VALUE && !customDate)}
        >
          <option value="">
            {!slotDate || (slotDate === CUSTOM_DATE_OPTION_VALUE && !customDate)
              ? "請先選日期"
              : isFetching && slotOptions.length === 0
                ? "同步餘額中..."
                : "請選擇"}
          </option>
          {slotOptions.map(slot => (
            <option key={slot.id} value={slot.id} disabled={slot.remaining <= 0}>
              {`${slot.startLabel}-${slot.endLabel} / 餘額 ${slot.remaining}${slot.isCurrentSlot ? " / 目前時段" : ""}`}
            </option>
          ))}
          <option value={CUSTOM_SLOT_OPTION_VALUE}>自訂時段</option>
        </select>
        {newSlotId === CUSTOM_SLOT_OPTION_VALUE ? (
          <Input
            id="admin-reschedule-custom-time"
            value={customTimeRange}
            onChange={event => onChangeCustomTimeRange(event.target.value)}
            placeholder="例如 14:00-16:00"
            inputMode="text"
            aria-label="自訂時段"
          />
        ) : null}
        <p className="text-xs text-muted-foreground">
          {newSlotId === CUSTOM_SLOT_OPTION_VALUE
            ? "自訂時段只供這一筆預約使用，不會顯示在客戶前台。"
            : isFetching
              ? "正在同步最新餘額..."
              : "展開下拉時會再次同步該日期各時段的最新餘額。"}
        </p>
        {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-reschedule-note">備註</Label>
        <Input
          id="admin-reschedule-note"
          value={note}
          onChange={event => onChangeNote(event.target.value)}
          placeholder="例如：住戶要求改期"
        />
      </div>

      <div className="space-y-2">
        <Label>驗屋公司</Label>
        <label className="flex min-h-10 items-center gap-3 rounded-md border border-input px-3 text-sm">
          <Checkbox checked={hasInspectionCompany} onCheckedChange={checked => onChangeHasInspectionCompany(Boolean(checked))} />
          <span>此次驗屋由驗屋公司陪同</span>
        </label>
      </div>

      <div className="flex items-end gap-2">
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          確認改期
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          取消
        </Button>
      </div>
    </div>
  );
}
