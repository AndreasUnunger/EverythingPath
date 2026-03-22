import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyActivityAssetOperationsDraft } from '~/components/week-board/activity-asset-operations';
import { buildOfficerEffects } from '~/components/week-board/officer-effects';
import { ActivitySlotCard } from './activity-slot-card';

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

function buildDefaultProps(): ComponentProps<typeof ActivitySlotCard> {
  return {
    slotId: 'slot-1',
    slotNumber: 1,
    slotActionId: 'earn_gold',
    dragState: null,
    activeDropSlotId: null,
    slotRefs: { current: {} },
    slotTeams: ['merchants'],
    activityTeamOperations: {
      recruits: [],
      dismissals: [],
      upgrades: [],
    },
    activityOfficerOperations: {
      changes: [],
    },
    activityAssetOperations: createEmptyActivityAssetOperationsDraft(),
    teams: [
      {
        teamId: 'merchants',
        status: 'active',
        manager: {
          displayName: 'Quartermaster',
          charismaBonus: 3,
          maxTeams: 2,
          managedTeamCount: 2,
          warnings: ['Managing 2 teams exceeds the normal limit of 2.'],
        },
      },
    ],
    settlements: [],
    caches: [],
    orders: [],
    trackedPeople: [],
    activeTeamIds: ['merchants'],
    assignableCharacters: [],
    officerAssignments: {},
    officerEffects: buildOfficerEffects({
      focus: null,
      rank: 2,
      characters: [],
      baseAssignments: {},
      slots: ['earn_gold'],
      activityOfficerOperations: { changes: [] },
    }),
    strategistBonusActionId: null,
    maxTeams: 4,
    treasury: 100,
    setDragStateAction: vi.fn(),
    setSlotTeamAction: vi.fn(),
    setRecruitTeamForSlotAction: vi.fn(),
    setDismissTeamForSlotAction: vi.fn(),
    setUpgradeTeamsForSlotAction: vi.fn(),
    setOfficerChangeForSlotAction: vi.fn(),
    setRefugeSettlementForSlotAction: vi.fn(),
    setCacheOperationForSlotAction: vi.fn(),
    setOrderForSlotAction: vi.fn(),
    setCovertActionForSlotAction: vi.fn(),
    setRescueForSlotAction: vi.fn(),
    setRestorationForSlotAction: vi.fn(),
  };
}

describe('ActivitySlotCard manager rendering', () => {
  it('renders assigned-team manager summary and warnings on staged team actions', () => {
    render(<ActivitySlotCard {...buildDefaultProps()} />);

    expect(
      screen.getByText('Quartermaster manager CHA bonus +3 • managing 2/2 teams'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Rules warning: Managing 2 teams exceeds the normal limit of 2..',
      ),
    ).toBeInTheDocument();
  });

  it('renders covert-action augment manager guidance in the staged card', () => {
    const props = buildDefaultProps();
    props.slotActionId = 'covert_action';
    props.slotTeams = ['spies'];
    props.activeTeamIds = ['spies'];
    props.teams = [
      {
        teamId: 'spies',
        status: 'active',
        manager: {
          displayName: 'Shade',
          charismaBonus: 4,
          maxTeams: 4,
          managedTeamCount: 1,
          warnings: [],
        },
      },
    ];
    props.activityAssetOperations = {
      ...createEmptyActivityAssetOperationsDraft(),
      covertActions: [
        {
          slotIndex: 0,
          mode: 'augment_action',
        },
      ],
    };

    render(<ActivitySlotCard {...props} />);

    expect(
      screen.getByText(/This applies to the immediately following staged activity\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Apply Shade manager CHA bonus +4 to all d20 rolls for the following action.',
      ),
    ).toBeInTheDocument();
  });

  it('renders manipulate-events manager guidance inside the staged card', () => {
    const props = buildDefaultProps();
    props.slotActionId = 'manipulate_events';
    props.slotTeams = ['guardians'];
    props.activeTeamIds = ['guardians'];
    props.teams = [
      {
        teamId: 'guardians',
        status: 'active',
        manager: {
          displayName: 'Captain Ivet',
          charismaBonus: 1,
          maxTeams: 2,
          managedTeamCount: 1,
          warnings: [],
        },
      },
    ];

    render(<ActivitySlotCard {...props} />);

    expect(
      screen.getByText('Captain Ivet chooses which guaranteed event result to use.'),
    ).toBeInTheDocument();
  });

  it('renders secure-cache check helper text with the selected manager bonus', () => {
    const props = buildDefaultProps();
    props.slotActionId = 'secure_cache';
    props.slotTeams = ['saboteurs'];
    props.activeTeamIds = ['saboteurs'];
    props.teams = [
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
    ];
    props.activityAssetOperations = {
      ...createEmptyActivityAssetOperationsDraft(),
      caches: [
        {
          slotIndex: 0,
          mode: 'place',
          cacheClass: 'major',
          checkTotal: '',
        },
      ],
    };

    render(<ActivitySlotCard {...props} />);

    expect(
      screen.getByText('Include Shade manager CHA bonus +4 in the total entered here.'),
    ).toBeInTheDocument();
  });
});
