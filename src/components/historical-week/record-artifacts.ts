import type {
  PlanChange,
  SabotageFact,
} from '~/components/week-review/review-changes';
import type { ComparedState } from '~/components/week-review/review-comparison';
import type { ReviewPhase } from '~/components/week-review/review-facts';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { militiaSnapshotSchema } from '~/lib/canonical-weekly-source';
import { weekStartFactsSchema } from '~/lib/weekly-draft-contract';

// Reads one immutable Resolution Record's stored artifacts. Format 2 holds
// complete typed plans and states; earlier formats hold loose facts, perhaps
// keyed by phase. Stored states are only checked for their structure: nothing
// is recalculated, and a value the record does not hold stays unknown.

type Artifact = CanonicalResolutionRecord['baselinePlan'];
type Facts = Readonly<Record<string, unknown>>;
type Snapshot = NonNullable<ComparedState['militiaSnapshot']>;
type Context = NonNullable<ComparedState['context']>;

export type RecordedPlans = Record<ReviewPhase, readonly PlanChange[] | null>;
export type RecordedWeek = {
  /** Each phase's recorded plan, in execution order; null if not recorded. */
  plans: RecordedPlans;
  sabotage: readonly SabotageFact[];
  atConfirmation: ComparedState;
  baseline: ComparedState;
  final: ComparedState;
  /** Whether every compared state holds its complete militia and context. */
  complete: boolean;
  nextWeek: number;
};

const phases = ['upkeep', 'activity', 'event', 'persistent'] as const;
const phaseFields = new Set<string>([...phases, 'sabotage']);

function isFacts(value: unknown): value is Facts {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function snapshotOf(value: unknown): Snapshot | null {
  const parsed = militiaSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function contextOf(value: unknown): Context | null {
  const parsed = weekStartFactsSchema.strip().safeParse(value);
  return parsed.success ? parsed.data : null;
}

type TypedPlan = { before: Facts; after: Facts; effects: Facts };
function typedPlan(artifact: Artifact): TypedPlan | null {
  const { before, after, effects } = artifact.data;
  return artifact.formatVersion === 2 &&
    isFacts(before) &&
    isFacts(after) &&
    isFacts(effects)
    ? { before, after, effects }
    : null;
}

/** A stored week state; a part failing its structure stays readable loosely. */
function weekState(value: Facts): ComparedState {
  const militiaSnapshot = snapshotOf(value.militiaSnapshot);
  const context = contextOf(value.context);
  const recorded: Record<string, unknown> = {};
  if (!militiaSnapshot && isFacts(value.militiaSnapshot))
    Object.assign(recorded, value.militiaSnapshot);
  if (!context && value.context !== undefined) recorded.context = value.context;
  return {
    militiaSnapshot,
    context,
    ...(Object.keys(recorded).length ? { recorded } : {}),
  };
}

/**
 * An earlier format's loose facts: a militia state under `militiaSnapshot`
 * or `outcome`, or flat militia values; phase plans are consequences, and
 * every other field is kept as a recorded fact.
 */
function looseState(data: Facts): ComparedState {
  let militiaSnapshot: Snapshot | null = null;
  let context: Context | null = null;
  const recorded: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(data)) {
    if (phaseFields.has(field) && Array.isArray(value)) continue;
    if (field === 'week' && typeof value === 'number') continue;
    if (field === 'militiaSnapshot' || field === 'outcome') {
      const parsed: Snapshot | null = militiaSnapshot
        ? null
        : snapshotOf(value);
      if (parsed) {
        militiaSnapshot = parsed;
        continue;
      }
      if (isFacts(value)) {
        Object.assign(recorded, value);
        continue;
      }
    }
    if (field === 'context') {
      context ??= contextOf(value);
      if (context) continue;
    }
    recorded[field] = value;
  }
  return { militiaSnapshot, context, recorded };
}

function planEntries(effects: Facts | undefined, field: string) {
  const value = effects?.[field];
  return Array.isArray(value) ? (value as readonly unknown[]) : null;
}

function weekOf(value: Facts | undefined) {
  return typeof value?.week === 'number' ? value.week : null;
}

export function readRecordedWeek(
  record: CanonicalResolutionRecord,
): RecordedWeek {
  const baselinePlan = typedPlan(record.baselinePlan);
  const finalPlan = typedPlan(record.finalPlan);
  // Phase consequences are the same in both plans; the baseline's come first.
  const sources = [
    baselinePlan?.effects,
    finalPlan?.effects,
    record.baselinePlan.data,
    record.finalPlan.data,
  ];
  const find = (field: string) =>
    sources.reduce<readonly unknown[] | null>(
      (found, effects) => found ?? planEntries(effects, field),
      null,
    );
  // Stored entries keep the shapes the typed plan had when recorded.
  const plans = Object.fromEntries(
    phases.map((phase) => [phase, find(phase)]),
  ) as RecordedPlans;
  const sabotage = (find('sabotage') ?? []) as readonly SabotageFact[];

  const atConfirmation: ComparedState = {
    militiaSnapshot:
      record.sourceMilitiaSnapshot ??
      snapshotOf(baselinePlan?.before.militiaSnapshot ?? null),
    context: record.source.context,
  };
  const baseline = baselinePlan
    ? weekState(baselinePlan.after)
    : looseState(record.baselinePlan.data);
  const recordedFinal = finalState(record, finalPlan);
  // The recorded successor context is the Final week context.
  const final = {
    ...recordedFinal,
    context: recordedFinal.context ?? record.successorContext,
  };
  const states = [atConfirmation, baseline, final];
  return {
    plans,
    sabotage,
    atConfirmation,
    baseline,
    final,
    complete: states.every(
      (state) =>
        state.militiaSnapshot !== null &&
        state.context !== null &&
        !state.recorded,
    ),
    nextWeek:
      weekOf(record.finalOutcome.data) ??
      weekOf(finalPlan?.after) ??
      record.source.week + 1,
  };
}

/** The Final column: the recorded outcome, else the final plan's result. */
function finalState(
  record: CanonicalResolutionRecord,
  finalPlan: TypedPlan | null,
): ComparedState {
  if (record.finalOutcome.formatVersion === 2) {
    const outcome = weekState(record.finalOutcome.data);
    if (outcome.militiaSnapshot || !finalPlan) return outcome;
  }
  return finalPlan ? weekState(finalPlan.after) : looseFinal(record);
}

/** Loose final facts: the recorded outcome wins over the final plan's. */
function looseFinal(record: CanonicalResolutionRecord): ComparedState {
  const plan = looseState(record.finalPlan.data);
  const outcome = looseState(record.finalOutcome.data);
  return {
    militiaSnapshot: outcome.militiaSnapshot ?? plan.militiaSnapshot,
    context: outcome.context ?? plan.context,
    recorded: { ...plan.recorded, ...outcome.recorded },
  };
}
