import { expect, describe, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { companies, projects, residents } from "../drizzle/schema";
import {
  deleteCompanyRecord,
  deleteProjectRecord,
  deleteResidentRecord,
  getDb,
  upsertCompanyRecord,
  upsertProjectRecord,
  upsertResidentRecord,
} from "./db";

describe("admin deletion safeguards", () => {
  it("blocks deleting a company when dependent project data still exists", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companyId = await upsertCompanyRecord({
      slug: `delete-company-${suffix}`,
      name: `刪除測試公司 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-1234-5678",
      heroTitle: "刪除測試",
      heroDescription: "刪除測試公司",
      inspectionFlow: "流程",
      handoverFlow: "交屋",
      precautions: "注意",
      faqItems: [{ question: "Q", answer: "A" }],
      contactWindow: "窗口",
    });

    await upsertProjectRecord({
      companyId,
      slug: `delete-project-${suffix}`,
      name: `刪除測試建案 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    await expect(deleteCompanyRecord(companyId)).rejects.toThrow("此公司底下仍有建案、住戶、連結、時段或預約資料");
  }, 20000);

  it("deletes a project without dependent data and removes the row", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companyId = await upsertCompanyRecord({
      slug: `delete-project-company-${suffix}`,
      name: `建案刪除測試公司 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-1111-2222",
      heroTitle: "建案刪除測試",
      heroDescription: "建案刪除測試公司",
      inspectionFlow: "流程",
      handoverFlow: "交屋",
      precautions: "注意",
      faqItems: [{ question: "Q", answer: "A" }],
      contactWindow: "窗口",
    });

    const projectId = await upsertProjectRecord({
      companyId,
      slug: `delete-empty-project-${suffix}`,
      name: `可刪除建案 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    await expect(deleteProjectRecord(projectId)).resolves.toBe(projectId);

    const rows = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)));
    expect(rows).toHaveLength(0);

    await db.delete(companies).where(eq(companies.id, companyId));
  }, 20000);

  it("blocks deleting a project when dependent resident data still exists", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companyId = await upsertCompanyRecord({
      slug: `delete-project-block-company-${suffix}`,
      name: `建案刪除阻擋公司 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-2222-3333",
      heroTitle: "建案刪除阻擋測試",
      heroDescription: "建案刪除阻擋公司",
      inspectionFlow: "流程",
      handoverFlow: "交屋",
      precautions: "注意",
      faqItems: [{ question: "Q", answer: "A" }],
      contactWindow: "窗口",
    });

    const projectId = await upsertProjectRecord({
      companyId,
      slug: `delete-block-project-${suffix}`,
      name: `不可刪除建案 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    await upsertResidentRecord({
      companyId,
      projectId,
      unitNumber: `A-${suffix}`,
      phoneNumber: `09${String(suffix).slice(-8)}`,
      note: "建案刪除阻擋住戶",
    });

    await expect(deleteProjectRecord(projectId)).rejects.toThrow("此建案底下仍有住戶、連結、時段或預約資料");
  }, 20000);

  it("deletes a resident without bookings and removes the row", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const companyId = await upsertCompanyRecord({
      slug: `delete-resident-company-${suffix}`,
      name: `住戶刪除測試公司 ${suffix}`,
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-7654-3210",
      heroTitle: "住戶刪除測試",
      heroDescription: "住戶刪除測試公司",
      inspectionFlow: "流程",
      handoverFlow: "交屋",
      precautions: "注意",
      faqItems: [{ question: "Q", answer: "A" }],
      contactWindow: "窗口",
    });

    const projectId = await upsertProjectRecord({
      companyId,
      slug: `delete-resident-project-${suffix}`,
      name: `住戶刪除測試建案 ${suffix}`,
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: null,
    });

    const residentId = await upsertResidentRecord({
      companyId,
      projectId,
      unitNumber: `A-${suffix}`,
      phoneNumber: `09${String(suffix).slice(-8)}`,
      note: "可刪除住戶",
    });

    await expect(deleteResidentRecord(residentId)).resolves.toBe(residentId);

    const rows = await db.select().from(residents).where(and(eq(residents.id, residentId), eq(residents.companyId, companyId)));
    expect(rows).toHaveLength(0);

    await db.delete(companies).where(eq(companies.id, companyId));
  }, 20000);
});
