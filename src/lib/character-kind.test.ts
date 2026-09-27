import { expect, test } from 'vitest';
import {
  characterKindLabel,
  characterRecordKindSchema,
  currentRulesManagerKind,
  isNpcKind,
  mirrorRosterKinds,
  normalizeCharacterKind,
  rosterKindSchema,
} from './character-kind';
import { canonicalRosterSchema } from './canonical-roster';
import {
  mixedKindRecords,
  mixedKindSnapshot,
} from '../../tests/rules/character-kind-fixture';

test('stored kind schemas accept legacy and approved values verbatim and reject impossible values', () => {
  for (const kind of ['pc', 'officer_npc', 'npc'])
    expect(characterRecordKindSchema.parse(kind)).toBe(kind);
  for (const kind of ['pc', 'officer_npc', 'other_npc', 'npc'])
    expect(rosterKindSchema.parse(kind)).toBe(kind);
  // other_npc was only ever a roster/freeform kind, never a record kind.
  expect(characterRecordKindSchema.safeParse('other_npc').success).toBe(false);
  for (const kind of ['NPC', 'officer', '', null])
    expect(rosterKindSchema.safeParse(kind).success).toBe(false);
});

test('live normalization maps both legacy NPC labels to npc and an absent kind to the PC default', () => {
  expect(normalizeCharacterKind(undefined)).toBe('pc');
  expect(normalizeCharacterKind('pc')).toBe('pc');
  expect(normalizeCharacterKind('officer_npc')).toBe('npc');
  expect(normalizeCharacterKind('other_npc')).toBe('npc');
  expect(normalizeCharacterKind('npc')).toBe('npc');
  expect(
    (['pc', 'officer_npc', 'other_npc', 'npc', undefined] as const).map(
      isNpcKind,
    ),
  ).toEqual([false, true, true, true, false]);
});

test('the live roster mirror follows current records without touching membership, Hit Dice or assignments', () => {
  const roster = canonicalRosterSchema.parse(mixedKindSnapshot().roster);
  const before = structuredClone(roster);
  const mirrored = mirrorRosterKinds(roster, mixedKindRecords);
  expect(roster).toEqual(before);
  expect(mirrored.people).toEqual([
    { characterId: 'aubrin', kind: 'pc', hitDice: null },
    { characterId: 'mara', kind: 'pc', hitDice: 0 },
    { characterId: 'ostler', kind: 'npc', hitDice: 5 },
    // The record is authoritative: an absent record kind is PC, even though
    // the old mirror said other_npc and Rook still manages teams.
    { characterId: 'rook', kind: 'pc', hitDice: null },
    { characterId: 'vessa', kind: 'npc', hitDice: 3 },
  ]);
  expect(mirrored.officers).toBe(roster.officers);
  expect(mirrored.teams).toBe(roster.teams);
  expect(canonicalRosterSchema.parse(mirrored)).toEqual(mirrored);
  // Repeating the adapter is a no-op.
  expect(mirrorRosterKinds(mirrored, mixedKindRecords)).toEqual(mirrored);
});

test('the live roster mirror never infers kind from roles or invents a missing record', () => {
  const roster = {
    people: [
      { characterId: 'lost', kind: 'other_npc' as const, hitDice: 0 },
      { characterId: 'officer', kind: 'pc' as const, hitDice: null },
    ],
    officers: [{ role: 'commandant' as const, characterId: 'officer' }],
    teams: [],
  };
  expect(
    mirrorRosterKinds(roster, [{ characterId: 'officer' }]).people,
  ).toEqual([
    { characterId: 'lost', kind: 'npc', hitDice: 0 },
    { characterId: 'officer', kind: 'pc', hitDice: null },
  ]);
});

test('current rules give the new npc kind the officer-NPC manager limit until role-aware limits ship', () => {
  expect(currentRulesManagerKind('pc')).toBe('pc');
  expect(currentRulesManagerKind('officer_npc')).toBe('officer_npc');
  expect(currentRulesManagerKind('other_npc')).toBe('other_npc');
  expect(currentRulesManagerKind('npc')).toBe('officer_npc');
});

test('every stored kind has a readable label', () => {
  expect(
    (['pc', 'officer_npc', 'other_npc', 'npc', undefined] as const).map(
      characterKindLabel,
    ),
  ).toEqual(['PC', 'Officer NPC', 'Other NPC', 'NPC', 'PC']);
});
