import { Card } from '~/components/ui/card';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { recordedLabels, RecordFacts } from './record-facts';
export const provenanceLabels = {
  confirmation: 'Confirmed week',
  historical_reconstruction: 'Historical reconstruction',
  historical_correction: 'Historical correction',
};
export function HistoricalRecordView({
  record,
  effective,
}: {
  record: CanonicalResolutionRecord;
  effective: boolean;
}) {
  const names = recordedLabels(record);
  const sections = [
    ['Recorded choices and week context', record.source],
    ['Militia at confirmation', record.sourceMilitiaSnapshot],
    ['Rules baseline plan', record.baselinePlan.data],
    ['Final plan', record.finalPlan.data],
    ['Warnings', record.warnings],
    ['Rules exceptions', record.adjudication.rulesExceptions],
    ['Table adjustments', record.adjudication.tableAdjustments],
    ['Table outcomes', record.adjudication.acknowledgements],
    ['Final outcome', record.finalOutcome.data],
    ['Next-week context', record.successorContext],
  ] as const;
  return (
    <article className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl">Week {record.source.week} · History</h1>
        <p>
          {effective ? 'Effective record' : 'Earlier record · Audit history'}
        </p>
        <p className="text-muted-foreground text-sm">
          {provenanceLabels[record.provenance]} ·{' '}
          <span>Ruleset {record.rulesetVersion}</span>
        </p>
        <p className="text-sm">
          Read-only · Recorded when this week was resolved.
        </p>
      </header>
      <div className="grid items-start gap-4 md:grid-cols-2">
        {sections.map(([title, value]) => (
          <Card key={title} className="min-w-0 p-4">
            <section aria-label={title}>
              <details
                open={
                  title === 'Final outcome' ||
                  title === 'Table adjustments' ||
                  title === 'Warnings'
                }
              >
                <summary className="cursor-pointer font-semibold">
                  {title}
                </summary>
                <div className="mt-3 min-w-0 text-sm">
                  {title === 'Militia at confirmation' &&
                  value === undefined ? (
                    <p>Militia facts were not included in this record.</p>
                  ) : (
                    <RecordFacts value={value} names={names} />
                  )}
                </div>
              </details>
            </section>
          </Card>
        ))}
      </div>
    </article>
  );
}
