import { z } from 'zod';
import type { CanonicalResolutionRecord } from './canonical-resolution-record';

export type HeadlineValue = string | number | boolean | null;
export type FinishedWeekHeadlineFact = {
  key: string;
  label: string;
  before: HeadlineValue;
  final: HeadlineValue;
  beforeRecorded: boolean;
  finalRecorded: boolean;
  unit: 'number' | 'gp' | 'text';
};

const MAX_HEADLINES = 2;
const integer = z.number().int();
const militiaFields = [
  { key: 'treasury', field: 'treasuryCopper', label: 'Treasury', unit: 'gp' },
  { key: 'training', field: 'training', label: 'Training', unit: 'number' },
  { key: 'rank', field: 'rank', label: 'Rank', unit: 'number' },
  { key: 'notoriety', field: 'notoriety', label: 'Notoriety', unit: 'number' },
  { key: 'focus', field: 'focus', label: 'Focus', unit: 'text' },
] as const;
const fieldSchemas = {
  treasuryCopper: integer,
  training: integer,
  rank: integer,
  notoriety: integer,
  focus: z.string().nullable(),
};
const teamsSchema = z.array(
  z.object({
    teamId: z.string(),
    name: z.string().optional(),
    status: z.string(),
  }),
);
const settlementsSchema = z.array(
  z.object({
    settlementId: z.string(),
    name: z.string().optional(),
    reputation: z.string().nullable(),
  }),
);
const eventsSchema = z.array(
  z.object({ eventId: z.string(), eventType: z.string() }),
);
const militiaFacts = [
  ...militiaFields.map(({ field }) => field),
  'roster',
  'settlements',
];
const objectSchema = z.record(z.string(), z.unknown());
type Facts = Record<string, unknown>;

// Compact finished-week comparisons read only this immutable record: its stored
// before facts (source snapshot or plan-before) and its final facts (final
// outcome or plan-after). No rules are re-run and no current labels are used.
// Values the record does not hold are unavailable, never an assumed zero.
export function projectHeadlineFacts(
  record: CanonicalResolutionRecord,
): FinishedWeekHeadlineFact[] {
  const before = beforeMilitia(record);
  const final = finalMilitia(record);
  const facts: FinishedWeekHeadlineFact[] = [];
  for (const { key, field, label, unit } of militiaFields) {
    const was = recorded(before, field);
    const now = recorded(final, field);
    // A comparison needs a recorded final value; a missing starting value is
    // reported as unavailable rather than as an unchanged or zero value.
    if (!now.recorded || (was.recorded && was.value === now.value)) continue;
    facts.push({
      key,
      label,
      before: was.value,
      final: now.value,
      beforeRecorded: was.recorded,
      finalRecorded: true,
      unit,
    });
  }
  facts.push(
    ...entityChanges(
      teamsSchema,
      before?.roster,
      final?.roster,
      'teams',
      (team) => ({ id: team.teamId, name: team.name, value: team.status }),
      'team',
      'Team',
    ),
    ...entityChanges(
      settlementsSchema,
      before,
      final,
      'settlements',
      (settlement) => ({
        id: settlement.settlementId,
        name: settlement.name,
        value: settlement.reputation,
      }),
      'settlement',
      'Settlement',
    ),
    ...entityChanges(
      eventsSchema,
      record.source.context,
      record.successorContext,
      'carriedEvents',
      (event) => ({ id: event.eventId, value: event.eventType }),
      'event',
      'Persistent event',
    ),
  );
  return facts.slice(0, MAX_HEADLINES);
}

function beforeMilitia(record: CanonicalResolutionRecord) {
  return (
    record.sourceMilitiaSnapshot ??
    facts(facts(facts(record.finalPlan.data)?.before)?.militiaSnapshot)
  );
}

// Format 2 stores a complete week state. Supported legacy artifacts store the
// militia outcome under `outcome` or as flat facts. The final outcome takes
// precedence; plan-after is used only when the outcome holds no militia facts.
function finalMilitia(record: CanonicalResolutionRecord) {
  const outcome = record.finalOutcome.data;
  const flat = militiaFacts.some((field) => field in outcome)
    ? outcome
    : undefined;
  return (
    facts(outcome.militiaSnapshot) ??
    facts(outcome.outcome) ??
    flat ??
    facts(facts(facts(record.finalPlan.data)?.after)?.militiaSnapshot)
  );
}

function facts(value: unknown): Facts | undefined {
  const parsed = objectSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function recorded(
  source: Facts | undefined,
  field: keyof typeof fieldSchemas,
): { recorded: boolean; value: HeadlineValue } {
  if (!source || !(field in source)) return { recorded: false, value: null };
  const parsed = fieldSchemas[field].safeParse(source[field]);
  return parsed.success
    ? { recorded: true, value: parsed.data }
    : { recorded: false, value: null };
}

// Additions and removals compare against an absent entity (null). Both lists
// must be recorded; otherwise nothing is known about this family.
function entityChanges<T>(
  schema: z.ZodType<T[]>,
  beforeSource: unknown,
  finalSource: unknown,
  field: string,
  describe: (entity: T) => {
    id: string;
    name?: string;
    value: string | null;
  },
  keyPrefix: string,
  fallbackLabel: string,
): FinishedWeekHeadlineFact[] {
  const before = schema.safeParse(facts(beforeSource)?.[field]);
  const final = schema.safeParse(facts(finalSource)?.[field]);
  if (!before.success || !final.success) return [];
  const was = new Map(before.data.map(describe).map((item) => [item.id, item]));
  const now = new Map(final.data.map(describe).map((item) => [item.id, item]));
  const ids = [...new Set([...was.keys(), ...now.keys()])];
  return ids.flatMap((id, index) => {
    const previous = was.get(id);
    const next = now.get(id);
    const beforeValue = previous?.value ?? null;
    const finalValue = next?.value ?? null;
    if (beforeValue === finalValue) return [];
    const name = (next?.name ?? previous?.name)?.trim() ?? '';
    return [
      {
        key: `${keyPrefix}:${id}`,
        label: name.length > 0 ? name : `${fallbackLabel} ${index + 1}`,
        before: beforeValue,
        final: finalValue,
        beforeRecorded: true,
        finalRecorded: true,
        unit: 'text' as const,
      },
    ];
  });
}
