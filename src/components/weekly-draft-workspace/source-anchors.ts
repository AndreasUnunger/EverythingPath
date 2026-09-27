// DOM ids of Activity slots and Event occurrences, so a link from another
// phase (such as a Persistent source ending) can bring one into view.
export function activitySlotAnchor(slotId: string) {
  return `activity-slot-${slotId}`;
}
export function eventOccurrenceAnchor(eventId: string) {
  return `event-occurrence-${eventId}`;
}
