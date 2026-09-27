'use client';
import { useState } from 'react';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import {
  checkModifiersEdit,
  clearRetainedEdit,
  modifierList,
  officerCheckEdit,
  removeRetainedTargetEdit,
  theftRollEdit,
  type CheckRoll,
  type Mitigation,
  type RollModifier,
} from './persistent-check-edits';
import type {
  PersistentRetainedField,
  PersistentView,
  RivalrySkill,
} from './types';
import type { PersistentEdit } from './use-persistent-choice';

type Event = PersistentView['events'][number];
type Decision = WeeklyDraft['persistent']['decisions'][number];
type Result = 'accepted' | 'failed';
// The newest decision for an event, null when it has none, or undefined
// when newer facts are not available and the rendered one stands in.
export type LatestPersistentDecision = (
  eventId: string,
) => Decision | null | undefined;
export type ModifierChange =
  | { kind: 'add'; modifier: RollModifier }
  | { kind: 'edit'; index: number; value: number; reason: string }
  | { kind: 'remove'; index: number };

// The saved Theft or Rivalry check of one carried event. Every field writes
// its own semantic edit through the shared store, built from the newest
// accepted-and-pending decision (not the one rendered before an earlier
// await), so an edit never undoes a support move or a peer's other field.
// A Rivalry character or skill chosen before the other stays local until
// the stored check can name both.
export function usePersistentCheck(
  event: Event,
  edit: PersistentEdit,
  latest?: LatestPersistentDecision,
) {
  const [pending, setPending] = useState<{
    characterId?: string;
    skill?: RivalrySkill;
  }>({});
  const current = (): Mitigation | null => {
    const found = latest?.(event.eventId);
    const decision = found === undefined ? event.decision : found;
    return decision?.kind === 'mitigate' ? decision : null;
  };
  const write = (
    build: (decision: Mitigation) => WeeklyDraftEdit | null,
  ): Promise<Result> => {
    const decision = current();
    const next = decision ? build(decision) : null;
    return next ? edit(next) : Promise.resolve('failed');
  };
  const saved = event.rivalryCheck;
  function officer(
    change: Parameters<typeof officerCheckEdit>[1],
  ): Promise<Result> {
    const decision = current();
    if (!decision) return Promise.resolve('failed');
    const next = officerCheckEdit(decision, change, pending);
    if (next) {
      setPending({});
      return edit(next);
    }
    if (change.field === 'characterId' || change.field === 'skill')
      setPending((before) => ({ ...before, [change.field]: change.value }));
    return Promise.resolve('accepted');
  }
  return {
    setTheftRoll: (roll: RawRoll | null) =>
      write((decision) => theftRollEdit(decision, roll)),
    // What the Rivalry selects show: the saved check, else the local choice.
    characterId: saved?.characterId ?? pending.characterId ?? null,
    skill: saved?.skill ?? pending.skill ?? null,
    setCharacter: (characterId: string) =>
      officer({ field: 'characterId', value: characterId }),
    setSkill: (skill: RivalrySkill) =>
      officer({ field: 'skill', value: skill }),
    setSkillBonus: (value: number | null) =>
      officer({ field: 'skillBonus', value }),
    setOfficerRoll: (roll: RawRoll | null) =>
      officer({ field: 'roll', value: roll }),
    changeModifier: (check: CheckRoll, change: ModifierChange) =>
      write((decision) => {
        const list = modifierList(decision, check, change);
        return list ? checkModifiersEdit(decision, check, list) : null;
      }),
    clearRetained: (field: PersistentRetainedField) =>
      write((decision) => clearRetainedEdit(decision, field)),
    removeRetainedTarget: (index: number) =>
      write((decision) => removeRetainedTargetEdit(decision, index)),
  };
}
export type PersistentCheck = ReturnType<typeof usePersistentCheck>;
