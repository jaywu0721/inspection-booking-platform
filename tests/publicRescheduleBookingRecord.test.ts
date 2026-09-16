import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingLinks, bookingReschedules, bookings, bookingSlots, residents } from "../drizzle/schema";

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
    isExpired: false,
    availableSlots: [],
  };

  const residentRow = { id: 50, companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "0912345678", note: null };
  const bookingRow = {
    id: 900,
    companyId: 10,
    projectId: 20,
    linkId: 30,
    residentId: 50,
    slotId: 40,
    bookingType: "initial" as const,
    status: "booked" as const,
    internalNote: null,
    unitNumberSnapshot: "A1-01",
    phoneNumberSnapshot: "0912345678",
    gmail: "owner@example.com",
    hasInspectionCompany: false,
    createdAtMs: 1,
    updatedAtMs: 1,
  };
  const currentSlotRow = {
    id: 40,
    companyId: 10,
    projectId: 20,
    linkId: 30,
    slotDate: new Date("2026-06-01T00:00:00.000Z"),
    startLabel: "09:00",
    endLabel: "10:30",
    capacity: 2,
    isActive: true,
    isPrivate: false,
  };
  const newSlotRow = {
    id: 41,
    companyId: 10,
    projectId: 20,
    linkId: 30,
    slotDate: new Date("2099-06-02T00:00:00.000Z"),
    startLabel: "10:30",
    endLabel: "12:00",
    capacity: 2,
    isActive: true,
    isPrivate: false,
  };

  const captured = {
    siteRow,
    residentRow,
    bookingRow,
    slotRowById: new Map<number, typeof currentSlotRow>([
      [40, currentSlotRow],
      [41, newSlotRow],
    ]),
    slotUsageRows: [{ used: 0 }],
    insertedPrivateSlotPayload: null as null | Record<string, unknown>,
    insertedReschedulePayload: null as null | Record<string, unknown>,
    updatedBookingPayload: null as null | Record<string, unknown>,
    updatedBookingWhere: null as unknown,
  };

  const makeSelectChain = (selection?: unknown) => {
    let mode: "active-link" | "resident" | "booking" | "slot" | "slot-capacity" | "slot-usage-map" | null = null;

    const hasKeys = (keys: string[]) => Boolean(selection && typeof selection === "object" && keys.every(key => key in (selection as Record<string, unknown>)));

    if (hasKeys(["company", "project", "link"])) mode = "active-link";
    else if (hasKeys(["slotId", "used"])) mode = "slot-usage-map";
    else if (hasKeys(["used"])) mode = "slot-capacity";

    const chain = {
      from(table?: unknown) {
        if (table === residents) mode = "resident";
        if (table === bookings) {
          mode = mode === "slot-capacity" || mode === "slot-usage-map" ? mode : "booking";
        }
        if (table === bookingSlots) mode = "slot";
        return chain;
      },
      innerJoin() {
        return chain;
      },
      where() {
        return chain;
      },
      orderBy() {
        if (mode === "slot") {
          return Promise.resolve(Array.from(captured.slotRowById.values()));
        }
        return chain;
      },
      groupBy() {
        if (mode === "slot-usage-map") {
          return Promise.resolve(captured.slotUsageRows);
        }
        return Promise.resolve([]);
      },
      limit() {
        if (mode === "active-link") return Promise.resolve([captured.siteRow]);
        if (mode === "resident") return Promise.resolve([captured.residentRow]);
        if (mode === "booking") return Promise.resolve([captured.bookingRow]);
        if (mode === "slot") {
          return Promise.resolve(Array.from(captured.slotRowById.values()).slice(-1));
        }
        if (mode === "slot-capacity") return Promise.resolve(captured.slotUsageRows);
        return Promise.resolve([]);
      },
      then(resolve: (value: unknown) => unknown) {
        if (mode === "slot-capacity") {
          return Promise.resolve(captured.slotUsageRows).then(resolve);
        }
        if (mode === "slot-usage-map") {
          return Promise.resolve(captured.slotUsageRows).then(resolve);
        }
        return Promise.resolve([]).then(resolve);
      },
    };

    const originalWhere = chain.where;
    chain.where = (condition: unknown) => {
      const findRightValue = (node: unknown, fieldName: string): number | undefined => {
        if (!node || typeof node !== "object") return undefined;
        const candidate = node as { type?: string; left?: { name?: string }; right?: unknown; conditions?: unknown[] };
        if (candidate.type === "eq" && candidate.left?.name === fieldName && typeof candidate.right === "number") {
          return candidate.right;
        }
        if (Array.isArray(candidate.conditions)) {
          for (const item of candidate.conditions) {
            const found = findRightValue(item, fieldName);
            if (typeof found === "number") return found;
          }
        }
        return undefined;
      };

      if (mode === "slot") {
        const slotId = findRightValue(condition, "id");
        if (typeof slotId === "number") {
          const slotRow = captured.slotRowById.get(slotId);
          return {
            limit: async () => (slotRow ? [slotRow] : []),
          };
        }
        return chain;
      }

      if (mode === "booking") {
        const bookingId = findRightValue(condition, "id");
        return {
          limit: async () => (bookingId === captured.bookingRow.id ? [captured.bookingRow] : []),
        };
      }

      if (mode === "resident") {
        const residentId = findRightValue(condition, "id");
        return {
          limit: async () => (residentId === captured.residentRow.id ? [captured.residentRow] : []),
        };
      }

      if (mode === "slot-capacity") {
        return Promise.resolve(captured.slotUsageRows);
      }

      if (mode === "slot-usage-map") {
        return chain;
      }

      return originalWhere(condition);
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
          if (table === bookingSlots) {
            captured.insertedPrivateSlotPayload = payload;
          }
          if (table === bookingReschedules) {
            captured.insertedReschedulePayload = payload;
          }
          return [{ insertId: 901 }];
        },
      };
    },
    update(table: unknown) {
      return {
        set(payload: Record<string, unknown>) {
          if (table === bookings) {
            captured.updatedBookingPayload = payload;
          }
          return {
            where: async (condition: unknown) => {
              captured.updatedBookingWhere = condition;
              return [{ affectedRows: 1 }];
            },
          };
        },
      };
    },
    transaction: async (callback: (tx: { select: typeof fakeDb.select; insert: typeof fakeDb.insert; update: typeof fakeDb.update }) => Promise<unknown>) => {
      return callback({
        select: fakeDb.select,
        insert: fakeDb.insert,
        update: fakeDb.update,
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
  inArray: (left: unknown, right: unknown[]) => ({ type: "inArray", left, right }),
  like: (left: unknown, right: unknown) => ({ type: "like", left, right }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", text: String.raw(strings, ...values.map(() => "?")), values }),
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => fakeDb,
}));

describe("publicRescheduleBookingRecord", () => {
  let dbModule: typeof import("../server/db");

  beforeAll(async () => {
    process.env.DATABASE_URL = "mock://db";
    process.env.VITEST = "1";
    process.env.SKIP_DB_SEED = "1";
    dbModule = await import("../server/db");
  });

  beforeEach(() => {
    captured.residentRow = { id: 50, companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "0912345678", note: null };
    captured.bookingRow = {
      id: 900,
      companyId: 10,
      projectId: 20,
      linkId: 30,
      residentId: 50,
      slotId: 40,
      bookingType: "initial",
      status: "booked",
      internalNote: null,
      unitNumberSnapshot: "A1-01",
      phoneNumberSnapshot: "0912345678",
      gmail: "owner@example.com",
      hasInspectionCompany: false,
      createdAtMs: 1,
      updatedAtMs: 1,
    };
    captured.slotUsageRows = [{ used: 0 }];
    captured.insertedPrivateSlotPayload = null;
    captured.insertedReschedulePayload = null;
    captured.updatedBookingPayload = null;
    captured.updatedBookingWhere = null;
  });

  it("rejects a booking that does not belong to the verified resident", async () => {
    captured.bookingRow = {
      ...captured.bookingRow,
      residentId: 999,
    };

    await expect(
      dbModule.publicRescheduleBookingRecord({
        companySlug: "eagle",
        projectSlug: "a1",
        type: "initial",
        residentId: 50,
        bookingId: 900,
        currentSlotId: 40,
        newSlotId: 41,
      })
    ).rejects.toThrow("找不到對應預約資料");
  });

  it("blocks choosing the same slot as the current booking", async () => {
    await expect(
      dbModule.publicRescheduleBookingRecord({
        companySlug: "eagle",
        projectSlug: "a1",
        type: "initial",
        residentId: 50,
        bookingId: 900,
        currentSlotId: 40,
        newSlotId: 40,
      })
    ).rejects.toThrow("您目前已預約此時段");
  });

  it("shows a stale-data message when the booking was already changed before submit", async () => {
    captured.bookingRow = {
      ...captured.bookingRow,
      slotId: 41,
    };

    await expect(
      dbModule.publicRescheduleBookingRecord({
        companySlug: "eagle",
        projectSlug: "a1",
        type: "initial",
        residentId: 50,
        bookingId: 900,
        currentSlotId: 40,
        newSlotId: 41,
      })
    ).rejects.toThrow("預約資料已更新，請重新整理後再試");
  });

  it("shows the public full-capacity message when the target slot is gone", async () => {
    captured.slotUsageRows = [{ used: 2 }];

    await expect(
      dbModule.publicRescheduleBookingRecord({
        companySlug: "eagle",
        projectSlug: "a1",
        type: "initial",
        residentId: 50,
        bookingId: 900,
        currentSlotId: 40,
        newSlotId: 41,
      })
    ).rejects.toThrow("該時段已無剩餘名額");
  });

  it("writes a customer reschedule history row, updates the booking slot, and keeps the original inspection-company flag when not provided", async () => {
    const bookingId = await dbModule.publicRescheduleBookingRecord({
      companySlug: "eagle",
      projectSlug: "a1",
      type: "initial",
      residentId: 50,
      bookingId: 900,
      currentSlotId: 40,
      newSlotId: 41,
    });

    expect(bookingId).toBe(900);
    expect(captured.insertedReschedulePayload).toMatchObject({
      bookingId: 900,
      oldSlotId: 40,
      newSlotId: 41,
      changedBy: "customer",
    });
    expect(captured.updatedBookingPayload).toMatchObject({
      slotId: 41,
      status: "rescheduled",
      hasInspectionCompany: false,
    });
  });

  it("overrides hasInspectionCompany when the customer changes that option during reschedule", async () => {
    await dbModule.publicRescheduleBookingRecord({
      companySlug: "eagle",
      projectSlug: "a1",
      type: "initial",
      residentId: 50,
      bookingId: 900,
      currentSlotId: 40,
      newSlotId: 41,
      hasInspectionCompany: true,
    });

    expect(captured.updatedBookingPayload).toMatchObject({
      slotId: 41,
      status: "rescheduled",
      hasInspectionCompany: true,
    });
  });

  it("uses the admin stale message when the backend receives an outdated currentSlotId", async () => {
    captured.bookingRow = {
      ...captured.bookingRow,
      slotId: 41,
    };

    await expect(
      dbModule.rescheduleBookingRecord({
        bookingId: 900,
        expectedCurrentSlotId: 40,
        newSlotId: 40,
        changedBy: "admin-user",
        staleMessage: "預約資料已更新，請重新整理後再試",
      })
    ).rejects.toThrow("預約資料已更新，請重新整理後再試");
  });

  it("rejects customer reschedule to a slot on today or in the past", async () => {
    // Set the new slot date to today (Asia/Taipei)
    const now = new Date();
    const todayInTaipei = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    const todayUtcNoon = new Date(Date.UTC(todayInTaipei.getFullYear(), todayInTaipei.getMonth(), todayInTaipei.getDate(), 12, 0, 0));
    const newSlot = captured.slotRowById.get(41)!;
    captured.slotRowById.set(41, { ...newSlot, slotDate: todayUtcNoon });

    await expect(
      dbModule.publicRescheduleBookingRecord({
        companySlug: "eagle",
        projectSlug: "a1",
        type: "initial",
        residentId: 50,
        bookingId: 900,
        currentSlotId: 40,
        newSlotId: 41,
      })
    ).rejects.toThrow("無法改期至當日或已過期的時段");
  });

  it("allows admin reschedule to a slot on today (admin is not restricted)", async () => {
    const now = new Date();
    const todayInTaipei = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    const todayUtcNoon = new Date(Date.UTC(todayInTaipei.getFullYear(), todayInTaipei.getMonth(), todayInTaipei.getDate(), 12, 0, 0));
    const newSlot = captured.slotRowById.get(41)!;
    captured.slotRowById.set(41, { ...newSlot, slotDate: todayUtcNoon });

    const bookingId = await dbModule.rescheduleBookingRecord({
      bookingId: 900,
      newSlotId: 41,
      changedBy: "admin-user",
    });

    expect(bookingId).toBe(900);
    expect(captured.updatedBookingPayload).toMatchObject({
      slotId: 41,
      status: "rescheduled",
    });
  });

  it("creates a private one-off slot when an admin reschedules with a custom date and time range", async () => {
    const bookingId = await dbModule.rescheduleBookingRecord({
      bookingId: 900,
      expectedCurrentSlotId: 40,
      customSlot: {
        slotDate: "2099-06-03",
        timeRange: "14:00-16:00",
      },
      note: "住戶另約時間",
      changedBy: "admin-user",
    });

    expect(bookingId).toBe(900);
    expect(captured.insertedPrivateSlotPayload).toMatchObject({
      companyId: 10,
      projectId: 20,
      linkId: 30,
      slotDate: new Date("2099-06-03T12:00:00.000Z"),
      startLabel: "14:00",
      endLabel: "16:00",
      capacity: 1,
      isActive: true,
      isPrivate: true,
    });
    expect(captured.insertedReschedulePayload).toMatchObject({
      bookingId: 900,
      oldSlotId: 40,
      newSlotId: 901,
      note: "住戶另約時間",
      changedBy: "admin-user",
    });
    expect(captured.updatedBookingPayload).toMatchObject({
      slotId: 901,
      status: "rescheduled",
    });
  });

  it("does not allow a private one-off slot to be reused as a normal reschedule slot", async () => {
    const privateSlot = captured.slotRowById.get(41)!;
    captured.slotRowById.set(41, { ...privateSlot, isPrivate: true });

    await expect(
      dbModule.rescheduleBookingRecord({
        bookingId: 900,
        newSlotId: 41,
        changedBy: "admin-user",
      })
    ).rejects.toThrow("新時段不存在或已停用");
  });
});
