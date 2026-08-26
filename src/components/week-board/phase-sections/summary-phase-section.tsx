'use client';

import { Card } from '~/components/ui/card';

export type SummaryPhaseViewModel = {
  startingMilitiaItems: string[];
  rulesBaselineItems: string[];
  tableAdjustmentItems: string[];
  finalOutcomeItems: string[];
  resolvedOutcomeItems: string[];
  attentionItems: string[];
  warningItems: string[];
  upkeepInputItems: string[];
  activitySelectionItems: string[];
  stagedOperationItems: string[];
  activityRollInputItems: string[];
  eventInputItems: string[];
};

export function SummaryPhaseSection({
  viewModel,
}: {
  viewModel: SummaryPhaseViewModel;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Resolution Preview</p>
        <div className="space-y-2 font-mono text-xs">
          <p className="text-muted-foreground">
            Review this week&apos;s changes before confirming.
          </p>
          <SummaryListCard
            title="Starting militia"
            items={viewModel.startingMilitiaItems}
          />
          <SummaryListCard
            title="Rules baseline"
            items={viewModel.rulesBaselineItems}
          />
          <SummaryListCard
            title="Table adjustments"
            items={viewModel.tableAdjustmentItems}
          />
          <SummaryListCard
            title="Outcome after table adjustments"
            items={viewModel.finalOutcomeItems}
          />
          <SummaryListCard
            title="Resolved outcome"
            items={viewModel.resolvedOutcomeItems}
          />
          <SummaryListCard
            title="Needs attention"
            items={viewModel.attentionItems}
            listClassName="text-amber-700"
          />
          <SummaryListCard
            title="Rules warnings"
            items={viewModel.warningItems}
            listClassName="text-amber-700"
          />
        </div>
      </Card>

      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Inputs Entered</p>
        <div className="space-y-2 font-mono text-xs">
          <SummaryListCard
            title="Upkeep totals"
            items={viewModel.upkeepInputItems}
          />
          <SummaryListCard
            title="Activity selections"
            items={viewModel.activitySelectionItems}
          />
          <SummaryListCard
            title="Staged operations"
            items={viewModel.stagedOperationItems}
          />
          <SummaryListCard
            title="Activity roll totals"
            items={viewModel.activityRollInputItems}
          />
          <SummaryListCard
            title="Event inputs"
            items={viewModel.eventInputItems}
          />
        </div>
      </Card>
    </div>
  );
}

function SummaryListCard({
  title,
  items,
  listClassName,
}: {
  title: string;
  items: string[];
  listClassName?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded border p-2">
      <p className="text-muted-foreground">{title}</p>
      <ul className={`mt-1 space-y-1 ${listClassName ?? ''}`.trim()}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
