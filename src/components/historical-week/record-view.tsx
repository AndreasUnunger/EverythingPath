import { Card } from '~/components/ui/card';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { recordedLabels, RecordFacts } from './record-facts';
// The record's facts only; the Finished weeks pane owns its header (week,
// provenance, date, Ruleset Version, earlier-entry status) and footer.
export function HistoricalRecordView({
  record,
}: {
  record: CanonicalResolutionRecord;
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
