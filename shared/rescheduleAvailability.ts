export function calculateRemainingCapacity(capacity: number, used: number) {
  return Math.max(capacity - used, 0);
}

export function hasRescheduleCapacity(capacity: number, used: number) {
  return used < capacity;
}

export function canSelectRescheduleSlot(remaining: number) {
  return remaining > 0;
}

export function buildRescheduleAvailability<T extends { id: number; capacity: number }>(
  slots: T[],
  usageBySlotId: Map<number, number>,
  currentSlotId: number
) {
  return slots.map(slot => ({
    ...slot,
    remaining: calculateRemainingCapacity(slot.capacity, usageBySlotId.get(slot.id) ?? 0),
    isCurrentSlot: slot.id === currentSlotId,
  }));
}
