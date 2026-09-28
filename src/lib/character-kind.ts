import { z } from 'zod';

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

// The only kinds current forms offer and live writes store.
export const CHARACTER_KINDS = ['pc', 'npc'] as const;
export type CharacterKind = (typeof CHARACTER_KINDS)[number];
export const characterKindSchema = z.enum(CHARACTER_KINDS);

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

// Live views name every stored kind PC or NPC. Recorded history keeps its own
// wording for the legacy labels.
const kindLabels: Record<CharacterKind, string> = { pc: 'PC', npc: 'NPC' };
export function formatCharacterKind(kind: RosterKind | undefined) {
  return kindLabels[normalizeCharacterKind(kind)];
}
