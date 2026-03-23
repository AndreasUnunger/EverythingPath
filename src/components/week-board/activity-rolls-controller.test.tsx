import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityRollsController } from '~/components/week-board/activity-rolls-controller';
import { buildOfficerEffects } from '~/components/week-board/officer-effects';

const useDebouncedAutosaveMock = vi.fn();

vi.mock('~/hooks/use-debounced-autosave', () => ({
  useDebouncedAutosave: (config: unknown) => useDebouncedAutosaveMock(config),
}));

function getLatestAutosave() {
  return useDebouncedAutosaveMock.mock.calls.at(-1)?.[0] as
    | {
        shouldSkip: () => boolean;
        run: () => Promise<void>;
      }
    | undefined;
}

function buildProps(overrides?: Record<string, unknown>) {
  return {
    militiaId: 'm1' as never,
    rank: 2,
    stagedActionIds: ['earn_gold'],
    serverTotals: {},
    officerEffects: buildOfficerEffects({
      focus: 'Loyalty',
      rank: 2,
      characters: [],
      baseAssignments: {},
      slots: ['earn_gold'],
      activityOfficerOperations: { changes: [] },
    }),
    strategistBonusActionId: null,
    recruitTeamId: undefined,
    slotTeams: [null],
    teams: [],
    queueActivityRollTotalsPatchAction: vi.fn(async () => undefined),
    onErrorAction: vi.fn(),
    ...overrides,
  };
}

describe('ActivityRollsController sparse autosave payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('queues only the changed activity roll field', async () => {
    const props = buildProps();
    render(<ActivityRollsController {...props} />);

    fireEvent.change(screen.getByLabelText('check total'), {
      target: { value: '17' },
    });

    await act(async () => {
      await getLatestAutosave()?.run();
    });

    expect(props.queueActivityRollTotalsPatchAction).toHaveBeenCalledWith({
      militiaId: 'm1',
      activityRollTotals: {
        earnGoldCheckTotal: '17',
      },
    });
  });

  it('queues explicit clears when an existing roll total is emptied', async () => {
    const props = buildProps({
      serverTotals: {
        earnGoldCheckTotal: 11,
      },
    });
    render(<ActivityRollsController {...props} />);

    fireEvent.change(screen.getByLabelText('check total'), {
      target: { value: '' },
    });

    await act(async () => {
      await getLatestAutosave()?.run();
    });

    expect(props.queueActivityRollTotalsPatchAction).toHaveBeenCalledWith({
      militiaId: 'm1',
      activityRollTotals: {
        earnGoldCheckTotal: '',
      },
    });
  });
});
