import { z } from 'zod';
import type { TeamManagerKind } from './team-manager-rules';

// Character kinds exist in two representations while PC/NPC rolls out (#141).
//
// Stored kinds are what records, rosters, Weekly Drafts, operations and
// immutable history may contain: the legacy values old clients still submit
// and the approved `npc`. Their schemas accept every value verbatim and never
// transform it, because source keys serialize the exact stored payload.
//
// Live kinds are the approved `pc | npc` view. Only the normalization adapters
// below produce them; historical readers keep the recorded value.

export const CHARACTER_RECORD_KINDS = ['pc', 'officer_npc', 'npc'] as const;
export const ROSTER_KINDS = ['pc', 'officer_npc', 'other_npc', 'npc'] as const;
export type CharacterRecordKind = (typeof CHARACTER_RECORD_KINDS)[number];
export type RosterKind = (typeof ROSTER_KINDS)[number];
export const characterRecordKindSchema = z.enum(CHARACTER_RECORD_KINDS);
export const rosterKindSchema = z.enum(ROSTER_KINDS);

export type CharacterKind = 'pc' | 'npc';

// Explicit legacy NPC kinds become `npc`; a missing record kind keeps the
// existing PC default. Held roles never decide the kind.
export function normalizeCharacterKind(
  kind: RosterKind | undefined,
): CharacterKind {
  return kind === undefined || kind === 'pc' ? 'pc' : 'npc';
}

export function isNpcKind(kind: RosterKind | undefined) {
  return normalizeCharacterKind(kind) === 'npc';
}

// Live roster mirror: each person takes the normalized kind of their current
// character record, which wins over a mismatched mirror. Membership, order,
// Hit Dice (including null and zero), officers and teams are untouched. A
// person without a record is an integrity problem for the caller to diagnose;
// only its own mirror value is normalized, and nothing is invented.
export function mirrorRosterKinds<
  Roster extends { people: { characterId: string; kind: RosterKind }[] },
>(
  roster: Roster,
  records: ReadonlyArray<{ characterId: string; kind?: CharacterRecordKind }>,
): Roster {
  const recordKinds = new Map(
    records.map((record) => [record.characterId, record.kind]),
  );
  return {
    ...roster,
    people: roster.people.map((person) => ({
      ...person,
      kind: normalizeCharacterKind(
        recordKinds.has(person.characterId)
          ? recordKinds.get(person.characterId)
          : person.kind,
      ),
    })),
  };
}

// Current rules still distinguish the legacy kinds. Until role-aware manager
// limits replace them (#196), the record-owned `npc` keeps the limit of the
// record kind it replaces, so no stored value changes an outcome.
export function currentRulesManagerKind(kind: RosterKind): TeamManagerKind {
  return kind === 'npc' ? 'officer_npc' : kind;
}

const kindLabels: Record<RosterKind, string> = {
  pc: 'PC',
  officer_npc: 'Officer NPC',
  other_npc: 'Other NPC',
  npc: 'NPC',
};
export function characterKindLabel(kind: RosterKind | undefined) {
  return kindLabels[kind ?? 'pc'];
}
