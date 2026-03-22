import { describe, expect, it } from 'vitest';
import {
  buildActivityRollSections,
  mergeActivityRollDraftWithServer,
  toActivityRollDraft,
} from '~/components/week-board/activity-roll-sections';
import { buildOfficerEffects } from '~/components/week-board/officer-effects';

describe('activity roll draft merging', () => {
  it('keeps locally edited values when stale server updates arrive', () => {
    const previousServerDraft = toActivityRollDraft({
      earnGoldCheckTotal: 1,
    });
    const currentDraft = {
      ...previousServerDraft,
      earnGoldCheckTotal: '12',
    };
    const nextServerDraft = toActivityRollDraft({
      earnGoldCheckTotal: 1,
    });

    const merged = mergeActivityRollDraftWithServer({
      currentDraft,
      previousServerDraft,
      nextServerDraft,
    });

    expect(merged.earnGoldCheckTotal).toBe('12');
  });

  it('accepts newer server values when local draft was not changed', () => {
    const previousServerDraft = toActivityRollDraft({
      earnGoldCheckTotal: 1,
    });
    const currentDraft = { ...previousServerDraft };
    const nextServerDraft = toActivityRollDraft({
      earnGoldCheckTotal: 15,
    });

    const merged = mergeActivityRollDraftWithServer({
      currentDraft,
      previousServerDraft,
      nextServerDraft,
    });

    expect(merged.earnGoldCheckTotal).toBe('15');
  });

  it('adds officer helper text to relevant activity checks', () => {
    const officerEffects = buildOfficerEffects({
      focus: 'Loyalty',
      rank: 2,
      characters: [
        {
          _id: 'amb' as never,
          name: 'Envoy',
          kind: 'pc',
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
          kind: 'pc',
          level: 6,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
      ],
      baseAssignments: {
        ambassador: 'amb' as never,
        commandant: 'cmd' as never,
      },
      slots: ['drill_militia', 'earn_gold'],
      activityOfficerOperations: { changes: [] },
    });

    const sections = buildActivityRollSections({
      rank: 2,
      stagedActionIds: ['drill_militia', 'earn_gold'],
      draft: toActivityRollDraft({}),
      setField: () => undefined,
      officerEffects,
      strategistBonusActionId: 'earn_gold',
    });

    expect(
      sections.find((section) => section.key === 'drill_militia')?.fields[0]?.helperText,
    ).toContain('Loyalty officer bonus +3');
    expect(
      sections.find((section) => section.key === 'drill_militia')?.fields[1]?.helperText,
    ).toContain('Commandant Hit Dice +6');
    expect(
      sections.find((section) => section.key === 'earn_gold')?.fields[0]?.helperText,
    ).toContain('Strategist bonus action +2');
  });
});
