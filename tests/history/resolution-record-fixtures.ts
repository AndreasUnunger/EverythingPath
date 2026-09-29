import {
  prepareCanonicalResolutionRecord,
  resolveCanonicalWeeklyDraft,
} from '../../src/lib/canonical-weekly-resolution';
import { resolutionArtifactSchema } from '../../src/lib/canonical-resolution-record';
import {
  militiaSnapshotSchema,
  type CanonicalWeekState,
} from '../../src/lib/canonical-weekly-source';
import type { RawRoll } from '../../src/lib/weekly-draft-facts';
import { compoundAcceptanceFixture } from '../rules/compound-acceptance-fixture';
import { upkeepFixture } from '../rules/upkeep-fixture';

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
  // Retained below the Notoriety threshold: recorded, but never run.
  draft.upkeep.notorietyCheck = {
    sides: 20,
    dice: [3],
    provenance: { kind: 'table' },
    modifiers: [],
  };
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'id-transfer',
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

/** A valid militia snapshot for records that need one but test nothing in it. */
export function recordSnapshot() {
  return militiaSnapshotSchema.parse(upkeepFixture().snapshot);
}

/**
 * Record artifacts whose plans hold no entries: the Rules Baseline and Final
 * states as stored, each defaulting to the one before it.
 */
export function emptyPlanArtifacts({
  before,
  baseline = before,
  final = baseline,
}: {
  before: CanonicalWeekState;
  baseline?: CanonicalWeekState;
  final?: CanonicalWeekState;
}) {
  const artifact = (data: unknown) =>
    resolutionArtifactSchema.parse({
      formatVersion: 2,
      data: JSON.parse(JSON.stringify(data)) as unknown,
    });
  return {
    baselinePlan: artifact({ before, after: baseline, effects: {} }),
    finalPlan: artifact({ before, after: final, effects: {} }),
    finalOutcome: artifact(final),
  };
}
