import React from "react";
import { AdminRescheduleFields } from "@/components/AdminRescheduleFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type AdminBookingRecordRow = {
  id: number;
  companyId: number;
  projectId: number;
  linkId: number;
  slotId: number;
  companyName: string;
  projectName: string;
  bookingType: "initial" | "reinspect";
  unitNumberSnapshot: string;
  phoneNumberSnapshot: string;
  gmail: string;
  hasInspectionCompany: boolean;
  status: "booked" | "rescheduled" | "cancelled";
  internalNote: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  slotDate: Date;
  startLabel: string;
  endLabel: string;
};

export type AdminBookingDateOption = { value: string; label: string };
export type AdminBookingSlotOption = { id: number; startLabel: string; endLabel: string; remaining: number; isCurrentSlot: boolean };

export function formatDateOnly(value: string | number | Date) {
  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatInspectionCompanyLabel(hasInspectionCompany: boolean) {
  return hasInspectionCompany ? "有" : "無";
}

type Props = {
  bookings: AdminBookingRecordRow[];
  editingBookingId: string;
  rescheduleForm: { slotDate: string; newSlotId: string; note: string };
  dateOptions: AdminBookingDateOption[];
  slotOptions: AdminBookingSlotOption[];
  isFetching: boolean;
  errorMessage?: string;
  isSubmitting: boolean;
  onStartEditing: (booking: AdminBookingRecordRow) => void;
  onChangeDate: (nextDate: string) => void;
  onChangeSlot: (newSlotId: string) => void;
  onChangeNote: (note: string) => void;
  onSyncAvailability: () => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function AdminBookingRecordsTable({
  bookings,
  editingBookingId,
  rescheduleForm,
  dateOptions,
  slotOptions,
  isFetching,
  errorMessage,
  isSubmitting,
  onStartEditing,
  onChangeDate,
  onChangeSlot,
  onChangeNote,
  onSyncAvailability,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>公司 / 建案</TableHead>
          <TableHead>戶號</TableHead>
          <TableHead>類型</TableHead>
          <TableHead>時段</TableHead>
          <TableHead>是否驗屋公司</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map(booking => (
          <React.Fragment key={booking.id}>
            <TableRow>
              <TableCell>{booking.id}</TableCell>
              <TableCell>
                {booking.companyName} / {booking.projectName}
              </TableCell>
              <TableCell>{booking.unitNumberSnapshot}</TableCell>
              <TableCell>{booking.bookingType}</TableCell>
              <TableCell>
                {formatDateOnly(booking.slotDate)} {booking.startLabel}-{booking.endLabel}
              </TableCell>
              <TableCell>
                <Badge variant={booking.hasInspectionCompany ? "outline" : "secondary"}>
                  {formatInspectionCompanyLabel(booking.hasInspectionCompany)}
                </Badge>
              </TableCell>
              <TableCell>{booking.status}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => onStartEditing(booking)}>
                  {editingBookingId === String(booking.id) ? "編輯中" : "編輯改期"}
                </Button>
              </TableCell>
            </TableRow>
            {editingBookingId === String(booking.id) ? (
              <TableRow>
                <TableCell colSpan={8} className="bg-muted/20">
                  <AdminRescheduleFields
                    slotDate={rescheduleForm.slotDate}
                    newSlotId={rescheduleForm.newSlotId}
                    note={rescheduleForm.note}
                    dateOptions={dateOptions}
                    slotOptions={slotOptions}
                    isFetching={isFetching}
                    errorMessage={errorMessage}
                    isSubmitting={isSubmitting}
                    onChangeDate={onChangeDate}
                    onChangeSlot={onChangeSlot}
                    onChangeNote={onChangeNote}
                    onSyncAvailability={onSyncAvailability}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
