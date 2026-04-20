import { useCallback, useEffect } from "react";
import { triggerRescheduleAvailabilitySync } from "@/lib/adminRescheduleInteractions";

type Params = {
  bookingId: string;
  slotDate: string;
  refetch: () => Promise<unknown> | unknown;
};

export function useRescheduleAvailabilitySync({ bookingId, slotDate, refetch }: Params) {
  const syncNow = useCallback(() => {
    if (!bookingId) return;
    void refetch();
  }, [bookingId, refetch]);

  useEffect(() => {
    if (!bookingId || !slotDate) return;
    void refetch();
  }, [bookingId, slotDate, refetch]);

  const syncOnDropdownOpen = useCallback(() => {
    triggerRescheduleAvailabilitySync(syncNow);
  }, [syncNow]);

  return {
    syncNow,
    syncOnDropdownOpen,
  };
}
