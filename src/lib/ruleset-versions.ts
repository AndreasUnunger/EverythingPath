// Ruleset Versions are allocated in order, one per change to Weekly
// Resolution; a record keeps the version it was confirmed under. Constants
// only, so frozen history can read a record's rules without the resolver.
//
// Version 6 made treasury transfers characterless (#158) and version 7
// rerolled a Roll Twice on an Activity event candidate in its own die (#191).
// No record from before version 8 exists, so they need no constants; the
// corpus notes keep them, and neither number is ever reused.

/**
 * Team-manager limits follow held officer roles, and a commandant without a
 * Hit Dice override counts their level (#196).
 */
export const ROLE_AWARE_OFFICERS_RULESET_VERSION = 8;
/**
 * Spread Propaganda assumes the GM allows it: no permission answer, and no
 * Rules Exception for an impossible settlement (#198).
 */
export const ASSUMED_PROPAGANDA_APPROVAL_RULESET_VERSION =
  ROLE_AWARE_OFFICERS_RULESET_VERSION + 1;
export const CANONICAL_WEEKLY_RULESET_VERSION =
  ASSUMED_PROPAGANDA_APPROVAL_RULESET_VERSION;
