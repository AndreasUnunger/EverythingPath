import { describe, expect, it } from 'vitest';
import {
  buildResolvedTeamManagers,
  formatTeamManagerBonus,
  getTeamManagerCharismaBonus,
  getTeamManagerMaxTeams,
} from './team-manager-rules';

describe('team manager rules', () => {
  it('uses Charisma bonus for manager check modifiers and minimum one team for PCs', () => {
    expect(getTeamManagerCharismaBonus(8)).toBe(0);
    expect(getTeamManagerCharismaBonus(18)).toBe(4);
    expect(getTeamManagerMaxTeams({ kind: 'pc', charisma: 8 })).toBe(1);
    expect(getTeamManagerMaxTeams({ kind: 'officer_npc', charisma: 18 })).toBe(
      4,
    );
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

  it('warns when a linked character manager is archived', () => {
    const resolved = buildResolvedTeamManagers({
      teams: [
        {
          teamId: 'saboteurs',
          managerSource: 'character',
          managerCharacterId: 'char_1',
        },
      ],
      characters: [
        {
          _id: 'char_1',
          name: 'Quartermaster',
          kind: 'officer_npc',
          charisma: 14,
          isActive: false,
        },
      ],
    });

    expect(resolved.get('saboteurs')?.warnings).toContain(
      'Linked manager character is archived.',
    );
  });

  it('treats trimmed freeform names as the same manager identity when counting limits', () => {
    const resolved = buildResolvedTeamManagers({
      teams: [
        {
          teamId: 'moles',
          managerSource: 'freeform',
          managerName: ' Quartermaster ',
          managerKind: 'other_npc',
          managerCharisma: 18,
        },
        {
          teamId: 'informants',
          managerSource: 'freeform',
          managerName: 'quartermaster',
          managerKind: 'other_npc',
          managerCharisma: 18,
        },
      ],
      characters: [],
    });

    expect(resolved.get('moles')?.managedTeamCount).toBe(2);
    expect(resolved.get('moles')?.warnings).toContain(
      'Managing 2 teams exceeds the normal limit of 1.',
    );
  });

  it('returns null for teams without a complete manager assignment', () => {
    const resolved = buildResolvedTeamManagers({
      teams: [
        {
          teamId: 'merchants',
          managerSource: 'freeform',
          managerName: '   ',
          managerKind: 'other_npc',
          managerCharisma: 12,
        },
        {
          teamId: 'patrons',
        },
      ],
      characters: [],
    });

    expect(resolved.get('merchants')).toBeNull();
    expect(resolved.get('patrons')).toBeNull();
  });

  it('formats manager bonus helper text with signed values', () => {
    expect(
      formatTeamManagerBonus({
        displayName: 'Quartermaster',
        charismaBonus: 3,
      }),
    ).toBe('Quartermaster manager CHA bonus +3');
  });
});
