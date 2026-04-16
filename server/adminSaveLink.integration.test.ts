import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getAdminDashboardData, upsertCompanyRecord, upsertProjectRecord } from "./db";
import { buildBookingLinkUrlMap } from "../client/src/lib/adminDashboard";

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

describe("admin saveLink integration", () => {
  it(
    "requires complete data before creation and exposes the shareable url after confirmation",
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

      const cookie = loginRecorder.headers.get("Set-Cookie");
      expect(cookie).toContain("inspection_admin_session=");

      const companyId = await upsertCompanyRecord({
        slug: `integration-company-${Date.now()}`,
        name: `Integration Company ${Date.now()}`,
        logoUrl: "https://example.com/logo.png",
        contactPhone: "04-1000-0001",
        contactEmail: "integration@example.com",
        heroTitle: "Integration Hero",
        heroDescription: "Integration Description",
        inspectionFlow: "1. 驗證\n2. 預約",
        handoverFlow: "交屋流程",
        precautions: "注意事項",
        faqItems: [{ question: "Q1", answer: "A1" }],
        contactWindow: "週一至週五",
      });

      const projectId = await upsertProjectRecord({
        companyId,
        slug: `integration-project-${Date.now()}`,
        name: `Integration Project ${Date.now()}`,
        unitFormatHint: "A-4-A",
        houseNumberExample: "A-4-A",
        address: "台中市測試路 1 號",
      });

      const caller = appRouter.createCaller(createContext(cookie || ""));

      await expect(
        caller.admin.saveLink({
          companyId,
          projectId,
          type: "initial",
          isEnabled: true,
          startsAt: new Date(),
          endsAt: "" as unknown as Date,
          disabledReason: "",
        })
      ).rejects.toThrow();

      const createResult = await caller.admin.saveLink({
        companyId,
        projectId,
        type: "initial",
        isEnabled: true,
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        disabledReason: "",
      });

      expect(createResult.success).toBe(true);
      expect(createResult.id).toBeGreaterThan(0);

      const dashboard = await getAdminDashboardData();
      const createdLink = dashboard.links.find(link => link.id === createResult.id);
      expect(createdLink?.shareToken).toBeTruthy();

      const urlMap = buildBookingLinkUrlMap({
        origin: "https://inspectionshop-chxaqqnk.manus.space",
        companies: dashboard.companies,
        projects: dashboard.projects,
        links: dashboard.links,
      });

      expect(urlMap.get(createResult.id)).toBe(
        `https://inspectionshop-chxaqqnk.manus.space/?link=${createdLink!.shareToken}`
      );
    },
    20000
  );
});
