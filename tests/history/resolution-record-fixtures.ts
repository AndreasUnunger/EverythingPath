import {
  prepareCanonicalResolutionRecord,
  resolveCanonicalWeeklyDraft,
} from '../../src/lib/canonical-weekly-resolution';
import {
  canonicalResolutionRecordSchema,
  type CanonicalResolutionRecord,
} from '../../src/lib/canonical-resolution-record';
import { createWeeklyDraft } from '../../src/lib/weekly-draft';
import { weeklyDraftDataSchema } from '../../src/lib/weekly-draft-contract';
import type { RawRoll } from '../../src/lib/weekly-draft-facts';
import { compoundAcceptanceFixture } from '../rules/compound-acceptance-fixture';

// Immutable Resolution Record fixtures for the frozen six-section adapter and
// Finished weeks. Each is a complete record as history receives it, deeply
// frozen so any attempt to rewrite it while reading throws.

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function total(roll: RawRoll): RawRoll {
  if (!('dice' in roll)) return roll;
  const { dice, ...rest } = roll;
  return {
    ...rest,
    diceTotal: dice.reduce((sum, die) => sum + die, 0),
    diceCount: dice.length,
  };
}

/**
 * The compound acceptance week (every phase, an exception, outcomes and an
 * adjustment) resolved and recorded through the real confirmation path.
 * `rolls: 'totals'` records newer dice totals instead of individual dice.
 */
export function confirmedWeek({
  rolls = 'dice',
}: { rolls?: 'dice' | 'totals' } = {}) {
  const { input } = compoundAcceptanceFixture();
  const draft = input.revision;
  if (rolls === 'totals') {
    const upkeep = draft.upkeep.rolls;
    for (const field of ['check', 'training'] as const)
      if (upkeep[field]) upkeep[field] = total(upkeep[field]);
    for (const slot of draft.activity.slots) {
      const choiceRolls: Partial<Record<string, RawRoll>> | undefined =
        slot.choice && 'rolls' in slot.choice ? slot.choice.rolls : undefined;
      if (choiceRolls?.check) choiceRolls.check = total(choiceRolls.check);
    }
    for (const occurrence of draft.event.occurrences)
      if (occurrence.tableRoll)
        occurrence.tableRoll = total(occurrence.tableRoll);
  }
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'id-transfer',
      characterId: 'strategist',
      direction: 'deposit',
      copper: 700,
    },
  ];
  const record = prepareCanonicalResolutionRecord(
    resolveCanonicalWeeklyDraft(input),
    'confirmed-record',
  );
  return {
    draft,
    snapshot: input.militiaSnapshot,
    record: deepFreeze(record),
  };
}

