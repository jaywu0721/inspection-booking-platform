import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminCredentials, residents } from "../drizzle/schema";

const { captured, fakeDb } = vi.hoisted(() => {
  const captured = {
    residentSelectResults: [] as Array<Array<Record<string, unknown>>>,
    insertedResident: null as Record<string, unknown> | null,
    updatedResident: null as Record<string, unknown> | null,
  };

  const fakeDb = {
    select() {
      let table: unknown;
      const chain = {
        from(nextTable: unknown) {
          table = nextTable;
          return chain;
        },
        where() {
          return chain;
        },
        limit: async () => {
          if (table === adminCredentials) return [];
          return captured.residentSelectResults.shift() ?? [];
        },
      };
      return chain;
    },
    insert(table: unknown) {
      return {
        values: async (payload: Record<string, unknown>) => {
          if (table === residents) captured.insertedResident = payload;
          return [{ insertId: 501 }];
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          if (table === residents) captured.updatedResident = values;
          return {
            where: async () => undefined,
          };
        },
      };
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
  inArray: (...args: unknown[]) => ({ type: "inArray", args }),
  like: (...args: unknown[]) => ({ type: "like", args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", text: String.raw(strings, ...values.map(() => "?")), values }),
}));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => fakeDb }));

describe("upsertResidentRecord contact rules", () => {
  let dbModule: typeof import("../server/db");

  beforeAll(async () => {
    process.env.DATABASE_URL = "mock://db";
    process.env.VITEST = "1";
    process.env.SKIP_DB_SEED = "1";
    dbModule = await import("../server/db");
  });

  beforeEach(() => {
    captured.residentSelectResults = [];
    captured.insertedResident = null;
    captured.updatedResident = null;
  });

  it("blocks a contact with neither a phone number nor a name", async () => {
    await expect(
      dbModule.upsertResidentRecord({ companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: " ", name: " " })
    ).rejects.toThrow("手機號碼與姓名至少需填寫一項");
  });

  it("creates a name-only contact record for an existing unit", async () => {
    captured.residentSelectResults = [[]];

    await expect(
      dbModule.upsertResidentRecord({ companyId: 10, projectId: 20, unitNumber: " A1-01 ", phoneNumber: "", name: "王小美" })
    ).resolves.toBe(501);

    expect(captured.insertedResident).toEqual({
      companyId: 10,
      projectId: 20,
      unitNumber: "A1-01",
      phoneNumber: "",
      name: "王小美",
      note: null,
    });
  });

  it("updates only the phone and name of an existing contact record", async () => {
    captured.residentSelectResults = [
      [{ id: 101, companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "0912000001", name: "王小明" }],
      [],
    ];

    await expect(
      dbModule.upsertResidentRecord({ id: 101, companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "0912999999", name: "王小華" })
    ).resolves.toBe(101);
    expect(captured.updatedResident).toEqual({ phoneNumber: "0912999999", name: "王小華" });
  });

  it("rejects attempts to move an existing contact to another unit", async () => {
    captured.residentSelectResults = [
      [{ id: 101, companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "0912000001", name: "王小明" }],
    ];

    await expect(
      dbModule.upsertResidentRecord({ id: 101, companyId: 10, projectId: 20, unitNumber: "A1-02", phoneNumber: "0912000001", name: "王小明" })
    ).rejects.toThrow("個別住戶資料只能修改手機號碼與姓名");
  });
});
