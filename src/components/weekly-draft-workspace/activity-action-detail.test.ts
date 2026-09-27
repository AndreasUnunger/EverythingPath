import { describe, expect, test } from 'vitest';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { activityView } from './activity-facts';
import { actionDetail, type ActionDetail } from './activity-action-detail';
import { activityFacts, activitySlot } from './activity-view-fixture';
import type { ActivityTeamFact, ActivityView } from './types';

type Team = UpkeepSnapshot['roster']['teams'][number];
const team = (teamId: string, teamType: string, extra: Partial<Team> = {}) =>
  ({
    teamId,
    teamType,
    name: teamId,
    status: 'active',
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
    ...extra,
  }) as Team;

// Rank 3 with Upkeep complete, one PC ("Ameiko", level 20) and the settlement
// Phaendar; `place` stages choices before the projection runs.
function week() {
  const input = foundationWeek(3);
  input.militiaSnapshot.settlements.push({
    settlementId: 'phaendar',
    name: 'Phaendar',
    reputation: 'Unfriendly',
    secured: false,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
  const view = () =>
    activityView(
      input.revision,
      workspaceSourceSchema.parse({
        key: {
          campaignId: 'campaign',
          militiaId: 'militia',
          draftId: input.revision.draftId,
        },
        week: input.revision.week,
        sourceRevision: 0,
        snapshot: input.militiaSnapshot,
        people: [{ characterId: 'pc', name: 'Ameiko' }],
      }),
      projectWeeklyDraft(input),
    );
  const place = (index: number, choice: StagedActionChoice | null) => {
    input.revision.activity.slots[index]!.choice = choice;
  };
  return { input, view, place };
}
function detailAt(view: ActivityView, index: number) {
  return actionDetail(view, view.slots[index]!)!;
}
function narrow<Id extends ActionDetail['actionId']>(
  detail: ActionDetail,
  actionId: Id,
) {
  if (detail.actionId !== actionId) throw new Error(`Expected ${actionId}`);
  return detail as Extract<ActionDetail, { actionId: Id }>;
}
const roster = (overrides: Partial<ActivityTeamFact>[]): ActivityTeamFact[] =>
  overrides.map((entry, index) => ({
    teamId: `team-${index}`,
    name: `Team ${index}`,
    teamType: 'moles',
    typeName: 'Moles',
    tier: 1,
    condition: 'active',
    unavailable: false,
    recruitedInSlot: null,
    ...entry,
  }));

describe('rule facts at the slot position', () => {
  test('[rules.ACT-10.officer-position] an earlier Change Officer Role shows in the roles a later slot sees, never in its own', () => {
    const { view, place } = week();
    place(0, {
      choiceId: 'appoint',
      actionId: 'change_officer_role',
      characterId: 'pc',
      toRole: 'strategist',
    });
    place(1, {
      choiceId: 'swap',
      actionId: 'change_officer_role',
      characterId: 'pc',
    });
    const facts = view();
    expect(facts.slots[0]!.position?.officers).toEqual([]);
    expect(facts.slots[1]!.position?.officers).toEqual([
      { characterId: 'pc', role: 'strategist' },
    ]);
    const first = narrow(detailAt(facts, 0), 'change_officer_role');
    expect(first.heldRoles).toEqual([]);
    expect(first.characters).toEqual([
      expect.objectContaining({
        value: 'pc',
        label: 'Ameiko',
        description: 'No officer role',
      }),
    ]);
    const second = narrow(detailAt(facts, 1), 'change_officer_role');
    expect(second.heldRoles).toEqual(['strategist']);
    expect(second.characters[0]!.description).toBe('Strategist');
    // Only the held role is offered first to leave; it is already held to take.
    expect(second.fromRoles[0]).toMatchObject({
      value: 'strategist',
      eligible: true,
      description: 'Held now',
    });
    expect(second.fromRoles.slice(1).every((role) => !role.eligible)).toBe(
      true,
    );
    expect(second.fromRoles).toHaveLength(6);
    expect(second.toRoles.at(-1)).toMatchObject({
      value: 'strategist',
      eligible: false,
      description: 'Already held',
    });
  });

  test('[rules.ACT-10.rescue-position] Rescue offers headquarters and refuges, marking one activated earlier this Activity, with the rules level and capture state', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.roster.teams.push(
      team('scholars', 'scholars'),
      team('guardians', 'guardians'),
    );
    input.militiaSnapshot.characterActions = {
      people: [
        {
          characterId: 'pc',
          status: 'captured',
          location: { kind: 'headquarters' },
          directRescueRequired: false,
          capture: { source: 'ordinary', week: 39 },
        },
      ],
    };
    place(0, {
      choiceId: 'refuge',
      actionId: 'activate_refuge',
      teamId: 'scholars',
      settlementId: 'phaendar',
    });
    place(1, {
      choiceId: 'rescue',
      actionId: 'rescue_character',
      teamId: 'guardians',
      characterId: 'pc',
    });
    const facts = view();
    expect(facts.slots[1]!.position?.refugeSettlementIds).toEqual(['phaendar']);
    const rescue = narrow(detailAt(facts, 1), 'rescue_character');
    expect(rescue.ruleLevel).toBe(20);
    expect(rescue.characters).toEqual([
      expect.objectContaining({
        value: 'pc',
        description: 'Level 20 · Captured',
        eligible: true,
      }),
    ]);
    expect(rescue.destinations.map((entry) => entry.value)).toEqual([
      'headquarters',
      'refuge:phaendar',
    ]);
    expect(rescue.destinations[1]).toMatchObject({
      label: 'Refuge in Phaendar',
      description: 'Active refuge',
      eligible: true,
    });
    // At the refuge's own slot it is not yet active.
    place(0, null);
    expect(
      narrow(detailAt(view(), 1), 'rescue_character').destinations[1],
    ).toMatchObject({
      eligible: false,
      description: 'No active refuge this week',
    });
  });
});

describe('option lists', () => {
  test('[rules.ACT-10.recruit] Recruit Team lists recruitable types first with the table’s check and DC, and asks for a table check only without recruitment rules', () => {
    const recruit = (
      choice: Partial<
        Extract<StagedActionChoice, { actionId: 'recruit_team' }>
      > = {},
    ) =>
      narrow(
        actionDetail(
          activityFacts([]),
          activitySlot({
            choiceId: 'recruit',
            actionId: 'recruit_team',
            ...choice,
          }),
        )!,
        'recruit_team',
      );
    const detail = recruit();
    expect(detail.recruitment).toEqual({ kind: 'none' });
    const moles = detail.teamTypes.find((entry) => entry.value === 'moles');
    expect(moles).toMatchObject({
      label: 'Moles',
      description: 'Tier 1 · Secrecy DC 15',
      eligible: true,
    });
    const firstIneligible = detail.teamTypes.findIndex(
      (entry) => !entry.eligible,
    );
    expect(
      detail.teamTypes.slice(firstIneligible).every((entry) => !entry.eligible),
    ).toBe(true);
    expect(
      detail.teamTypes.find((entry) => entry.value === 'spies'),
    ).toMatchObject({ description: 'Tier 3 · No recruitment rules' });
    expect(recruit({ teamType: 'moles' }).recruitment).toEqual({
      kind: 'rules',
      check: 'secrecy',
      dc: 15,
    });
    expect(recruit({ teamType: 'spies' }).recruitment).toEqual({
      kind: 'table',
    });
    // A recorded table check stays visible when the rules replace it.
    expect(
      recruit({
        teamType: 'moles',
        recruitmentCheck: { check: 'loyalty', dc: 12 },
      }).recruitment,
    ).toEqual({ kind: 'retained', rules: { check: 'secrecy', dc: 15 } });
    expect(
      recruit({ recruitmentCheck: { check: 'loyalty', dc: 12 } }).recruitment,
    ).toEqual({ kind: 'table' });
  });

  test('[rules.ACT-10.upgrade] Upgrade Team offers free teams with an upgrade path first and destinations on that path with their rules cost', () => {
    const teams = roster([
      { teamId: 'moles', name: 'Moles A' },
      { teamId: 'busy', name: 'Busy moles' },
      {
        teamId: 'spies',
        name: 'Spies',
        teamType: 'spies',
        typeName: 'Spies',
        tier: 3,
      },
      { teamId: 'later', name: 'Later', recruitedInSlot: 3 },
    ]);
    const facts = activityFacts(
      [
        activitySlot({
          choiceId: 'upgrade',
          actionId: 'upgrade_team',
          targetTeamId: 'moles',
        }),
        activitySlot(
          { choiceId: 'act', actionId: 'earn_gold', teamId: 'busy' },
          { slotId: 'two', number: 2 },
        ),
      ],
      { teamRoster: teams },
    );
    const detail = narrow(
      actionDetail(facts, facts.slots[0]!)!,
      'upgrade_team',
    );
    expect(
      detail.targets.map((entry) => [entry.value, entry.eligible]),
    ).toEqual([
      ['moles', true],
      ['busy', false],
      ['spies', false],
      ['later', false],
    ]);
    expect(detail.targets[1]!.description).toBe(
      'Moles 1 · Acts in Action Slot 2',
    );
    expect(detail.targets[3]!.description).toBe(
      'Moles 1 · Recruited later, in Action Slot 3',
    );
    expect(detail.destinations[0]).toMatchObject({
      value: 'propagandists',
      eligible: true,
      description: 'Tier 2 · 250 gp',
    });
    expect(detail.destinations.filter((entry) => entry.eligible)).toHaveLength(
      1,
    );
    expect(detail.destinations.some((entry) => entry.value === 'moles')).toBe(
      false,
    );
  });

  test('[rules.ACT-10.missing-reference] a recorded team, character or refuge that is gone stays listed as missing, never renamed', () => {
    const facts = activityFacts([], {
      characters: [{ characterId: 'pc', name: 'Ameiko', level: 5 }],
      settlements: [{ value: 'town', label: 'Town' }],
    });
    const dismiss = narrow(
      actionDetail(
        facts,
        activitySlot({
          choiceId: 'dismiss',
          actionId: 'dismiss_team',
          targetTeamId: 'gone',
        }),
      )!,
      'dismiss_team',
    );
    expect(dismiss.targets).toEqual([
      {
        value: 'gone',
        label: 'Missing team',
        description: 'No longer on the roster',
        eligible: false,
        missing: true,
      },
    ]);
    const rescue = narrow(
      actionDetail(
        facts,
        activitySlot({
          choiceId: 'rescue',
          actionId: 'rescue_character',
          characterId: 'lost',
          destination: { kind: 'refuge', settlementId: 'razed' },
        }),
      )!,
      'rescue_character',
    );
    expect(rescue.characters[0]).toMatchObject({
      value: 'lost',
      label: 'Missing character',
      missing: true,
    });
    expect(rescue.ruleLevel).toBeNull();
    expect(rescue.destinations[0]).toMatchObject({
      value: 'refuge:razed',
      label: 'Refuge in a missing settlement',
      missing: true,
    });
  });

  test('[rules.ACT-10.restore] Restore Character lists all seven modes with their scope and scroll cost from the rules', () => {
    const detail = narrow(
      actionDetail(
        activityFacts([]),
        activitySlot({
          choiceId: 'restore',
          actionId: 'restore_character',
          mode: 'raise_dead',
        }),
      )!,
      'restore_character',
    );
    expect(detail.scope).toBe('individual');
    expect(detail.modes.map((mode) => [mode.label, mode.description])).toEqual([
      ['Ability Damage', 'Every player character'],
      ['Hit Points', 'Every player character'],
      ['Restorative Effect', 'Every player character'],
      ['Break Enchantment', 'One character · scroll 1,125 gp'],
      ['Raise Dead', 'One character · scroll 6,125 gp'],
      ['Restoration', 'One character · scroll 1,700 gp'],
      ['Stone To Flesh', 'One character · scroll 1,650 gp'],
    ]);
  });
});

describe('rolls and consumables', () => {
  test('[rules.ACT-12.detail-rolls] Drill shows its training and notoriety rolls with when the rules use them; Lie Low has none', () => {
    const drill = actionDetail(
      activityFacts([]),
      activitySlot(
        { choiceId: 'drill', actionId: 'drill_militia' },
        { requirements: ['drill:training:2d6'] },
      ),
    )!;
    expect(drill.rolls).toEqual([
      {
        field: 'training',
        label: 'Training',
        spec: { count: 2, sides: 6 },
        when: expect.stringContaining('check succeeds'),
        required: true,
      },
      {
        field: 'notoriety',
        label: 'Notoriety',
        spec: { count: 1, sides: 6 },
        when: expect.stringContaining('natural 1'),
        required: false,
      },
    ]);
    const lieLow = actionDetail(
      activityFacts([]),
      activitySlot({ choiceId: 'low', actionId: 'lie_low' }),
    )!;
    expect(lieLow.rolls).toEqual([]);
    expect(lieLow.consumables).toBeNull();
  });

  test('[rules.ACT-12.consumables] consumables list recorded bonuses, keep a missing one visible and offer the rest', () => {
    const detail = actionDetail(
      activityFacts([], {
        bonuses: [
          { value: 'rumour', label: 'Rumour: +2 Loyalty' },
          { value: 'map', label: 'Map: +1 Secrecy' },
        ],
      }),
      activitySlot({
        choiceId: 'earn',
        actionId: 'earn_gold',
        consumableIds: ['rumour', 'spent'],
      }),
    )!;
    expect(detail.consumables).toEqual({
      selected: [
        { value: 'rumour', label: 'Rumour: +2 Loyalty', missing: false },
        { value: 'spent', label: 'Missing bonus', missing: true },
      ],
      available: [{ value: 'map', label: 'Map: +1 Secrecy' }],
    });
  });

  test('other actions keep the general choice editor', () => {
    expect(
      actionDetail(
        activityFacts([]),
        activitySlot({ choiceId: 'market', actionId: 'broker_market' }),
      ),
    ).toBeNull();
  });
});
