import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  SummaryPhaseSection,
  type SummaryPhaseViewModel,
} from '~/components/week-board/phase-sections/summary-phase-section';

function buildViewModel(
  overrides: Partial<SummaryPhaseViewModel> = {},
): SummaryPhaseViewModel {
  return {
    startingMilitiaItems: [],
    rulesBaselineItems: [],
    tableAdjustmentItems: [],
    finalOutcomeItems: [],
    resolvedOutcomeItems: [],
    attentionItems: [],
    warningItems: [],
    upkeepInputItems: [],
    activitySelectionItems: [],
    stagedOperationItems: [],
    activityRollInputItems: [],
    eventInputItems: [],
    ...overrides,
  };
}

describe('SummaryPhaseSection', () => {
  it('shows the server-resolved event separately from the raw event input', () => {
    render(
      <SummaryPhaseSection
        viewModel={buildViewModel({
          resolvedOutcomeItems: ['45: All Is Calm (Twice)'],
          eventInputItems: ['Event table roll: 80'],
        })}
      />,
    );

    expect(
      within(screen.getByText('Resolved outcome').parentElement!).getByText(
        '45: All Is Calm (Twice)',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText('Event inputs').parentElement!).getByText(
        'Event table roll: 80',
      ),
    ).toBeInTheDocument();
  });

  it('renders non-militia plan outcomes and adjustment reasons', () => {
    render(
      <SummaryPhaseSection
        viewModel={buildViewModel({
          rulesBaselineItems: ['Recover Moles (paid recovery)'],
          tableAdjustmentItems: [
            'Set Moles status to active. Reason: Recovered by GM ruling.',
          ],
          finalOutcomeItems: [
            'Set Moles status to active',
            'Add Theft event (persistent)',
          ],
        })}
      />,
    );

    expect(
      screen.getByText('Recover Moles (paid recovery)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Set Moles status to active. Reason: Recovered by GM ruling.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Add Theft event (persistent)'),
    ).toBeInTheDocument();
  });
});
