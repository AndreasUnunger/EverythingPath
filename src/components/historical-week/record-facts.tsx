import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { choiceFieldLabel } from '../weekly-draft-workspace/structured-choice-field';
const metadata = new Set([
  'draftId',
  'recordId',
  'revision',
  'schemaVersion',
  'formatVersion',
  'code',
]);
const semanticFields = new Set(['ruleId', 'actionId']);
const nameFields: Record<string, string> = {
  teamId: 'name',
  settlementId: 'name',
  itemId: 'name',
  cacheId: 'location',
  eventId: 'eventType',
  choiceId: 'actionId',
};
const labels: Record<string, string> = {
  treasuryCopper: 'Treasury (copper)',
  sourceMilitiaSnapshot: 'Militia at confirmation',
  militiaSnapshot: 'Militia',
  firstMilitiaWeek: 'Skip first Upkeep',
  uneventfulCarry: 'Uneventful-week benefit',
  carriedEvents: 'Persistent events',
  queuedEffects: 'Queued effects',
  after: 'Resulting state',
  before: 'Starting state',
  characterId: 'Character',
  teamId: 'Team',
  slotId: 'Action slot',
  subjectId: 'Subject',
};
const label = (field: string) =>
  labels[field] ?? choiceFieldLabel(field).replace(/[-:]/g, ' ');

// Labels come exclusively from this record. Numbered fallbacks keep distinct
// unnamed characters distinguishable without consulting today's character ledger.
export function recordedLabels(record: CanonicalResolutionRecord) {
  const names = new Map<string, string>();
  const counts = new Map<string, number>();
  function register(field: string, value: unknown, name?: string) {
    if (
      !field.endsWith('Id') ||
      typeof value !== 'string' ||
      metadata.has(field) ||
      semanticFields.has(field)
    )
      return;
    if (name) {
      names.set(value, name);
      return;
    }
    if (names.has(value)) return;
    const count = (counts.get(field) ?? 0) + 1;
    counts.set(field, count);
    names.set(value, `${label(field)} ${count}`);
  }
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const fields = Object.entries(value as Record<string, unknown>);
    for (const [key, item] of fields) {
      if (key.endsWith('Ids') && Array.isArray(item)) {
        const ids: unknown[] = item;
        ids.forEach((id) => register(key.slice(0, -1), id));
      } else {
        const named = fields.find(
          ([field, value]) =>
            field === nameFields[key] && typeof value === 'string',
        );
        register(
          key,
          item,
          named
            ? ['name', 'location'].includes(named[0])
              ? String(named[1])
              : label(String(named[1]))
            : undefined,
        );
      }
    }
    fields.forEach(([, item]) => visit(item));
  }
  visit(record.sourceMilitiaSnapshot);
  visit(record.source);
  visit(record.finalOutcome.data);
  visit(record.baselinePlan.data);
  visit(record.finalPlan.data);
  return names;
}
export function RecordFacts({
  value,
  names,
  field = '',
}: {
  value: unknown;
  names: Map<string, string>;
  field?: string;
}) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">Not recorded</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number')
    return <span className="font-mono">{value}</span>;
  if (typeof value === 'string')
    return (
      <span className="break-words">
        {recordedText(value, field, names) || 'None'}
      </span>
    );
  if (Array.isArray(value))
    return value.length ? (
      <ol className="space-y-3">
        {entries(value).map(({ item, key }) => (
          <li key={key} className="min-w-0 border-l pl-3">
            <RecordFacts value={item} names={names} field={field} />
          </li>
        ))}
      </ol>
    ) : (
      <span className="text-muted-foreground">None</span>
    );
  return (
    <dl className="grid min-w-0 gap-2">
      {Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !metadata.has(key))
        .map(([key, item]) => (
          <div key={key} className="min-w-0">
            <dt className="text-muted-foreground text-xs">{label(key)}</dt>
            <dd>
              <RecordFacts value={item} names={names} field={key} />
            </dd>
          </div>
        ))}
    </dl>
  );
}

function entries(values: unknown[]) {
  const counts = new Map<string, number>();
  return values.map((item) => {
    const signature = JSON.stringify(item);
    const occurrence = counts.get(signature) ?? 0;
    counts.set(signature, occurrence + 1);
    return { item, key: `${signature}:${occurrence}` };
  });
}

function recordedText(
  value: string,
  field: string,
  names: Map<string, string>,
) {
  if (
    semanticFields.has(field) ||
    [
      'kind',
      'status',
      'phase',
      'eventType',
      'field',
      'operation',
      'teamType',
      'role',
      'check',
    ].includes(field)
  )
    return label(value);
  if (field.endsWith('Id') || field.endsWith('Ids'))
    return names.get(value) ?? 'Unnamed recorded reference';
  // These structured provenance messages use colon-delimited reference tokens.
  // Free-form notes, reasons and outcomes retain their exact recorded wording.
  if (['message', 'source'].includes(field) && value.includes(':'))
    return value
      .split(':')
      .map((part) => names.get(part) ?? part)
      .join(' · ');
  return value;
}
