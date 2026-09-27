// Ruleset Versions are allocated in order, one per change to Weekly
// Resolution; a record keeps the version it was confirmed under. Constants
// only, so frozen history can read a record's rules without the resolver.

/** Treasury transfers name no character or officer (#158). */
export const CHARACTERLESS_TRANSFERS_RULESET_VERSION = 6;
/** A Roll Twice on an Activity event candidate is rerolled in its own die (#191). */
export const CANDIDATE_REROLL_RULESET_VERSION =
  CHARACTERLESS_TRANSFERS_RULESET_VERSION + 1;
/**
 * Team-manager limits follow held officer roles, and a commandant without a
 * Hit Dice override counts their level (#196).
 */
export const ROLE_AWARE_OFFICERS_RULESET_VERSION =
  CANDIDATE_REROLL_RULESET_VERSION + 1;
export const CANONICAL_WEEKLY_RULESET_VERSION =
  ROLE_AWARE_OFFICERS_RULESET_VERSION;

// Whether a blank Hit Dice override meant the character's level when a week
// was confirmed under this version; before it, a blank meant unknown.
export function isBlankHitDiceLevel(rulesetVersion: number) {
  return rulesetVersion >= ROLE_AWARE_OFFICERS_RULESET_VERSION;
}
