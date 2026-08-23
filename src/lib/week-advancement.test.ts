import { describe, expect, it } from 'vitest';
import {
  resolveWeeklyDraft,
  WEEKLY_RESOLUTION_RULESET_VERSION,
  type WeeklyResolutionDraft,
  type WeeklyResolutionSnapshot,
} from '~/lib/weekly-resolution';

const RULES = {
  weekly: 'militia-rules.md:208-246 — Weekly Sequence and Upkeep',
  sabotage: 'militia-rules.md:386-391 — Action: Sabotage',
  rollTwice: 'militia-rules.md:450-466, 556-560 — Event Phase / Roll Twice',
  queued: 'militia-rules.md:450-603 — Event and Persistent effects',
  guarantee: 'militia-rules.md:322-328 — Action: Guarantee Event',
  adjustments: 'CONTEXT.md — Rules Baseline and Table Adjustment',
} as const;

function resolve({
  draft,
  snapshot,
}: {
  draft?: Partial<WeeklyResolutionDraft>;
  snapshot?: Partial<WeeklyResolutionSnapshot> & {
    militia?: Partial<WeeklyResolutionSnapshot['militia']>;
  };
} = {}) {
  return resolveWeeklyDraft({
    draft: {
      revision: 1,
      weekNumber: 2,
      uneventfulBonusCarry: 0,
      stagedActivityActionIds: [],
      ...draft,
    },
    snapshot: {
      militia: {
        rank: 4,
        training: 20,
        treasury: 30,
        notoriety: 25,
        ...snapshot?.militia,
      },
      activeQueuedEffects: snapshot?.activeQueuedEffects ?? [],
      activePersistentEventTypes: snapshot?.activePersistentEventTypes ?? [],
    },
  });
}

describe('weekly resolution interface', () => {
  it(`applies an uneventful week through one interface (${RULES.weekly})`, () => {
    const result = resolve({
      draft: {
        upkeepRollTotals: { attritionTotal: 3 },
        activityRollTotals: {
          drillMilitiaTrainingGainTotal: 2,
          earnGoldTotal: 5,
        },
        eventRollTotals: { eventChanceTotal: 25, eventTriggerRollTotal: 70 },
      },
    });

    expect(result.status).toBe('ready');
    expect(result.rulesetVersion).toBe(WEEKLY_RESOLUTION_RULESET_VERSION);
    expect(result.summary.militia).toEqual({
      training: 19,
      treasury: 35,
      notoriety: 25,
    });
    expect(result.summary.nextUneventfulBonusCarry).toBe(4);
    expect(result.summary.resolvedEvents).toEqual([]);
  });

  it(`applies Sabotage notoriety and negates the event (${RULES.sabotage})`, () => {
    const result = resolve({
      draft: {
        weekNumber: 3,
        uneventfulBonusCarry: 2,
        eventRollTotals: {
          eventChanceTotal: 60,
          eventTriggerRollTotal: 10,
          eventPercentileTotal: 80,
          sabotageCheckTotal: 19,
          sabotageNotorietyIncreaseTotal: 2,
        },
      },
    });

    expect(result.summary.militia.notoriety).toBe(27);
    expect(result.summary.resolvedEvents).toEqual([]);
  });

  it(`handles a duplicate Roll Twice result once (${RULES.rollTwice})`, () => {
    const result = resolve({
      draft: {
        weekNumber: 4,
        uneventfulBonusCarry: 5,
        eventRollTotals: {
          eventChanceTotal: 60,
          eventTriggerRollTotal: 10,
          eventPercentileTotal: 50,
          rollTwiceFirstTotal: 45,
          rollTwiceSecondTotal: 45,
        },
      },
      snapshot: {
        militia: { rank: 5, training: 40, treasury: 40, notoriety: 40 },
      },
    });

    expect(result.summary.resolvedEvents).toHaveLength(2);
    expect(result.summary.resolvedEvents[0]?.eventType).toBe('all_is_calm');
    expect(result.summary.resolvedEvents[1]?.isTwiceClause).toBe(true);
    expect(result.summary.nextUneventfulBonusCarry).toBe(0);
  });

  it(`applies queued and persistent modifiers (${RULES.queued})`, () => {
    const result = resolve({
      draft: {
        weekNumber: 6,
        upkeepRollTotals: { attritionTotal: 2 },
        activityRollTotals: { earnGoldTotal: 10 },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
          rollTwiceFirstTotal: 100,
        },
      },
      snapshot: {
        militia: { rank: 3, training: 18, treasury: 20, notoriety: 30 },
        activeQueuedEffects: [
          { kind: 'double_upkeep_attrition', appliesWeek: 6 },
          { kind: 'auto_event_roll_once', appliesWeek: 6 },
        ],
        activePersistentEventTypes: ['theft'],
      },
    });

    expect(result.summary.militia.training).toBe(14);
    expect(result.summary.militia.treasury).toBe(25);
    expect(
      result.summary.resolvedEvents.some(
        (event) => event.eventType === 'week_of_pain',
      ),
    ).toBe(true);
  });

  it(`uses the selected Guarantee Event roll (${RULES.guarantee})`, () => {
    const result = resolve({
      draft: {
        weekNumber: 5,
        stagedActivityActionIds: ['guarantee_event'],
        eventRollTotals: {
          guaranteedFirstPercentileTotal: 80,
          guaranteedSecondPercentileTotal: 12,
          guaranteedChosen: 'second',
        },
      },
      snapshot: {
        militia: { rank: 4, training: 16, treasury: 20, notoriety: 20 },
      },
    });

    expect(result.summary.resolvedEvents[0]?.eventType).toBe('war_games');
    expect(result.summary.militia.training).toBe(20);
  });

  it(`applies typed adjustments after the rules baseline (${RULES.adjustments})`, () => {
    const result = resolve({
      draft: {
        tableAdjustments: [
          {
            kind: 'militia_value',
            field: 'treasury',
            operation: 'add',
            value: 12,
            reason: 'Narrative reward from the GM.',
          },
          {
            kind: 'team_status',
            teamId: 'moles',
            status: 'active',
            reason: 'Recovered through a table ruling.',
          },
        ],
      },
    });

    expect(result.baselinePlan).toContainEqual({
      kind: 'militia_values',
      training: 20,
      treasury: 30,
      notoriety: 25,
    });
    expect(result.summary.militia.treasury).toBe(42);
    expect(result.finalPlan).toContainEqual({
      kind: 'set_team_status',
      teamId: 'moles',
      status: 'active',
    });
    expect(result.warnings).toContainEqual({
      code: 'table_adjustment',
      message: 'Narrative reward from the GM.',
    });
  });

  it('marks a reasonless Table Adjustment incomplete', () => {
    const result = resolve({
      draft: {
        tableAdjustments: [
          {
            kind: 'militia_value',
            field: 'training',
            operation: 'set',
            value: 99,
            reason: '   ',
          },
        ],
      },
    });

    expect(result.status).toBe('incomplete');
    expect(result.missingInputs).toContainEqual({
      path: 'tableAdjustments.0.reason',
      message: 'Table Adjustments require a reason.',
    });
  });
});
