# B notes

Event tickets referenced: #165 (context note only in #167), #166 (blocks #168). T15b/T16b/T17b were not needed.

## Deviations

- **#167 is blocked by None, not #165.** The Resolution Preview already carries the source of each ending: Activity's `end_persistent_event` and Event's `event_end` (source occurrence → ended event). High Morale's ended events are stored as occurrence `targets` and can be edited in the current Event editor. #165 only re-presents them.
- **T21b is blocked by #169, not the other way round.** Spec #145 §5 has this area build the shared pure six-section renderer and fact model, which the live view needs first. The frozen adapter targets that model, so #169 is unblocked.
- **#178** is blocked by #175, #176 and #177 (simplest). For more parallel work, move the retirement to #177 and block #177 by #178.
- #170 now owns the local-form Confirm gating (SUM-01/03 portion), per spec §5.

## Owners for Characters & officers (#183)

- Section merge/conflict helper and flow: **#175** (T27). Reference-repair and restoration utility: **#176** (T28).
- The People & officers fallback is set up by **#178** when it retires the broad editor. No #139 ticket removes it; #183 does.
