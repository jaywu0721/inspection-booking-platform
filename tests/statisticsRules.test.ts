import { describe, expect, it } from "vitest";
import { isStatisticsLinkOpen, prepareStatisticOptionNames } from "../server/db";

describe("statistics core rules", () => {
  it("requires at least two non-empty, normalized-distinct options when creating a statistics link", () => {
    expect(() => prepareStatisticOptionNames(["出席"])).toThrow("至少需要兩個啟用選項");
    expect(() => prepareStatisticOptionNames(["出席", " 出席 "])).toThrow("不可有重複選項名稱");
    expect(prepareStatisticOptionNames([" 出席 ", "委託"])) .toEqual([
      { name: "出席", nameKey: "出席" },
      { name: "委託", nameKey: "委託" },
    ]);
  });

  it("allows resident writes only when the link is enabled and inside its time window", () => {
    const startsAt = new Date("2026-10-10T01:00:00.000Z");
    const endsAt = new Date("2026-10-10T05:00:00.000Z");
    expect(isStatisticsLinkOpen({ isEnabled: true, startsAt, endsAt }, new Date("2026-10-10T03:00:00.000Z"))).toBe(true);
    expect(isStatisticsLinkOpen({ isEnabled: false, startsAt, endsAt }, new Date("2026-10-10T03:00:00.000Z"))).toBe(false);
    expect(isStatisticsLinkOpen({ isEnabled: true, startsAt, endsAt }, new Date("2026-10-10T00:59:59.000Z"))).toBe(false);
    expect(isStatisticsLinkOpen({ isEnabled: true, startsAt, endsAt }, new Date("2026-10-10T05:00:01.000Z"))).toBe(false);
  });
});
