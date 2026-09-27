import { z } from 'zod';
import type { TeamManagerKind } from './team-manager-rules';

// Stored kinds are what records, rosters, drafts and immutable history may
// contain: the legacy values old clients still send plus the approved `npc`.
// They parse verbatim, because source keys serialize the stored payload. Only
// the live adapters below produce the approved `pc | npc` view.
export const CHARACTER_RECORD_KINDS = ['pc', 'officer_npc', 'npc'] as const;
export const ROSTER_KINDS = ['pc', 'officer_npc', 'other_npc', 'npc'] as const;
export type CharacterRecordKind = (typeof CHARACTER_RECORD_KINDS)[number];
export type RosterKind = (typeof ROSTER_KINDS)[number];
export const characterRecordKindSchema = z.enum(CHARACTER_RECORD_KINDS);
export const rosterKindSchema = z.enum(ROSTER_KINDS);

export type CharacterKind = 'pc' | 'npc';

// A missing record kind keeps the existing PC default; held roles never decide.
export function normalizeCharacterKind(
  kind: RosterKind | undefined,
): CharacterKind {
  return kind === undefined || kind === 'pc' ? 'pc' : 'npc';
}

// The current record wins over a mismatched mirror. Membership, order, Hit
// Dice, officers and teams are untouched; a person without a record keeps only
// its own normalized mirror, so nothing is invented.
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

// Until role-aware manager limits replace the legacy distinction (#196), `npc`
// keeps the limit of the officer NPC record kind it replaces.
export function toCurrentRulesManagerKind(kind: RosterKind): TeamManagerKind {
  return kind === 'npc' ? 'officer_npc' : kind;
}

// Legacy editors still write only their legacy kinds, but a stored `npc`
// stays offered and selected so it round-trips unchanged.
export function listEditableKinds<Kind extends RosterKind>(
  writtenKinds: readonly Kind[],
  current: RosterKind | undefined,
): (Kind | 'npc')[] {
  return current === 'npc' ? [...writtenKinds, 'npc'] : [...writtenKinds];
}

const kindLabels: Record<RosterKind, string> = {
  pc: 'PC',
  officer_npc: 'Officer NPC',
  other_npc: 'Other NPC',
  npc: 'NPC',
};
export function formatCharacterKind(kind: RosterKind | undefined) {
  return kindLabels[kind ?? 'pc'];
}
