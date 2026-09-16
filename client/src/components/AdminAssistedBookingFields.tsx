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
  slotId: string;
  customTimeRange: string;
  minCustomDate: string;
  note: string;
  gmail: string;
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
  onChangeGmail: (gmail: string) => void;
  onChangeHasInspectionCompany: (hasInspectionCompany: boolean) => void;
  onSyncAvailability: () => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function AdminAssistedBookingFields({
  slotDate,
  customDate,
  slotId,
  customTimeRange,
  minCustomDate,
  note,
  gmail,
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
  onChangeGmail,
  onChangeHasInspectionCompany,
  onSyncAvailability,
  onSubmit,
  onCancel,
}: Props) {
  const needsCustomDate = slotDate === CUSTOM_DATE_OPTION_VALUE;
  const canChooseSlot = Boolean(slotDate) && (!needsCustomDate || Boolean(customDate));

  return (
    <div className="grid gap-4 py-2 md:grid-cols-6">
      <div className="space-y-2">
        <Label htmlFor="admin-assisted-booking-date">預約日期</Label>
        <select
          id="admin-assisted-booking-date"
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
        {needsCustomDate ? (
          <Input
            id="admin-assisted-booking-custom-date"
            type="date"
            min={minCustomDate}
            value={customDate}
            onChange={event => onChangeCustomDate(event.target.value)}
            aria-label="客製日期"
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-assisted-booking-slot">預約時段</Label>
        <select
          id="admin-assisted-booking-slot"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={slotId}
          onFocus={() => triggerRescheduleAvailabilitySync(onSyncAvailability)}
          onMouseDown={() => triggerRescheduleAvailabilitySync(onSyncAvailability)}
          onPointerDown={() => triggerRescheduleAvailabilitySync(onSyncAvailability)}
          onClick={() => triggerRescheduleAvailabilitySync(onSyncAvailability)}
          onChange={event => onChangeSlot(event.target.value)}
          disabled={!canChooseSlot}
        >
          <option value="">
            {!canChooseSlot ? "請先選日期" : isFetching && slotOptions.length === 0 ? "同步餘額中..." : "請選擇"}
          </option>
          {slotOptions.map(slot => (
            <option key={slot.id} value={slot.id} disabled={slot.remaining <= 0}>
              {`${slot.startLabel}-${slot.endLabel} / 餘額 ${slot.remaining}`}
            </option>
          ))}
          <option value={CUSTOM_SLOT_OPTION_VALUE}>自訂時段</option>
        </select>
        {slotId === CUSTOM_SLOT_OPTION_VALUE ? (
          <Input
            id="admin-assisted-booking-custom-time"
            value={customTimeRange}
            onChange={event => onChangeCustomTimeRange(event.target.value)}
            placeholder="例如 14:00-16:00"
            inputMode="text"
            aria-label="自訂時段"
          />
        ) : null}
        <p className="text-xs text-muted-foreground">
          {slotId === CUSTOM_SLOT_OPTION_VALUE
            ? "自訂時段只供此筆代客預約使用，不會顯示在客戶前台。"
            : isFetching
              ? "正在同步最新餘額..."
              : "展開下拉時會再次同步該日期各時段的最新餘額。"}
        </p>
        {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-assisted-booking-note">備註</Label>
        <Input
          id="admin-assisted-booking-note"
          value={note}
          onChange={event => onChangeNote(event.target.value)}
          placeholder="例如：後台協助客戶完成預約"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-assisted-booking-gmail">Email（選填）</Label>
        <Input
          id="admin-assisted-booking-gmail"
          value={gmail}
          onChange={event => onChangeGmail(event.target.value)}
          placeholder="owner@example.com"
          inputMode="email"
        />
      </div>

      <div className="flex items-center gap-2 pt-8">
        <Checkbox
          id="admin-assisted-booking-inspection-company"
          checked={hasInspectionCompany}
          onCheckedChange={checked => onChangeHasInspectionCompany(Boolean(checked))}
        />
        <Label htmlFor="admin-assisted-booking-inspection-company">是否驗屋公司</Label>
      </div>

      <div className="flex items-end gap-2">
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          確認代客預約
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          取消
        </Button>
      </div>
    </div>
  );
}
