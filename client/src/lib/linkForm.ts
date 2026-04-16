export type BookingLinkMutationPayload = {
  id?: number;
  companyId: number;
  projectId: number;
  type: "initial" | "reinspect";
  isEnabled: boolean;
  startsAt: Date;
  endsAt: Date;
  disabledReason: string;
};

export type BookingLinkFormValue = {
  id?: number;
  companyId: string;
  projectId: string;
  type: string;
  isEnabled: boolean;
  startsAt: string;
  endsAt: string;
  disabledReason: string;
};

export function validateBookingLinkForm(form: BookingLinkFormValue) {
  if (!form.companyId || !form.projectId) {
    return { ok: false as const, message: "請先選擇公司與建案，再確認產生預約連結" };
  }

  if (!form.startsAt || !form.endsAt) {
    return { ok: false as const, message: "請先填入連結啟用開始與結束時間" };
  }

  const type = form.type === "reinspect" ? "reinspect" : "initial";

  const payload: BookingLinkMutationPayload = {
    id: form.id,
    companyId: Number(form.companyId),
    projectId: Number(form.projectId),
    type,
    isEnabled: form.isEnabled,
    startsAt: new Date(form.startsAt),
    endsAt: new Date(form.endsAt),
    disabledReason: form.disabledReason,
  };

  return {
    ok: true as const,
    payload,
  };
}
