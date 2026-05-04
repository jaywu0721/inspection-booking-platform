import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminCredentials, bookingLinks, bookingReschedules, bookings, bookingSlots, companies, projects } from "../drizzle/schema";

const { captured, fakeDb } = vi.hoisted(() => {
  const captured = {
    searchWhere: undefined as unknown,
    bookingRows: [{ id: 101 }, { id: 102 }] as Array<{ id: number }>,
    searchResult: [
      {
        id: 1,
        companyId: 10,
        projectId: 20,
        linkId: 77,
        slotId: 88,
        companyName: "測試公司",
        projectName: "測試建案",
        bookingType: "initial" as const,
        unitNumberSnapshot: "A-01",
        phoneNumberSnapshot: "0912345678",
        gmail: "demo@gmail.com",
        hasInspectionCompany: true,
        status: "booked" as const,
        internalNote: null,
        createdAtMs: 1,
        updatedAtMs: 1,
        slotDate: new Date("2026-05-31T16:00:00.000Z"),
        startLabel: "09:00",
        endLabel: "10:30",
      },
      {
        id: 2,
        companyId: 10,
        projectId: 20,
        linkId: 77,
        slotId: 89,
        companyName: "測試公司",
        projectName: "測試建案",
        bookingType: "initial" as const,
        unitNumberSnapshot: "A-02",
        phoneNumberSnapshot: "0922333444",
        gmail: "other@gmail.com",
        hasInspectionCompany: false,
        status: "booked" as const,
        internalNote: null,
        createdAtMs: 2,
        updatedAtMs: 2,
        slotDate: new Date("2026-06-01T16:00:00.000Z"),
        startLabel: "10:30",
        endLabel: "12:00",
      },
    ],
    deletes: [] as Array<{ table: unknown; condition: unknown }>,
  };

  const makeSelectChain = (selection?: unknown) => {
    let fromTable: unknown;
    const isSingleIdSelection = Boolean(
      selection && typeof selection === "object" && Object.keys(selection as Record<string, unknown>).length === 1 && "id" in (selection as Record<string, unknown>)
    );

    const chain = {
      from(table: unknown) {
        fromTable = table;
        return chain;
      },
      where(condition: unknown) {
        if (isSingleIdSelection && fromTable === bookings) {
          return Promise.resolve(captured.bookingRows);
        }
        if (fromTable === bookings) {
          captured.searchWhere = condition;
        }
        return chain;
      },
      innerJoin() {
        return chain;
      },
      orderBy() {
        return Promise.resolve(captured.searchResult);
      },
      limit() {
        if (fromTable === adminCredentials) {
          return Promise.resolve([]);
        }
        return Promise.resolve(captured.bookingRows);
      },
    };
    return chain;
  };

  const fakeDb = {
    select(selection?: unknown) {
      return makeSelectChain(selection);
    },
    insert() {
      return {
        values: async () => [{ insertId: 1 }],
      };
    },
    delete(table: unknown) {
      return {
        where: async (condition: unknown) => {
          captured.deletes.push({ table, condition });
          return [];
        },
      };
    },
    transaction: async (callback: (tx: { select: typeof fakeDb.select; delete: typeof fakeDb.delete }) => Promise<unknown>) => {
      return callback({
        select: fakeDb.select,
        delete: fakeDb.delete,
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

describe("booking link cascade and filter rules", () => {
  let dbModule: typeof import("../server/db");

  beforeAll(async () => {
    process.env.DATABASE_URL = "mock://db";
    process.env.VITEST = "1";
    process.env.SKIP_DB_SEED = "1";
    dbModule = await import("../server/db");
  });

  beforeEach(() => {
    captured.searchWhere = undefined;
    captured.bookingRows = [{ id: 101 }, { id: 102 }];
    captured.deletes = [];
  });

  it("passes linkId into booking search conditions", async () => {

    const result = await dbModule.searchBookings({
      projectId: 20,
      linkId: 77,
      unitNumber: "A-01",
      bookingType: "initial",
      status: "booked",
      bookingDate: "2026-06-01",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
    expect(captured.searchWhere).toMatchObject({ type: "and" });

    const conditions = (captured.searchWhere as { type: string; conditions: Array<any> }).conditions;
    expect(conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "eq", left: bookings.projectId, right: 20 }),
        expect.objectContaining({ type: "eq", left: bookings.linkId, right: 77 }),
        expect.objectContaining({ type: "like", left: bookings.unitNumberSnapshot, right: "%A-01%" }),
        expect.objectContaining({ type: "eq", left: bookings.bookingType, right: "initial" }),
        expect.objectContaining({ type: "eq", left: bookings.status, right: "booked" }),
      ])
    );
  });

  it("deletes reschedules, bookings, slots and the link in order when a booking link is removed", async () => {
    await dbModule.deleteBookingLinkRecord(77);

    expect(captured.deletes).toHaveLength(4);
    expect(captured.deletes[0]).toMatchObject({ table: bookingReschedules, condition: { type: "inArray", left: bookingReschedules.bookingId, right: [101, 102] } });
    expect(captured.deletes[1]).toMatchObject({ table: bookings, condition: { type: "inArray", left: bookings.id, right: [101, 102] } });
    expect(captured.deletes[2]).toMatchObject({ table: bookingSlots, condition: { type: "eq", left: bookingSlots.linkId, right: 77 } });
    expect(captured.deletes[3]).toMatchObject({ table: bookingLinks, condition: { type: "eq", left: bookingLinks.id, right: 77 } });
  });
});
