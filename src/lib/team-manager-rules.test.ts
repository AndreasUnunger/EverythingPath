import { describe, expect, it } from 'vitest';
import {
  buildResolvedTeamManagers,
  getTeamManagerCharismaBonus,
  getTeamManagerMaxTeams,
} from './team-manager-rules';

describe('team manager rules', () => {
  it('uses Charisma bonus for manager check modifiers and minimum one team for PCs', () => {
    expect(getTeamManagerCharismaBonus(8)).toBe(0);
    expect(getTeamManagerCharismaBonus(18)).toBe(4);
    expect(getTeamManagerMaxTeams({ kind: 'pc', charisma: 8 })).toBe(1);
    expect(getTeamManagerMaxTeams({ kind: 'officer_npc', charisma: 18 })).toBe(4);
    expect(getTeamManagerMaxTeams({ kind: 'other_npc', charisma: 18 })).toBe(1);
  });

  it('warns when one manager exceeds the normal team limit', () => {
    const resolved = buildResolvedTeamManagers({
      teams: [
        {
          teamId: 'moles',
          managerSource: 'character',
          managerCharacterId: 'char_1',
        },
        {
          teamId: 'informants',
          managerSource: 'character',
          managerCharacterId: 'char_1',
        },
      ],
      characters: [
        {
          _id: 'char_1',
          name: 'Aubrin',
          kind: 'pc',
          charisma: 12,
          isActive: true,
        },
      ],
    });

    expect(resolved.get('moles')?.managedTeamCount).toBe(2);
    expect(resolved.get('moles')?.warnings).toContain(
      'Managing 2 teams exceeds the normal limit of 1.',
    );
  });

  it('warns when a linked character manager no longer exists', () => {
    const resolved = buildResolvedTeamManagers({
      teams: [
        {
          teamId: 'guardians',
          managerSource: 'character',
          managerCharacterId: 'char_missing',
        },
      ],
      characters: [],
    });

    expect(resolved.get('guardians')?.displayName).toBe('Missing character');
    expect(resolved.get('guardians')?.warnings).toContain(
      'Linked manager character no longer exists.',
    );
  });
});
