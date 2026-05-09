import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildOfficerEffects } from '~/components/week-board/officer-effects';
import { EventPhaseSection } from './event-phase-section';

vi.mock('~/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder ?? null}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

function buildViewModel(): ComponentProps<typeof EventPhaseSection>['viewModel'] {
  return {
    eventChanceTotal: '25',
    setEventChanceTotalAction: vi.fn(),
    eventTriggerRollTotal: '10',
    setEventTriggerRollTotalAction: vi.fn(),
    eventPercentileTotal: '',
    setEventPercentileTotalAction: vi.fn(),
    effectiveEventPercentileTotal: '',
    guaranteedEventFirstPercentileTotal: '11',
    setGuaranteedEventFirstPercentileTotalAction: vi.fn(),
    guaranteedEventSecondPercentileTotal: '44',
    setGuaranteedEventSecondPercentileTotalAction: vi.fn(),
    guaranteedEventChoice: 'first',
    setGuaranteedEventChoiceAction: vi.fn(),
    showRollTwiceFields: false,
    eventRollTwiceFirst: '',
    setEventRollTwiceFirstAction: vi.fn(),
    eventRollTwiceSecond: '',
    setEventRollTwiceSecondAction: vi.fn(),
    suggestedEventChanceTotal: 25,
    rank: 2,
    eventWouldOccurBeforeSabotage: true,
    sabotageCheckTotal: '',
    setSabotageCheckTotalAction: vi.fn(),
    sabotageNotorietyIncreaseTotal: '',
    setSabotageNotorietyIncreaseTotalAction: vi.fn(),
    sabotageNegatesEvent: false,
    shouldResolveEventTable: true,
    resolvedEventTrigger: {
      status: 'event',
      chanceValue: 25,
      rollValue: 10,
    },
    hasGuaranteedEventAction: true,
    resolvedEvent: null,
    resolvedRollTwiceFirst: null,
    resolvedRollTwiceSecond: null,
    resolvedEventNames: [],
    teams: [
      {
        teamId: 'saboteurs',
        status: 'active',
        manager: {
          displayName: 'Shade',
          charismaBonus: 4,
          maxTeams: 4,
          managedTeamCount: 1,
          warnings: [],
        },
      },
    ],
    marketplaces: [],
    manipulateEventsManagerText:
      'Captain Ivet chooses which guaranteed event result to use.',
    cacheDiscoveredMitigationTotal: '',
    setCacheDiscoveredMitigationTotalAction: vi.fn(),
    theftMitigationTotal: '',
    setTheftMitigationTotalAction: vi.fn(),
    sicknessTwiceLoyaltyTotal: '',
    setSicknessTwiceLoyaltyTotalAction: vi.fn(),
    turncoatTrainingLossTotal: '',
    setTurncoatTrainingLossTotalAction: vi.fn(),
    turncoatOfficerCheckTotal: '',
    setTurncoatOfficerCheckTotalAction: vi.fn(),
    turncoatSelectedTeamId: '',
    setTurncoatSelectedTeamIdAction: vi.fn(),
    missingInActionSelectedTeamId: '',
    setMissingInActionSelectedTeamIdAction: vi.fn(),
    sicknessSelectedTeamId: '',
    setSicknessSelectedTeamIdAction: vi.fn(),
    turnAroundBoostTeamId: '',
    setTurnAroundBoostTeamIdAction: vi.fn(),
    marketDayMarketplaceId: '',
    setMarketDayMarketplaceIdAction: vi.fn(),
    marketDayTownName: '',
    setMarketDayTownNameAction: vi.fn(),
    marketDayAppliesToAllTrackedMarketplaces: false,
    rivalrySelectedTeamIds: [],
    setRivalrySelectedTeamIdsAction: vi.fn(),
    officerEffects: buildOfficerEffects({
      focus: null,
      rank: 2,
      characters: [],
      baseAssignments: {},
      slots: [],
      activityOfficerOperations: { changes: [] },
    }),
    overseerEventSupportTarget: '',
    setOverseerEventSupportTargetAction: vi.fn(),
    onPreviousWeekAction: vi.fn(),
    previousWeekDisabled: false,
    continueLabel: 'Continue to Summary',
    onContinueAction: vi.fn(),
  };
}

describe('EventPhaseSection manager rendering', () => {
  it('renders manager guidance for guaranteed-event choice and sabotage checks', () => {
    render(<EventPhaseSection viewModel={buildViewModel()} />);

    expect(
      screen.getByText('Captain Ivet chooses which guaranteed event result to use.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Include Saboteurs manager CHA bonus +4 in the total entered here.',
      ),
    ).toBeInTheDocument();
  });

  it('renders Market Day controls when the resolved event includes Market Day', () => {
    const viewModel = buildViewModel();
    viewModel.resolvedEventNames = ['Market Day'];
    viewModel.marketplaces = [
      {
        _id: 'market-1',
        label: 'Longshadow Brokered Market',
        sourceAction: 'broker_market',
        teamId: 'merchants',
        availabilityTier: 'small_town',
        availabilityThreshold: 75,
        saleValuePercent: 50,
        contrabandAllowed: false,
        createdWeek: 3,
        activeUntilWeek: 4,
      },
    ];

    render(<EventPhaseSection viewModel={viewModel} />);

    expect(screen.getByText('Market Day tracked marketplace')).toBeInTheDocument();
    expect(screen.getByText('Longshadow Brokered Market')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Choose a tracked marketplace for the durable discount, or note the operated town used at the table.',
      ),
    ).toBeInTheDocument();
  });
});
