import { describe, expect, it } from "vitest";

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getAdminDashboardData, getDb, getPublicSiteContext, upsertCompanyRecord, upsertProjectRecord } from "./db";
import { bookingSlots } from "../drizzle/schema";
import { filterSlotsByLink } from "../client/src/lib/slotForms";

function createResponseRecorder() {
  const headers = new Map<string, string>();
  return {
    headers,
    res: {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
    },
  };
}

function createContext(cookie = ""): TrpcContext {
  return {
    user: null,
    req: {
      headers: cookie ? { cookie } : {},
    } as TrpcContext["req"],
    res: {
      setHeader() {
        return undefined;
      },
      clearCookie() {
        return undefined;
      },
    } as TrpcContext["res"],
  };
}

describe("slot management integration", () => {
  it(
    "shows only link-owned slots in dashboard/public context and hides legacy shared slots",
    async () => {
      const loginRecorder = createResponseRecorder();
      const loginCaller = appRouter.createCaller({
        user: null,
        req: { headers: {} } as TrpcContext["req"],
        res: loginRecorder.res as TrpcContext["res"],
      });

      await loginCaller.adminAuth.login({
        username: process.env.ADMIN_USERNAME || "admin",
        password: process.env.ADMIN_PASSWORD || "ChangeMe123!",
      });

      const cookie = loginRecorder.headers.get("Set-Cookie") || "";
      const caller = appRouter.createCaller(createContext(cookie));

      const stamp = Date.now();
      const companyId = await upsertCompanyRecord({
        slug: `slot-company-${stamp}`,
        name: `Slot Company ${stamp}`,
        logoUrl: "https://example.com/logo.png",
        contactPhone: "04-2000-0001",
        contactEmail: "slot@example.com",
        heroTitle: "Slot Hero",
        heroDescription: "Slot Description",
        inspectionFlow: "1. 驗證\n2. 預約",
        handoverFlow: "交屋流程",
        precautions: "注意事項",
        faqItems: [{ question: "Q1", answer: "A1" }],
        contactWindow: "週一至週五",
      });

      const projectId = await upsertProjectRecord({
        companyId,
        slug: `slot-project-${stamp}`,
        name: `Slot Project ${stamp}`,
        unitFormatHint: "A-4-A",
        houseNumberExample: "A-4-A",
        address: "台中市測試路 2 號",
      });

      const startsAt = new Date(Date.now() - 60 * 60 * 1000);
      const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const initialLink = await caller.admin.saveLink({
        companyId,
        projectId,
        type: "initial",
        isEnabled: true,
        startsAt,
        endsAt,
        disabledReason: "",
      });

      const reinspectLink = await caller.admin.saveLink({
        companyId,
        projectId,
        type: "reinspect",
        isEnabled: true,
        startsAt,
        endsAt,
        disabledReason: "",
      });

      const slotDate = new Date("2026-05-20T00:00:00.000Z");
      const createdSlot = await caller.admin.saveSlot({
        linkId: initialLink.id,
        slotDate,
        startLabel: "09:00",
        endLabel: "10:30",
        capacity: 3,
        isActive: true,
      });

      const db = await getDb();
      if (!db) {
        throw new Error("資料庫尚未連線");
      }

      await db.insert(bookingSlots).values({
        companyId,
        projectId,
        linkId: null,
        slotDate,
        startLabel: "14:00",
        endLabel: "15:30",
        capacity: 2,
        isActive: true,
      });

      const dashboard = await getAdminDashboardData();
      const initialSlots = filterSlotsByLink(dashboard.slots, String(initialLink.id));
      const reinspectSlots = filterSlotsByLink(dashboard.slots, String(reinspectLink.id));

      expect(initialSlots.map(slot => slot.id)).toContain(createdSlot.id);
      expect(reinspectSlots).toHaveLength(0);
      expect(dashboard.slots.some(slot => slot.linkId == null)).toBe(false);

      const createdLinkRow = dashboard.links.find(link => link.id === initialLink.id);
      expect(createdLinkRow?.shareToken).toBeTruthy();

      const publicContext = await getPublicSiteContext({ linkToken: createdLinkRow!.shareToken });
      expect(publicContext.availableSlots).toHaveLength(1);
      expect(publicContext.availableSlots[0]?.id).toBe(createdSlot.id);
      expect(publicContext.availableSlots[0]?.startLabel).toBe("09:00");
    },
    20000
  );

  it(
    "blocks duplicate slots on the same link and returns a clear duplicate message",
    async () => {
      const loginRecorder = createResponseRecorder();
      const loginCaller = appRouter.createCaller({
        user: null,
        req: { headers: {} } as TrpcContext["req"],
        res: loginRecorder.res as TrpcContext["res"],
      });

      await loginCaller.adminAuth.login({
        username: process.env.ADMIN_USERNAME || "admin",
        password: process.env.ADMIN_PASSWORD || "ChangeMe123!",
      });

      const cookie = loginRecorder.headers.get("Set-Cookie") || "";
      const caller = appRouter.createCaller(createContext(cookie));

      const stamp = Date.now() + 1;
      const companyId = await upsertCompanyRecord({
        slug: `duplicate-slot-company-${stamp}`,
        name: `Duplicate Slot Company ${stamp}`,
        logoUrl: "https://example.com/logo.png",
        contactPhone: "04-2000-0002",
        contactEmail: "duplicate@example.com",
        heroTitle: "Duplicate Hero",
        heroDescription: "Duplicate Description",
        inspectionFlow: "1. 驗證\n2. 預約",
        handoverFlow: "交屋流程",
        precautions: "注意事項",
        faqItems: [{ question: "Q1", answer: "A1" }],
        contactWindow: "週一至週五",
      });

      const projectId = await upsertProjectRecord({
        companyId,
        slug: `duplicate-slot-project-${stamp}`,
        name: `Duplicate Slot Project ${stamp}`,
        unitFormatHint: "A-5-A",
        houseNumberExample: "A-5-A",
        address: "台中市測試路 3 號",
      });

      const link = await caller.admin.saveLink({
        companyId,
        projectId,
        type: "initial",
        isEnabled: true,
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        disabledReason: "",
      });

      const payload = {
        linkId: link.id,
        slotDate: new Date("2026-05-21T00:00:00.000Z"),
        startLabel: "10:30",
        endLabel: "12:00",
        capacity: 2,
        isActive: true,
      };

      await caller.admin.saveSlot(payload);

      await expect(caller.admin.saveSlot(payload)).rejects.toThrow(
        "同一預約連結在這個日期與時段已存在紀錄，請勿重複建立"
      );
    },
    20000
  );
});