function legacySource() {
  const source = weeklyDraftDataSchema.parse(
    createWeeklyDraft({
      draftId: 'legacy-draft',
      week: 9,
      slotIds: ['slot-1'],
      context: {
        firstMilitiaWeek: false,
        startDay: 56,
        uneventfulCarry: true,
        carriedEvents: [
          {
            eventId: 'id-plague',
            eventType: 'sickness',
            startedWeek: 7,
            order: 0,
            targets: [{ kind: 'team', teamId: 'id-scouts' }],
          },
        ],
        queuedEffects: [],
        orders: [],
        lastBuyoffWeek: null,
      },
    }),
  );
  source.upkeep = {
    rolls: {
      check: {
        sides: 20,
        dice: [14],
        provenance: { kind: 'table' },
        modifiers: [{ sourceId: 'drill', value: 2, reason: 'Drill bonus' }],
      },
      training: {
        sides: 4,
        dice: [3, 4],
        provenance: { kind: 'table' },
        modifiers: [],
      },
    },
    treasuryTransfers: [
      {
        transferId: 'id-old-deposit',
        characterId: 'id-quartermaster',
        direction: 'deposit',
        copper: 700,
      },
    ],
    teamDecisions: [
      { teamId: 'id-scouts', decision: 'recover', costCopper: 1500 },
    ],
  };
  source.activity.slots[0]!.choice = {
    choiceId: 'id-gold',
    actionId: 'earn_gold',
    teamId: 'id-scouts',
    costCopper: 250,
    rolls: {
      check: {
        sides: 20,
        dice: [11],
        provenance: { kind: 'table' },
        modifiers: [],
      },
    },
  };
  source.activity.operatingSettlementId = 'id-teilwood';
  // An older Event tree: each occurrence records its own type.
  source.event.occurrences = [
    {
      eventId: 'id-twice',
      origin: { kind: 'rolled' },
      eventType: 'roll_twice',
      tableRoll: {
        sides: 100,
        dice: [51],
        provenance: { kind: 'table' },
        modifiers: [],
      },
    },
    {
      eventId: 'id-games',
      origin: { kind: 'roll_twice', parentEventId: 'id-twice' },
      eventType: 'war_games',
    },
    {
      eventId: 'id-feast',
      origin: { kind: 'roll_twice', parentEventId: 'id-twice' },
      eventType: 'festival',
    },
  ];
  source.persistent.decisions = [
    { eventId: 'id-plague', kind: 'buyoff', costCopper: 9000 },
  ];
  source.acknowledgements = [
    {
      acknowledgementId: 'id-feast-told',
      subjectId: 'event:id-feast',
      outcome: 'The town feasted with the militia',
    },
    {
      acknowledgementId: 'id-stray',
      subjectId: 'id-long-gone',
      outcome: 'A ruling from an earlier tool',
    },
  ];
  source.rulesExceptions = [
    {
      exceptionId: 'id-gold-permission',
      subjectId: 'id-gold',
      ruleId: 'team-condition',
      reason: 'The scouts worked while recovering',
    },
    {
      exceptionId: 'id-vanished',
      subjectId: 'id-deleted-choice',
      ruleId: 'action-capacity',
      reason: 'An extra day was allowed then',
    },
  ];
  source.tableAdjustments = [
    {
      adjustmentId: 'id-gift',
      kind: 'militia_value',
      field: 'treasuryCopper',
      operation: 'add',
      value: -7,
      reason: 'Paid the ferryman',
    },
  ];
  return source;
}

/**
 * An older record: format 1 artifacts with loose facts and a phase-keyed
 * plan, no source militia snapshot, individual dice with a recorded
 * modifier, an actor-bearing transfer, recorded costs, an older Event tree,
 * a recorded buyoff amount with its historical warning, a legacy written
 * warning and facts no longer linked to anything in the week.
 */
export function legacyRecord(): CanonicalResolutionRecord {
  const source = legacySource();
  const { persistentPhaseEligible: _eligible, ...context } = source.context;
  const persistent = [
    {
      kind: 'persistent_buyoff',
      eventId: 'id-plague',
      costCopper: 9000,
      before: 9500,
      after: 500,
    },
    { kind: 'persistent_ended', eventId: 'id-plague', reason: 'buyoff' },
  ];
  return deepFreeze(
    canonicalResolutionRecordSchema.parse({
      recordId: 'legacy-record',
      source,
      provenance: 'historical_reconstruction',
      rulesetVersion: 1,
      baselinePlan: {
        formatVersion: 1,
        data: { persistent, treasuryCopper: 500, training: 40 },
      },
      finalPlan: {
        formatVersion: 1,
        data: { persistent, treasuryCopper: 493, training: 40 },
      },
      finalOutcome: {
        formatVersion: 1,
        data: {
          treasuryCopper: 493,
          training: 40,
          note: 'Reconstructed from the table log',
        },
      },
      adjudication: {
        acknowledgements: source.acknowledgements,
        rulesExceptions: source.rulesExceptions,
        tableAdjustments: source.tableAdjustments,
      },
      warnings: [
        { code: 'id-plague', message: 'id-plague:buyoff-cost-recomputed' },
        { code: 'team-capacity', message: 'The team allowance was exceeded.' },
        { code: 'team-capacity', message: 'The team allowance was exceeded.' },
        { code: 'unmapped', message: 'unmapped:mystery-code' },
      ],
      successorContext: {
        ...context,
        startDay: 63,
        uneventfulCarry: false,
        carriedEvents: [],
        lastBuyoffWeek: 9,
        operatedSettlementIds: ['id-teilwood'],
      },
      supersedesRecordId: null,
    }),
  );
}
