import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { bookingLinks, bookingReschedules, bookings, bookingSlots, companies, projects, residents } from "../drizzle/schema";
import {
  createBookingRecord,
  deleteBookingLinkRecord,
  deleteCompanyRecord,
  deleteProjectRecord,
  deleteResidentRecord,
  getDb,
  rescheduleBookingRecord,
  setBookingLinkEnabledRecord,
  upsertBookingLinkRecord,
  upsertBookingSlotRecord,
  upsertCompanyRecord,
  upsertProjectRecord,
  upsertResidentRecord,
} from "./db";

function makeFaq(name: string) {
  return [{ question: `${name} 如何預約？`, answer: "先驗證戶號與手機，再選擇時段。" }];
}

describe("admin deletion lifecycle", () => {
  it("hard deletes a company together with all dependent projects, residents, links, slots, bookings and reschedule history", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companySlug = `delete-company-${suffix}`;
    const projectSlug = `delete-project-${suffix}`;

    const companyId = await upsertCompanyRecord({
      slug: companySlug,
      name: `公司整包刪除測試 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-1234-5678",
      contactEmail: "qa@example.com",
      heroTitle: "公司整包刪除測試",
      heroDescription: "公司刪除時應連動刪除全部下層資料",
      inspectionFlow: "流程",
      handoverFlow: "交屋",
      precautions: "注意事項",
      faqItems: makeFaq(`公司整包刪除測試 ${suffix}`),
      contactWindow: "窗口",
    });

    const projectId = await upsertProjectRecord({
      companyId,
      slug: projectSlug,
      name: `建案整包刪除測試 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    const residentId = await upsertResidentRecord({
      companyId,
      projectId,
      unitNumber: `A-${suffix}`,
      phoneNumber: `09${String(suffix).slice(-8)}`,
      note: "公司刪除測試住戶",
    });

    const startsAt = new Date(Date.now() - 60 * 60 * 1000);
    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const linkId = await upsertBookingLinkRecord({
      companyId,
      projectId,
      type: "initial",
      isEnabled: true,
      startsAt,
      endsAt,
      disabledReason: null,
    });

    const slotId = await upsertBookingSlotRecord({
      companyId,
      projectId,
      slotDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startLabel: "09:00",
      endLabel: "10:30",
      capacity: 1,
      isActive: true,
    });

    const slotId2 = await upsertBookingSlotRecord({
      companyId,
      projectId,
      slotDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      startLabel: "10:30",
      endLabel: "12:00",
      capacity: 1,
      isActive: true,
    });

    const bookingId = await createBookingRecord({
      companySlug,
      projectSlug,
      type: "initial",
      residentId,
      slotId,
      gmail: `owner${suffix}@gmail.com`,
      hasInspectionCompany: false,
    });

    await rescheduleBookingRecord({
      bookingId,
      newSlotId: slotId2,
      note: "公司刪除前先建立改期歷程",
      changedBy: process.env.ADMIN_USERNAME || "admin",
    });

    await expect(deleteCompanyRecord(companyId)).resolves.toBe(companyId);

    const [companyRows, projectRows, residentRows, linkRows, slotRows, bookingRows, rescheduleRows] = await Promise.all([
      db.select().from(companies).where(eq(companies.id, companyId)),
      db.select().from(projects).where(eq(projects.companyId, companyId)),
      db.select().from(residents).where(eq(residents.companyId, companyId)),
      db.select().from(bookingLinks).where(eq(bookingLinks.companyId, companyId)),
      db.select().from(bookingSlots).where(eq(bookingSlots.companyId, companyId)),
      db.select().from(bookings).where(eq(bookings.companyId, companyId)),
      db.select().from(bookingReschedules).where(eq(bookingReschedules.bookingId, bookingId)),
    ]);

    expect(companyRows).toHaveLength(0);
    expect(projectRows).toHaveLength(0);
    expect(residentRows).toHaveLength(0);
    expect(linkRows).toHaveLength(0);
    expect(slotRows).toHaveLength(0);
    expect(bookingRows).toHaveLength(0);
    expect(rescheduleRows).toHaveLength(0);
    expect(linkId).toBeGreaterThan(0);
  }, 40000);

  it("hard deletes a project together with its residents, links, slots, bookings and reschedule history", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companySlug = `delete-project-company-${suffix}`;
    const projectSlug = `delete-project-only-${suffix}`;

    const companyId = await upsertCompanyRecord({
      slug: companySlug,
      name: `建案整包刪除測試公司 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-2222-3333",
      contactEmail: "qa@example.com",
      heroTitle: "建案整包刪除測試",
      heroDescription: "建案刪除時應連動刪除全部下層資料",
      inspectionFlow: "流程",
      handoverFlow: "交屋",
      precautions: "注意事項",
      faqItems: makeFaq(`建案整包刪除測試 ${suffix}`),
      contactWindow: "窗口",
    });

    const projectId = await upsertProjectRecord({
      companyId,
      slug: projectSlug,
      name: `建案整包刪除測試 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    const residentId = await upsertResidentRecord({
      companyId,
      projectId,
      unitNumber: `B-${suffix}`,
      phoneNumber: `09${String(Number(String(suffix).slice(-8)) + 1).padStart(8, "0")}`,
      note: "建案刪除測試住戶",
    });

    const startsAt = new Date(Date.now() - 60 * 60 * 1000);
    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await upsertBookingLinkRecord({
      companyId,
      projectId,
      type: "initial",
      isEnabled: true,
      startsAt,
      endsAt,
      disabledReason: null,
    });

    const slotId = await upsertBookingSlotRecord({
      companyId,
      projectId,
      slotDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startLabel: "09:00",
      endLabel: "10:30",
      capacity: 1,
      isActive: true,
    });

    const slotId2 = await upsertBookingSlotRecord({
      companyId,
      projectId,
      slotDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      startLabel: "13:00",
      endLabel: "14:30",
      capacity: 1,
      isActive: true,
    });

    const bookingId = await createBookingRecord({
      companySlug,
      projectSlug,
      type: "initial",
      residentId,
      slotId,
      gmail: `project${suffix}@gmail.com`,
      hasInspectionCompany: true,
    });

    await rescheduleBookingRecord({
      bookingId,
      newSlotId: slotId2,
      note: "建案刪除前先建立改期歷程",
      changedBy: process.env.ADMIN_USERNAME || "admin",
    });

    await expect(deleteProjectRecord(projectId)).resolves.toBe(projectId);

    const [projectRows, residentRows, linkRows, slotRows, bookingRows, rescheduleRows, companyRows] = await Promise.all([
      db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.companyId, companyId))),
      db.select().from(residents).where(eq(residents.projectId, projectId)),
      db.select().from(bookingLinks).where(eq(bookingLinks.projectId, projectId)),
      db.select().from(bookingSlots).where(eq(bookingSlots.projectId, projectId)),
      db.select().from(bookings).where(eq(bookings.projectId, projectId)),
      db.select().from(bookingReschedules).where(eq(bookingReschedules.bookingId, bookingId)),
      db.select().from(companies).where(eq(companies.id, companyId)),
    ]);

    expect(projectRows).toHaveLength(0);
    expect(residentRows).toHaveLength(0);
    expect(linkRows).toHaveLength(0);
    expect(slotRows).toHaveLength(0);
    expect(bookingRows).toHaveLength(0);
    expect(rescheduleRows).toHaveLength(0);
    expect(companyRows).toHaveLength(1);

    await db.delete(companies).where(eq(companies.id, companyId));
  }, 40000);

  it("hard deletes a booking link row while preserving historical bookings", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companySlug = `delete-link-company-${suffix}`;
    const projectSlug = `delete-link-project-${suffix}`;

    const companyId = await upsertCompanyRecord({
      slug: companySlug,
      name: `連結刪除測試公司 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-7654-3210",
      contactEmail: "qa@example.com",
      heroTitle: "連結刪除測試",
      heroDescription: "連結真刪除測試",
      inspectionFlow: "流程",
      handoverFlow: "交屋",
      precautions: "注意事項",
      faqItems: makeFaq(`連結刪除測試 ${suffix}`),
      contactWindow: "窗口",
    });

    const projectId = await upsertProjectRecord({
      companyId,
      slug: projectSlug,
      name: `連結刪除測試建案 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    const residentId = await upsertResidentRecord({
      companyId,
      projectId,
      unitNumber: `C-${suffix}`,
      phoneNumber: `09${String(Number(String(suffix).slice(-8)) + 2).padStart(8, "0")}`,
      note: "連結刪除測試住戶",
    });

    const linkId = await upsertBookingLinkRecord({
      companyId,
      projectId,
      type: "initial",
      isEnabled: true,
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      disabledReason: null,
    });

    const slotId = await upsertBookingSlotRecord({
      companyId,
      projectId,
      slotDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startLabel: "09:00",
      endLabel: "10:30",
      capacity: 1,
      isActive: true,
    });

    const bookingId = await createBookingRecord({
      companySlug,
      projectSlug,
      type: "initial",
      residentId,
      slotId,
      gmail: `link${suffix}@gmail.com`,
      hasInspectionCompany: false,
    });

    await expect(deleteBookingLinkRecord(linkId)).resolves.toBe(linkId);

    const [linkRows, bookingRows] = await Promise.all([
      db.select().from(bookingLinks).where(eq(bookingLinks.id, linkId)),
      db.select().from(bookings).where(eq(bookings.id, bookingId)),
    ]);

    expect(linkRows).toHaveLength(0);
    expect(bookingRows).toHaveLength(1);

    await deleteCompanyRecord(companyId);
  }, 40000);

  it("can stop and re-enable a booking link without deleting the row", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companyId = await upsertCompanyRecord({
      slug: `toggle-link-company-${suffix}`,
      name: `連結開關測試公司 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-7777-8888",
      contactEmail: "qa@example.com",
      heroTitle: "連結開關測試",
      heroDescription: "連結停止與重新啟用測試",
      inspectionFlow: "流程",
      handoverFlow: "交屋",
      precautions: "注意事項",
      faqItems: makeFaq(`連結開關測試 ${suffix}`),
      contactWindow: "窗口",
    });

    const projectId = await upsertProjectRecord({
      companyId,
      slug: `toggle-link-project-${suffix}`,
      name: `連結開關測試建案 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    const linkId = await upsertBookingLinkRecord({
      companyId,
      projectId,
      type: "initial",
      isEnabled: true,
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      disabledReason: null,
    });

    await expect(setBookingLinkEnabledRecord({ id: linkId, isEnabled: false, disabledReason: "手動停止測試" })).resolves.toBe(linkId);

    const [disabledRow] = await db.select().from(bookingLinks).where(eq(bookingLinks.id, linkId)).limit(1);
    expect(disabledRow?.isEnabled).toBe(false);
    expect(disabledRow?.disabledReason).toBe("手動停止測試");

    await expect(setBookingLinkEnabledRecord({ id: linkId, isEnabled: true })).resolves.toBe(linkId);

    const [enabledRow] = await db.select().from(bookingLinks).where(eq(bookingLinks.id, linkId)).limit(1);
    expect(enabledRow?.isEnabled).toBe(true);
    expect(enabledRow?.disabledReason).toBeNull();

    await deleteCompanyRecord(companyId);
  }, 40000);

  it("still blocks resident deletion when booking history already exists", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companySlug = `delete-resident-company-${suffix}`;
    const projectSlug = `delete-resident-project-${suffix}`;

    const companyId = await upsertCompanyRecord({
      slug: companySlug,
      name: `住戶刪除測試公司 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-1357-2468",
      contactEmail: "qa@example.com",
      heroTitle: "住戶刪除測試",
      heroDescription: "住戶刪除仍需保留歷程",
      inspectionFlow: "流程",
      handoverFlow: "交屋",
      precautions: "注意事項",
      faqItems: makeFaq(`住戶刪除測試 ${suffix}`),
      contactWindow: "窗口",
    });

    const projectId = await upsertProjectRecord({
      companyId,
      slug: projectSlug,
      name: `住戶刪除測試建案 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    const residentId = await upsertResidentRecord({
      companyId,
      projectId,
      unitNumber: `D-${suffix}`,
      phoneNumber: `09${String(Number(String(suffix).slice(-8)) + 3).padStart(8, "0")}`,
      note: "住戶刪除測試住戶",
    });

    await upsertBookingLinkRecord({
      companyId,
      projectId,
      type: "initial",
      isEnabled: true,
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      disabledReason: null,
    });

    const slotId = await upsertBookingSlotRecord({
      companyId,
      projectId,
      slotDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      startLabel: "15:30",
      endLabel: "17:00",
      capacity: 1,
      isActive: true,
    });

    await createBookingRecord({
      companySlug,
      projectSlug,
      type: "initial",
      residentId,
      slotId,
      gmail: `resident${suffix}@gmail.com`,
      hasInspectionCompany: false,
    });

    await expect(deleteResidentRecord(residentId)).rejects.toThrow("此住戶已存在預約紀錄，為了保留歷程，不能直接刪除");

    await deleteCompanyRecord(companyId);
  }, 40000);
});
