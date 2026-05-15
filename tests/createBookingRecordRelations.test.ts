import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingLinks, bookings, bookingSlots, companies, projects, residents } from "../drizzle/schema";

const { captured, fakeDb } = vi.hoisted(() => {
  const siteRow = {
    company: { id: 10, slug: "eagle", name: "鷁欣建設" },
    project: { id: 20, companyId: 10, slug: "a1", name: "A1" },
    link: {
      id: 30,
      companyId: 10,
      projectId: 20,
      type: "initial" as const,
      isEnabled: true,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };

  const slotRow = {
    id: 40,
    companyId: 10,
    projectId: 20,
    linkId: 30,
    slotDate: new Date("2026-06-01T00:00:00.000Z"),
    startLabel: "09:00",
    endLabel: "10:30",
    capacity: 2,
    isActive: true,
  };

  const captured = {
    residentRow: { id: 50, companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "0912345678", note: null },
    existingBookingRows: [] as Array<unknown>,
    slotUsageRows: [{ used: 0 }],
    slotLookupRows: [] as Array<unknown>,
    insertedBookingPayload: null as null | Record<string, unknown>,
    currentWhere: undefined as unknown,
    lastTransactionWhere: [] as unknown[],
    siteRow,
    slotRow,
    bookingSlotSelectCount: 0,
  };

  const makeSelectChain = (selection?: unknown) => {
    let mode: "active-link" | "slot-usage" | "public-slots" | "resident" | "slot" | "existing-booking" | "slot-capacity" | null = null;

    const hasKeys = (keys: string[]) => Boolean(selection && typeof selection === "object" && keys.every(key => key in (selection as Record<string, unknown>)));

    if (hasKeys(["company", "project", "link"])) mode = "active-link";
    else if (hasKeys(["slotId", "used"])) mode = "slot-usage";
    else if (hasKeys(["id", "slotDate", "startLabel", "endLabel"])) mode = "existing-booking";
    else if (hasKeys(["used"])) mode = "slot-capacity";

    const chain = {
      from() {
        return chain;
      },
      innerJoin() {
        return chain;
      },
      where(condition: unknown) {
        captured.currentWhere = condition;
        if (mode === "slot-usage") return chain;
        if (mode === "existing-booking") {
          captured.lastTransactionWhere.push(condition);
          return { limit: async () => captured.existingBookingRows };
        }
        if (mode === "slot-capacity") {
          captured.lastTransactionWhere.push(condition);
          return Promise.resolve(captured.slotUsageRows);
        }
        return chain;
      },
      orderBy() {
        if (mode === "public-slots") {
          return Promise.resolve([captured.slotRow]);
        }
        return chain;
      },
      groupBy() {
        return Promise.resolve([]);
      },
      limit() {
        if (mode === "active-link") return Promise.resolve([captured.siteRow]);
        if (mode === "resident") return Promise.resolve([captured.residentRow]);
        if (mode === "slot") return Promise.resolve(captured.slotLookupRows);
        return Promise.resolve([]);
      },
    };

    const originalFrom = chain.from;
    chain.from = (table?: unknown) => {
      if (table === residents) mode = "resident";
      if (table === bookingSlots) {
        captured.bookingSlotSelectCount += 1;
        mode = captured.bookingSlotSelectCount === 1 ? "public-slots" : "slot";
      }
      return originalFrom.call(chain, table);
    };

    return chain;
  };

  const fakeDb = {
    select(selection?: unknown) {
      return makeSelectChain(selection);
    },
    insert(table: unknown) {
      return {
        values: async (payload: Record<string, unknown>) => {
          if (table === bookings) {
            captured.insertedBookingPayload = payload;
          }
          return [{ insertId: 999 }];
        },
      };
    },
    transaction: async (callback: (tx: { select: typeof fakeDb.select; insert: typeof fakeDb.insert }) => Promise<unknown>) => {
      return callback({
        select: fakeDb.select,
        insert: fakeDb.insert,
      });
    },
  };

  return { captured, fakeDb };
});

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  asc: (...args: unknown[]) => ({ type: "asc", args }),
  count: (value: unknown) => ({ type: "count", value }),
  desc: (...args: unknown[]) => ({ type: "desc", args }),
  eq: (left: unknown, right: unknown) => ({ type: "eq", left, right }),
  like: (left: unknown, right: unknown) => ({ type: "like", left, right }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", text: String.raw(strings, ...values.map(() => "?")), values }),
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => fakeDb,
}));

