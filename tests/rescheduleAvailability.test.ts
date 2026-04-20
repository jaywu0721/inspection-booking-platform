import { describe, expect, it } from "vitest";
import {
  buildRescheduleAvailability,
  calculateRemainingCapacity,
  canSelectRescheduleSlot,
  hasRescheduleCapacity,
} from "../shared/rescheduleAvailability";

describe("reschedule availability rules", () => {
  it("calculates remaining capacity without going below zero", () => {
    expect(calculateRemainingCapacity(3, 1)).toBe(2);
    expect(calculateRemainingCapacity(3, 3)).toBe(0);
    expect(calculateRemainingCapacity(3, 5)).toBe(0);
  });

  it("builds availability rows with live remaining values and current slot marker", () => {
    const rows = buildRescheduleAvailability(
      [
        { id: 11, capacity: 3, startLabel: "10:30", endLabel: "12:00" },
        { id: 12, capacity: 2, startLabel: "14:00", endLabel: "15:30" },
      ],
      new Map([
        [11, 2],
        [12, 2],
      ]),
      11
    );

    expect(rows).toEqual([
      {
        id: 11,
        capacity: 3,
        startLabel: "10:30",
        endLabel: "12:00",
        remaining: 1,
        isCurrentSlot: true,
      },
      {
        id: 12,
        capacity: 2,
        startLabel: "14:00",
        endLabel: "15:30",
        remaining: 0,
        isCurrentSlot: false,
      },
    ]);
  });

  it("treats full slots as unavailable for both dropdown selection and final reschedule validation", () => {
    expect(canSelectRescheduleSlot(1)).toBe(true);
    expect(canSelectRescheduleSlot(0)).toBe(false);
    expect(hasRescheduleCapacity(3, 2)).toBe(true);
    expect(hasRescheduleCapacity(3, 3)).toBe(false);
  });
});
