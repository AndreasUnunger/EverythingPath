'use client';
import { EventNote } from './event-note';

// A check-level Overseer selection an older editor recorded. Support helps
// every check of the occurrence once, wherever it is recorded; this keeps
// the selection visible and removable until the shared toggle owns it.
export function LegacyOverseerNote({
  checkLabel,
  disabled,
  onClear,
}: {
  checkLabel: string;
  disabled: boolean;
  onClear: () => void;
}) {
  return (
    <EventNote
      action="Remove Overseer support"
      actionLabel={`Remove Overseer support from ${checkLabel}`}
      disabled={disabled}
      onAction={onClear}
    >
      Overseer support is recorded on this check. It helps every check of this
      event once.
    </EventNote>
  );
}
