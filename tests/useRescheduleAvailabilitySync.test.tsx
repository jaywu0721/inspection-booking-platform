/** @vitest-environment jsdom */

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRescheduleAvailabilitySync } from "../client/src/hooks/useRescheduleAvailabilitySync";

describe("useRescheduleAvailabilitySync", () => {
  it("refetches when bookingId and slotDate are ready, and refetches again when slotDate changes", async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ bookingId, slotDate }) => useRescheduleAvailabilitySync({ bookingId, slotDate, refetch }),
      {
        initialProps: {
          bookingId: "101",
          slotDate: "2026-05-04",
        },
      }
    );

    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    rerender({ bookingId: "101", slotDate: "2026-05-05" });

    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(2);
    });
  });

  it("does not refetch automatically when bookingId or slotDate is missing", async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useRescheduleAvailabilitySync({ bookingId: "", slotDate: "", refetch }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(0);
    });
  });

  it("refetches immediately when the dropdown-open sync callback is called", async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useRescheduleAvailabilitySync({
        bookingId: "101",
        slotDate: "2026-05-04",
        refetch,
      })
    );

    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    result.current.syncOnDropdownOpen();

    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(2);
    });
  });
});
