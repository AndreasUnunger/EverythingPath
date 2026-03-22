import { describe, expect, it } from 'vitest';
import {
  buildOfficerEffects,
  getCheckBonusHelperText,
  getEffectiveOfficerAssignments,
  getEventOverseerSupportOptions,
  getRecruitmentCheckType,
} from '~/components/week-board/officer-effects';

describe('officer effects', () => {
  const characters = [
    {
      _id: 'amb' as never,
      name: 'Envoy',
      kind: 'pc' as const,
      level: 4,
      strength: 10,
      dexterity: 10,
      constitution: 16,
      intelligence: 10,
      wisdom: 10,
      charisma: 14,
    },
    {
      _id: 'cmd' as never,
      name: 'Drillmaster',
      kind: 'pc' as const,
      level: 6,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    {
      _id: 'mar' as never,
      name: 'Captain',
      kind: 'pc' as const,
      level: 5,
      strength: 16,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 12,
      charisma: 10,
    },
    {
      _id: 'ovr' as never,
      name: 'Overseer',
      kind: 'pc' as const,
      level: 5,
      strength: 12,
      dexterity: 14,
      constitution: 16,
      intelligence: 10,
      wisdom: 8,
      charisma: 18,
    },
    {
      _id: 'spy' as never,
      name: 'Whisper',
      kind: 'pc' as const,
      level: 5,
      strength: 10,
      dexterity: 18,
      constitution: 10,
      intelligence: 14,
      wisdom: 10,
      charisma: 10,
    },
    {
      _id: 'str' as never,
      name: 'Planner',
      kind: 'pc' as const,
      level: 5,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 16,
      wisdom: 10,
      charisma: 10,
    },
  ];

  it('applies staged officer changes to current-week effective assignments', () => {
    const assignments = getEffectiveOfficerAssignments({
      baseAssignments: {
        ambassador: 'amb' as never,
      },
      slots: ['change_officer_role', 'drill_militia'],
      activityOfficerOperations: {
        changes: [
          {
            slotIndex: 0,
            role: 'marshal',
            characterId: 'mar' as never,
          },
        ],
      },
    });

    expect(assignments.ambassador).toBe('amb');
    expect(assignments.marshal).toBe('mar');
  });

  it('builds loyalty, security, secrecy, commandant, and strategist effects', () => {
    const effects = buildOfficerEffects({
      focus: 'Loyalty',
      rank: 2,
      characters,
      baseAssignments: {
        ambassador: 'amb' as never,
        commandant: 'cmd' as never,
        marshal: 'mar' as never,
        overseer: 'ovr' as never,
        spymaster: 'spy' as never,
        strategist: 'str' as never,
      },
      slots: ['drill_militia', 'reduce_danger', 'activate_black_market'],
      activityOfficerOperations: { changes: [] },
    });

    expect(effects.loyaltyBonus).toBe(3);
    expect(effects.securityBonus).toBe(4);
    expect(effects.secrecyBonus).toBe(4 + 1);
    expect(effects.commandantTrainingBonus).toBe(6);
    expect(effects.strategistBonusActionSlotIndex).toBe(2);
    expect(effects.overseerEventBonusByCheck.loyalty).toBe(4);
  });

  it('formats helper text with strategist and overseer support bonuses', () => {
    const effects = buildOfficerEffects({
      focus: 'Security',
      rank: 7,
      characters,
      baseAssignments: {
        ambassador: 'amb' as never,
        overseer: 'ovr' as never,
      },
      slots: [null],
      activityOfficerOperations: { changes: [] },
    });

    expect(
      getCheckBonusHelperText({
        checkType: 'loyalty',
        officerEffects: effects,
        isStrategistBonusAction: true,
        overseerSupportTarget: 'theft',
        currentEventTarget: 'theft',
      }),
    ).toContain('Strategist bonus action +2');
    expect(
      getCheckBonusHelperText({
        checkType: 'loyalty',
        officerEffects: effects,
        isStrategistBonusAction: true,
        overseerSupportTarget: 'theft',
        currentEventTarget: 'theft',
      }),
    ).toContain('Overseer event support +4');
  });

  it('returns only currently eligible overseer event support targets', () => {
    const effects = buildOfficerEffects({
      focus: 'Loyalty',
      rank: 2,
      characters,
      baseAssignments: {
        overseer: 'ovr' as never,
      },
      slots: [null, null],
      activityOfficerOperations: { changes: [] },
    });

    expect(
      getEventOverseerSupportOptions({
        officerEffects: effects,
        eventWouldOccurBeforeSabotage: true,
        resolvedEventNames: ['Sickness'],
      }).map((option) => option.value),
    ).toEqual(['sabotage', 'sickness_twice']);
  });

  it('maps recruit team choices to the correct organization check type', () => {
    expect(getRecruitmentCheckType('moles')).toBe('secrecy');
    expect(getRecruitmentCheckType('informants')).toBe('loyalty');
    expect(getRecruitmentCheckType('defenders')).toBe('security');
    expect(getRecruitmentCheckType('patrons')).toBe('loyalty');
    expect(getRecruitmentCheckType('saboteurs')).toBeUndefined();
  });
});
