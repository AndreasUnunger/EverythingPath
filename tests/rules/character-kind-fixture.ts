import type { z } from 'zod';
import type { CharacterRecordKind } from '../../src/lib/character-kind';
import type { militiaSnapshotSchema } from '../../src/lib/canonical-weekly-source';

type Snapshot = z.input<typeof militiaSnapshotSchema>;

// Mixed-format character kinds as they can coexist during the PC/NPC rollout:
// an absent record kind (PC default), explicit PC, both legacy NPC labels, the
// approved `npc`, and one mismatched mirror (the record is PC, the roster says
// other_npc). Hit Dice cover unknown (null), explicit zero and positive values.
export const mixedKindRecords = [
  { characterId: 'aubrin', name: 'Aubrin', kind: undefined, charisma: 14 },
  { characterId: 'mara', name: 'Mara', kind: 'pc', charisma: 8 },
  { characterId: 'ostler', name: 'Ostler', kind: 'officer_npc', charisma: 18 },
  { characterId: 'rook', name: 'Rook', kind: undefined, charisma: 18 },
  { characterId: 'vessa', name: 'Vessa', kind: 'npc', charisma: 16 },
] as const satisfies ReadonlyArray<{
  characterId: string;
  name: string;
  kind: CharacterRecordKind | undefined;
  charisma: number;
}>;

export function mixedKindSnapshot() {
  return {
    rank: 3,
    training: 4,
    treasuryCopper: 5000,
    notoriety: 1,
    focus: 'Loyalty',
    characters: mixedKindRecords.map((record, index) => ({
      characterId: record.characterId,
      level: index + 2,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: record.charisma,
      isActive: record.characterId !== 'rook',
    })),
    roster: {
      people: [
        { characterId: 'aubrin', kind: 'pc', hitDice: null },
        { characterId: 'mara', kind: 'pc', hitDice: 0 },
        { characterId: 'ostler', kind: 'officer_npc', hitDice: 5 },
        { characterId: 'rook', kind: 'other_npc', hitDice: null },
        { characterId: 'vessa', kind: 'npc', hitDice: 3 },
      ],
      officers: [
        { role: 'commandant', characterId: 'ostler' },
        { role: 'commandant', characterId: 'vessa' },
        { role: 'marshal', characterId: 'mara' },
      ],
      teams: [
        team('first', 'ostler'),
        team('second', 'ostler'),
        team('third', 'rook'),
        team('fourth', 'rook'),
        team('fifth', 'vessa'),
        team('sixth', 'vessa'),
      ],
    },
    settlements: [],
    bonuses: [],
  } satisfies Snapshot;
}

function team(teamId: string, managerCharacterId: string) {
  return {
    teamId,
    teamType: 'defenders',
    name: teamId,
    status: 'active',
    rewardCapExempt: false,
    managerCharacterId,
    notes: '',
  } as const;
}
