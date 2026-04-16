import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { bookingReschedules, bookings, companies, projects } from "../drizzle/schema";
import {
  createBookingRecord,
  getDb,
  rescheduleBookingRecord,
  searchBookings,
  setBookingLinkEnabledRecord,
  upsertBookingLinkRecord,
  upsertBookingSlotRecord,
  upsertCompanyRecord,
  upsertProjectRecord,
  upsertResidentRecord,
  verifyResidentForBooking,
} from "./db";

function makeFaq(name: string) {
  return [{ question: `${name} 如何預約？`, answer: "先驗證戶號與手機，再選擇時段。" }];
}

describe("booking flow integration", () => {
  it("supports verification, booking creation, full-slot protection, expired-link blocking and reschedule history", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companySlug = `qa-${suffix}`;
    const projectSlug = `qa-project-${suffix}`;
    const unitNumber = `A-${suffix}`;
    const phoneNumber = `09${String(suffix).slice(-8)}`;
    const phoneNumber2 = `09${String(Number(String(suffix).slice(-8)) + 1).padStart(8, "0")}`;

    const companyId = await upsertCompanyRecord({
      slug: companySlug,
      name: `測試建設 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-1234-5678",
      contactEmail: "qa@example.com",
      heroTitle: "測試驗屋預約系統",
      heroDescription: "用於測試住戶驗證與預約流程。",
      inspectionFlow: "1. 驗證身分\n2. 選擇時段",
      handoverFlow: "依公司安排進行交屋。",
      precautions: "請準時到場。",
      faqItems: makeFaq(`測試建設 ${suffix}`),
      contactWindow: "測試客服窗口",
    });

    const projectId = await upsertProjectRecord({
      companyId,
      slug: projectSlug,
      name: `測試建案 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    const residentId = await upsertResidentRecord({
      companyId,
      projectId,
      unitNumber,
      phoneNumber,
      note: "第一位住戶",
    });

    const residentId2 = await upsertResidentRecord({
      companyId,
      projectId,
      unitNumber,
      phoneNumber: phoneNumber2,
      note: "同戶第二位聯絡人",
    });

    const startsAt = new Date(Date.now() - 60 * 60 * 1000);
    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const initialLinkId = await upsertBookingLinkRecord({
      companyId,
      projectId,
      type: "initial",
      isEnabled: true,
      startsAt,
      endsAt,
      disabledReason: null,
    });

    await upsertBookingLinkRecord({
      companyId,
      projectId,
      type: "reinspect",
      isEnabled: true,
      startsAt,
      endsAt,
      disabledReason: null,
    });

    const slot1Id = await upsertBookingSlotRecord({
      companyId,
      projectId,
      slotDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startLabel: "09:00",
      endLabel: "11:00",
      capacity: 1,
      isActive: true,
    });

    const slot2Id = await upsertBookingSlotRecord({
      companyId,
      projectId,
      slotDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      startLabel: "13:00",
      endLabel: "15:00",
      capacity: 1,
      isActive: true,
    });

    const verified = await verifyResidentForBooking({
      companySlug,
      projectSlug,
      type: "initial",
      unitNumber,
      phoneNumber,
    });

    expect(verified.resident.id).toBe(residentId);
    expect(verified.existingBookings).toHaveLength(0);
    expect(verified.site.link.id).toBe(initialLinkId);
    expect(verified.site.link.shareToken).toBeTruthy();

    const verifiedWithSecondPhone = await verifyResidentForBooking({
      linkToken: verified.site.link.shareToken,
      unitNumber,
      phoneNumber: phoneNumber2,
    });

    expect(verifiedWithSecondPhone.resident.id).toBe(residentId2);
    expect(verifiedWithSecondPhone.site.link.id).toBe(initialLinkId);

    const bookingId = await createBookingRecord({
      companySlug,
      projectSlug,
      type: "initial",
      residentId,
      slotId: slot1Id,
      gmail: `owner${suffix}@gmail.com`,
      hasInspectionCompany: true,
    });

    const verifiedAfterBooking = await verifyResidentForBooking({
      companySlug,
      projectSlug,
      type: "initial",
      unitNumber,
      phoneNumber,
    });

    expect(verifiedAfterBooking.existingBookings).toHaveLength(1);
    expect(verifiedAfterBooking.existingBookings[0]?.id).toBe(bookingId);

    await expect(
      createBookingRecord({
        companySlug,
        projectSlug,
        type: "initial",
        residentId,
        slotId: slot2Id,
        gmail: `duplicate${suffix}@gmail.com`,
        hasInspectionCompany: false,
      })
    ).rejects.toThrow("此戶號已存在同類型預約");

    await rescheduleBookingRecord({
      bookingId,
      newSlotId: slot2Id,
      note: "管理員改期測試",
      changedBy: process.env.ADMIN_USERNAME || "admin",
    });

    const rescheduledBookings = await searchBookings({ projectId, status: "rescheduled" });
    expect(rescheduledBookings.some(item => item.id === bookingId && item.startLabel === "13:00")).toBe(true);

    const [history] = await db.select().from(bookingReschedules).where(eq(bookingReschedules.bookingId, bookingId)).limit(1);
    expect(history?.oldSlotId).toBe(slot1Id);
    expect(history?.newSlotId).toBe(slot2Id);
    expect(history?.note).toBe("管理員改期測試");

    await expect(
      createBookingRecord({
        linkToken: verified.site.link.shareToken,
        residentId: residentId2,
        slotId: slot1Id,
        gmail: `full${suffix}@gmail.com`,
        hasInspectionCompany: false,
      })
    ).rejects.toThrow("此戶號已存在同類型預約");

    await setBookingLinkEnabledRecord({
      id: initialLinkId,
      isEnabled: false,
      disabledReason: "後台手動停止初驗連結",
    });

    await expect(
      verifyResidentForBooking({
        companySlug,
        projectSlug,
        type: "initial",
        unitNumber,
        phoneNumber,
      })
    ).rejects.toThrow("此預約連結已截止");

    const expiredProjectSlug = `qa-expired-${suffix}`;
    const expiredProjectId = await upsertProjectRecord({
      companyId,
      slug: expiredProjectSlug,
      name: `逾期建案 ${suffix}`,
      unitFormatHint: "樓層-戶別",
      houseNumberExample: "4-A",
      address: null,
    });

    await upsertResidentRecord({
      companyId,
      projectId: expiredProjectId,
      unitNumber: `4-${suffix}`,
      phoneNumber: `09${String(Number(String(suffix).slice(-8)) + 2).padStart(8, "0")}`,
      note: "逾期連結住戶",
    });

    await upsertBookingLinkRecord({
      companyId,
      projectId: expiredProjectId,
      type: "initial",
      isEnabled: true,
      startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      disabledReason: null,
    });

    await expect(
      verifyResidentForBooking({
        companySlug,
        projectSlug: expiredProjectSlug,
        type: "initial",
        unitNumber: `4-${suffix}`,
        phoneNumber: `09${String(Number(String(suffix).slice(-8)) + 2).padStart(8, "0")}`,
      })
    ).rejects.toThrow("此預約連結已截止");

    const [companyRow] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    const [projectRow] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.companyId, companyId))).limit(1);
    const [bookingRow] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);

    expect(companyRow?.slug).toBe(companySlug);
    expect(projectRow?.slug).toBe(projectSlug);
    expect(bookingRow?.status).toBe("rescheduled");
  }, 40000);
});
