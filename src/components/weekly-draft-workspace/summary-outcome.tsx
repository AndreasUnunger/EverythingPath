import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type { PhaseView } from './types';
import { choiceFieldLabel } from './structured-choice-field';
type Summary = Extract<PhaseView, { phase: 'summary' }>;
const identityFields = new Set([
  'adjustmentId',
  'acknowledgementId',
  'effectId',
  'bonusId',
  'marketId',
  'orderId',
  'benefitId',
]);
function factLabel(key: string) {
  const labels: Record<string, string> = {
    militiaSnapshot: 'Militia',
    context: 'Future week',
    treasuryCopper: 'Treasury (copper)',
    firstMilitiaWeek: 'Skip first Upkeep',
    uneventfulCarry: 'Uneventful-week benefit',
    carriedEvents: 'Persistent events',
    queuedEffects: 'Queued effects',
    people: 'Roster',
    characterActions: 'Character conditions and locations',
    eventBenefits: 'Event benefits',
    economy: 'Assets and delivery',
    operatedSettlementIds: 'Operated settlements',
  };
  return labels[key] ?? choiceFieldLabel(key);
}
function namedValue(value: string, field: string, view: Summary) {
  if (field === 'source') {
    const named = [
      ...(view.options.eventId ?? []),
      ...(view.options.subjectId ?? []),
    ].find((item) => item.value === value);
    if (named) return named.label;
  }
  if (
    [
      'kind',
      'eventType',
      'status',
      'teamType',
      'check',
      'phase',
      'bonusType',
      'reputation',
      'receiptStatus',
      'operation',
    ].includes(field)
  )
    return choiceFieldLabel(value);
  if (field === 'actionId') return choiceFieldLabel(value);
  const key =
    field === 'sourceEventIds'
      ? 'eventId'
      : field === 'operatedSettlementIds'
        ? 'settlementId'
        : field === 'managerCharacterId' || field === 'ownerCharacterId'
          ? 'characterId'
          : field.endsWith('Ids')
            ? field.slice(0, -1)
            : field;
  if (key === 'characterId')
    return (
      view.people.find((person) => person.characterId === value)?.name ??
      view.options.characterId?.find((item) => item.value === value)?.label ??
      'Unnamed character'
    );
  if (field.endsWith('Id') || field.endsWith('Ids'))
    return (
      view.options[key]?.find((item) => item.value === value)?.label ??
      'Recorded source'
    );
  return value;
}
function factEntries(values: unknown[]) {
  const occurrences = new Map<string, number>();
  return values.map((value) => {
    const signature = JSON.stringify(value);
    const occurrence = occurrences.get(signature) ?? 0;
    occurrences.set(signature, occurrence + 1);
    return { value, key: `${signature}:${occurrence}` };
  });
}
export function SummaryFacts({
  value,
  field,
  view,
}: {
  value: unknown;
  field: string;
  view: Summary;
}) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">Not recorded</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'string')
    return (
      <span className="break-words">
        {namedValue(value, field, view) || 'None'}
      </span>
    );
  if (typeof value === 'number')
    return <span className="font-mono">{value}</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ol className="space-y-3">
        {factEntries(value).map(({ value: item, key }) => (
          <li key={key} className="min-w-0 border-l pl-3">
            <SummaryFacts value={item} field={field} view={view} />
          </li>
        ))}
      </ol>
    ) : (
      <span className="text-muted-foreground">None</span>
    );
  return (
    <dl className="grid min-w-0 gap-2">
      {Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !identityFields.has(key))
        .map(([key, item]) => (
          <div key={key} className="min-w-0">
            <dt className="text-muted-foreground text-xs">{factLabel(key)}</dt>
            <dd className="min-w-0">
              <SummaryFacts value={item} field={key} view={view} />
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function SummaryOutcome({
  title,
  state,
  view,
}: {
  title: string;
  state: CanonicalWeekState | null;
  view: Summary;
}) {
  return (
    <section aria-label={title} className="min-w-0 space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {state ? (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt>Training</dt>
              <dd>{state.militiaSnapshot.training}</dd>
            </div>
            <div>
              <dt>Treasury</dt>
              <dd>{state.militiaSnapshot.treasuryCopper} cp</dd>
            </div>
            <div>
              <dt>{view.ready ? 'Next week' : 'Week being prepared'}</dt>
              <dd>{state.week}</dd>
            </div>
          </dl>
          {Object.entries(state.militiaSnapshot)
            .filter(([key]) => !['training', 'treasuryCopper'].includes(key))
            .map(([key, value]) => (
              <details
                key={key}
                className="min-w-0 rounded-md border p-3"
                open={['rank', 'notoriety', 'focus'].includes(key)}
              >
                <summary className="cursor-pointer font-medium">
                  {factLabel(key)}
                </summary>
                <div className="mt-2 min-w-0">
                  <SummaryFacts value={value} field={key} view={view} />
                </div>
              </details>
            ))}
          <details className="min-w-0 rounded-md border p-3">
            <summary className="cursor-pointer font-medium">
              Future week
            </summary>
            <div className="mt-2 min-w-0">
              <SummaryFacts value={state.context} field="context" view={view} />
            </div>
          </details>
        </>
      ) : (
        <p>A complete preview is not available yet.</p>
      )}
    </section>
  );
}
