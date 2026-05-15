import { useCallback, useEffect } from "react";
import { triggerRescheduleAvailabilitySync } from "@/lib/adminRescheduleInteractions";

type Params = {
  resourceId: string;
  slotDate: string;
  refetch: () => Promise<unknown> | unknown;
};

export function useRescheduleAvailabilitySync({ resourceId, slotDate, refetch }: Params) {
  const syncNow = useCallback(() => {
    if (!resourceId) return;
    void refetch();
  }, [resourceId, refetch]);

  useEffect(() => {
    if (!resourceId || !slotDate) return;
    void refetch();
  }, [resourceId, slotDate, refetch]);

  const syncOnDropdownOpen = useCallback(() => {
    triggerRescheduleAvailabilitySync(syncNow);
  }, [syncNow]);

  return {
    syncNow,
    syncOnDropdownOpen,
  };
}
