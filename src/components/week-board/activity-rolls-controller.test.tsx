import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityRollsController } from '~/components/week-board/activity-rolls-controller';
import { buildOfficerEffects } from '~/components/week-board/officer-effects';

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

  it('queues changed rolls before leaving Activity', async () => {
    const props = buildProps();
    const { unmount } = render(<ActivityRollsController {...props} />);

    fireEvent.change(screen.getByLabelText('check total'), {
      target: { value: '17' },
    });

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(props.queueActivityRollTotalsPatchAction).toHaveBeenCalledWith({
      militiaId: 'm1',
      activityRollTotals: {
        earnGoldCheckTotal: '17',
      },
    });
  });

  it('keeps malformed rolls local until a valid total is entered', async () => {
    const props = buildProps();
    render(<ActivityRollsController {...props} />);
    fireEvent.change(screen.getByLabelText('check total'), {
      target: { value: 'invalid' },
    });
    expect(props.queueActivityRollTotalsPatchAction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('check total'), {
      target: { value: '15' },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(props.queueActivityRollTotalsPatchAction).toHaveBeenCalledWith({
      militiaId: 'm1',
      activityRollTotals: { earnGoldCheckTotal: '15' },
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
      await Promise.resolve();
    });

    expect(props.queueActivityRollTotalsPatchAction).toHaveBeenCalledWith({
      militiaId: 'm1',
      activityRollTotals: {
        earnGoldCheckTotal: '',
      },
    });
  });
});