describe("createBookingRecord relation rules", () => {
  let dbModule: typeof import("../server/db");

  beforeAll(async () => {
    process.env.DATABASE_URL = "mock://db";
    process.env.VITEST = "1";
    process.env.SKIP_DB_SEED = "1";
    dbModule = await import("../server/db");
  });

  beforeEach(() => {
    captured.residentRow = { id: 50, companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "0912345678", note: null };
    captured.existingBookingRows = [];
    captured.slotUsageRows = [{ used: 0 }];
    captured.slotLookupRows = [captured.slotRow];
    captured.insertedBookingPayload = null;
    captured.currentWhere = undefined;
    captured.lastTransactionWhere = [];
    captured.bookingSlotSelectCount = 0;
  });

  it("rejects a resident that does not belong to the current project", async () => {
    captured.residentRow = { id: 50, companyId: 10, projectId: 99, unitNumber: "B1-01", phoneNumber: "0912345678", note: null };

    await expect(
      dbModule.createBookingRecord({
        companySlug: "eagle",
        projectSlug: "a1",
        type: "initial",
        residentId: 50,
        slotId: 40,
        gmail: "owner@example.com",
        hasInspectionCompany: true,
      })
    ).rejects.toThrow("此住戶不屬於目前建案，不能使用這個預約連結");
  });

  it("rejects a slot that does not belong to the current link or site", async () => {
    captured.slotLookupRows = [];

    await expect(
      dbModule.createBookingRecord({
        companySlug: "eagle",
        projectSlug: "a1",
        type: "initial",
        residentId: 50,
        slotId: 999,
        gmail: "owner@example.com",
        hasInspectionCompany: true,
      })
    ).rejects.toThrow("選擇的時段不存在或已停用");
  });

  it("writes booking rows with the resolved resident, link and slot ids", async () => {
    const bookingId = await dbModule.createBookingRecord({
      companySlug: "eagle",
      projectSlug: "a1",
      type: "initial",
      residentId: 50,
      slotId: 40,
      gmail: "owner@example.com",
      hasInspectionCompany: true,
    });

    expect(bookingId).toBe(999);
    expect(captured.insertedBookingPayload).toMatchObject({
      companyId: 10,
      projectId: 20,
      linkId: 30,
      residentId: 50,
      slotId: 40,
      bookingType: "initial",
      unitNumberSnapshot: "A1-01",
      phoneNumberSnapshot: "0912345678",
      gmail: "owner@example.com",
      hasInspectionCompany: true,
      status: "booked",
    });
  });

  it("writes admin-assisted bookings with the selected link and internal note", async () => {
    captured.bookingSlotSelectCount = 1;

    const bookingId = await dbModule.createAdminBookingRecord({
      linkId: 30,
      residentId: 50,
      slotId: 40,
      gmail: "owner@example.com",
      hasInspectionCompany: false,
      note: "後台協助客戶完成預約",
    });

    expect(bookingId).toBe(999);
    expect(captured.insertedBookingPayload).toMatchObject({
      companyId: 10,
      projectId: 20,
      linkId: 30,
      residentId: 50,
      slotId: 40,
      bookingType: "initial",
      gmail: "owner@example.com",
      hasInspectionCompany: false,
      internalNote: "後台協助客戶完成預約",
      status: "booked",
    });
  });
});
