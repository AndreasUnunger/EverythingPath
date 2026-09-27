import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { PersistentRetainedField, RivalrySkill } from './types';

// The semantic edits behind a carried event's check fields. Each changes one
// field of the saved check decision and keeps every other recorded value,
// including Overseer support, targets and fields an older editor wrote.
// Nothing here rebuilds a decision from the visible fields alone.

type Decision = WeeklyDraft['persistent']['decisions'][number];
export type Mitigation = Extract<Decision, { kind: 'mitigate' }>;
type OfficerCheck = NonNullable<Mitigation['officerCheck']>;
export type RollModifier = RawRoll['modifiers'][number];
export type CheckRoll = 'theft' | 'rivalry';

const send = (decision: Mitigation): WeeklyDraftEdit => ({
  kind: 'persistent_decision',
  decision,
});

/** Theft's Loyalty roll; null clears it with the modifiers it records. */
export function theftRollEdit(
  decision: Mitigation,
  roll: RawRoll | null,
): WeeklyDraftEdit {
  const next = structuredClone(decision);
  const rolls = { ...next.rolls };
  if (roll) rolls.check = roll;
  else delete rolls.check;
  if (Object.keys(rolls).length) next.rolls = rolls;
  else delete next.rolls;
  return send(next);
}

type OfficerField =
  | { field: 'characterId'; value: string }
  | { field: 'skill'; value: RivalrySkill }
  | { field: 'skillBonus'; value: number | null }
  | { field: 'roll'; value: RawRoll | null };

/**
 * One Rivalry officer-check field. The stored check needs its character and
 * skill, so until both are known the edit waits (null) and `pending` holds
 * the one chosen so far; a blank skill bonus or roll is cleared, not zeroed.
 */
export function officerCheckEdit(
  decision: Mitigation,
  change: OfficerField,
  pending: { characterId?: string; skill?: RivalrySkill } = {},
): WeeklyDraftEdit | null {
  const next = structuredClone(decision);
  const current: Partial<OfficerCheck> = next.officerCheck ?? {
    ...(pending.characterId ? { characterId: pending.characterId } : {}),
    ...(pending.skill ? { skill: pending.skill } : {}),
  };
  if (change.value === null) delete current[change.field];
  else Object.assign(current, { [change.field]: change.value });
  const { characterId, skill } = current;
  if (!characterId || !skill) return null;
  next.officerCheck = { ...current, characterId, skill };
  return send(next);
}

function checkRoll(decision: Mitigation, check: CheckRoll) {
  return check === 'theft'
    ? decision.rolls?.check
    : decision.officerCheck?.roll;
}

/**
 * The modifiers recorded on a check's roll, replaced as a list. A modifier
 * belongs to its roll, so there is nothing to edit (null) before the roll.
 */
export function checkModifiersEdit(
  decision: Mitigation,
  check: CheckRoll,
  modifiers: RollModifier[],
): WeeklyDraftEdit | null {
  const roll = checkRoll(decision, check);
  if (!roll) return null;
  const next = structuredClone(decision);
  const updated = { ...structuredClone(roll), modifiers };
  if (check === 'theft') next.rolls = { ...next.rolls, check: updated };
  else next.officerCheck = { ...next.officerCheck!, roll: updated };
  return send(next);
}

export const newModifierSource = () => `custom:${crypto.randomUUID()}`;

/** One check's modifier list after adding, editing or removing an entry. */
export function modifierList(
  decision: Mitigation,
  check: CheckRoll,
  change:
    | { kind: 'add'; modifier: RollModifier }
    | { kind: 'edit'; index: number; value: number; reason: string }
    | { kind: 'remove'; index: number },
): RollModifier[] | null {
  const current = checkRoll(decision, check)?.modifiers;
  if (!current) return null;
  if (change.kind === 'add') return [...current, change.modifier];
  if (!current[change.index]) return null;
  if (change.kind === 'remove')
    return current.filter((_, index) => index !== change.index);
  // The entry keeps its source identity; only the amount and reason change.
  return current.map((entry, index) =>
    index === change.index
      ? { ...entry, value: change.value, reason: change.reason }
      : entry,
  );
}

/** Removes one recorded field this event's check does not use. */
export function clearRetainedEdit(
  decision: Mitigation,
  field: PersistentRetainedField,
): WeeklyDraftEdit {
  const next = structuredClone(decision);
  delete next[field];
  return send(next);
}

/** Removes one retained target, by its position in the recorded list. */
export function removeRetainedTargetEdit(
  decision: Mitigation,
  index: number,
): WeeklyDraftEdit {
  const next = structuredClone(decision);
  const targets = (next.targets ?? []).filter((_, other) => other !== index);
  if (targets.length) next.targets = targets;
  else delete next.targets;
  return send(next);
}
