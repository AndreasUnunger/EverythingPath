import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { useState } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CharacterMoveControl } from './character-move-control';
import type { useCharacterMove } from './use-character-move';

// The owner's Add, Move and Leave campaign in the sheet's campaign row
// (#316), driven by hand-built controller states: the controller's own
// rules (eligibility, operation identity, stale replies) are covered by
// use-character-move.test.ts.

type Movement = ReturnType<typeof useCharacterMove>;
type Progress = NonNullable<Movement['progress']>;
const rustedHill = 'rusted-hill' as Id<'campaign'>;
const kingmaker = 'kingmaker' as Id<'campaign'>;
const thornkeep = 'thornkeep' as Id<'campaign'>;
const leaveText =
  'Leaving removes this character from the militia roster and officer and manager assignments. Its sheet and homebrew stay with it.';

const handlers = {
  startMove: vi.fn<Movement['startMove']>(),
  resumeMove: vi.fn<Movement['resumeMove']>(),
  cancelMove: vi.fn<Movement['cancelMove']>(),
  retryRead: vi.fn<Movement['retryRead']>(),
};

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    isAvailable: true,
    isLoading: false,
    isDisabled: false,
    isBusy: false,
    canStart: true,
    canResume: false,
    canCancel: false,
    canLeave: true,
    currentCampaignId: rustedHill,
    currentCampaignHasMilitia: true,
    departureRoles: [],
    pendingDestinationCampaignId: undefined,
    isPickerOpen: false,
    setIsPickerOpen: () => undefined,
    destinations: [
      {
        campaignId: kingmaker,
        campaignName: 'Kingmaker',
        organizationId: 'o',
        hasMilitia: true,
      },
      {
        campaignId: thornkeep,
        campaignName: 'Thornkeep',
        organizationId: 'p',
        hasMilitia: false,
      },
    ],
    status: { kind: 'idle' },
    progress: null,
    needsInspection: false,
    operatorStatus: null,
    readError: null,
    ...handlers,
    ...overrides,
  };
}
function progress(state: Progress['state'], prepared = 2): Progress {
  return { generation: 0, operationId: 'op-1', state, prepared, total: 6 };
}

// The picker's open state lives with the controller; a saved start closes it.
// `afterStart` is the controller once a start is saved.
function Host({
  state: initial,
  afterStart,
  isMilitiaOnly,
}: {
  state: Movement;
  afterStart?: Movement;
  isMilitiaOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const state = started && afterStart ? afterStart : initial;
  return (
    <CharacterMoveControl
      characterName="Vessa"
      campaignName="Rusted Hill"
      isMilitiaOnly={isMilitiaOnly}
      movement={{
        ...state,
        isPickerOpen: isOpen,
        setIsPickerOpen: (open) => setIsOpen(open && state.canStart),
        startMove: async (...destination) => {
          const saved = await state.startMove(...destination);
          if (saved) {
            setIsOpen(false);
            setStarted(true);
          }
          return saved;
        },
      }}
    />
  );
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const announced = () =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent)
    .join(' ');

beforeEach(() => {
  vi.clearAllMocks();
  handlers.startMove.mockResolvedValue(true);
  handlers.resumeMove.mockResolvedValue(true);
  handlers.cancelMove.mockResolvedValue(true);
  handlers.retryRead.mockResolvedValue(undefined);
});

test('nothing moves before eligibility is known, for anyone else, or during maintenance; the owner sees the entry points for where the character is', () => {
  const view = render(
    <Host state={movement({ isAvailable: false, isLoading: true })} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading campaign choices…',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();

  view.rerender(<Host state={movement({ isLoading: true })} />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading move progress…',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();

  // Someone else's, or an ineligible production Character.
  view.rerender(<Host state={movement({ isAvailable: false })} />);
  expect(view.container).toBeEmptyDOMElement();

  // Maintenance or a save in flight: shown, not usable.
  view.rerender(
    <Host
      state={movement({ isDisabled: true, canStart: false, canLeave: false })}
    />,
  );
  expect(button('Move to campaign')).toBeDisabled();
  expect(button('Leave campaign')).toBeDisabled();

  view.rerender(<Host state={movement({ currentCampaignId: undefined })} />);
  expect(button('Add to campaign')).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Leave campaign' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(leaveText)).not.toBeInTheDocument();

  view.rerender(<Host state={movement()} />);
  expect(button('Move to campaign')).toBeEnabled();
  expect(button('Leave campaign')).toHaveAccessibleDescription(leaveText);
  expect(screen.queryByText(/Full character/)).not.toBeInTheDocument();

  view.rerender(<Host state={movement()} isMilitiaOnly />);
  expect(button('Leave campaign')).toHaveAccessibleDescription(
    `${leaveText} As a Militia-only character it becomes a Full character, which can’t be undone.`,
  );
});

test('the picker is a named dialog of the other campaigns as cards; an empty list reads plainly and closing returns focus to its trigger', async () => {
  const view = render(<Host state={movement()} />);
  fireEvent.click(button('Move to campaign'));
  const picker = within(
    screen.getByRole('dialog', { name: 'Move to campaign' }),
  );
  expect(picker.getByRole('radiogroup', { name: 'Campaigns' })).toBeVisible();
  expect(
    picker
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent),
  ).toEqual(['Kingmaker', 'Thornkeep']);
  expect(picker.queryByRole('radio', { name: /Rusted Hill/ })).toBeNull();
  expect(
    screen.getByRole('dialog', { name: 'Move to campaign' }),
  ).toHaveAccessibleDescription(
    /Vessa leaves Rusted Hill when the move completes/,
  );
  // Nothing is submitted without a choice.
  expect(picker.getByRole('button', { name: 'Move character' })).toBeDisabled();

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(button('Move to campaign')).toHaveFocus());
  expect(handlers.startMove).not.toHaveBeenCalled();

  view.rerender(<Host state={movement({ destinations: [] })} />);
  fireEvent.click(button('Move to campaign'));
  const empty = within(screen.getByRole('dialog'));
  expect(empty.getByText('No other campaigns are available.')).toBeVisible();
  expect(empty.queryByRole('radio')).toBeNull();
  expect(empty.getByRole('button', { name: 'Move character' })).toBeDisabled();
});

test('joining saves the chosen campaign once, acknowledged in the picker while pending; leaving starts a move to no campaign', async () => {
  let save!: (saved: boolean) => void;
  handlers.startMove.mockReturnValue(
    new Promise((resolve) => {
      save = resolve;
    }),
  );
  const private_ = movement({ currentCampaignId: undefined, canLeave: false });
  const view = render(<Host state={private_} />);
  fireEvent.click(button('Add to campaign'));
  const dialog = screen.getByRole('dialog', { name: 'Add to campaign' });
  const picker = within(dialog);
  expect(dialog).toHaveAccessibleDescription(/isn’t added to a militia roster/);
  fireEvent.click(picker.getByRole('radio', { name: 'Thornkeep' }));
  fireEvent.click(picker.getByRole('button', { name: 'Join campaign' }));
  expect(handlers.startMove).toHaveBeenCalledTimes(1);
  expect(handlers.startMove).toHaveBeenCalledWith(thornkeep);

  // The controller reports the save; duplicates are refused until it lands.
  view.rerender(
    <Host
      state={{
        ...private_,
        isBusy: true,
        isDisabled: true,
        canStart: false,
        status: { kind: 'saving' },
      }}
    />,
  );
  expect(picker.getByRole('button', { name: 'Join campaign' })).toBeDisabled();
  expect(picker.getByRole('radio', { name: 'Thornkeep' })).toBeDisabled();
  expect(picker.getByRole('status')).toHaveTextContent('Saving move…');
  expect(screen.queryByText(/Added to campaign/)).not.toBeInTheDocument();
  await act(async () => save(true));
  expect(handlers.startMove).toHaveBeenCalledTimes(1);

  view.unmount();
  handlers.startMove.mockResolvedValue(true);
  render(<Host state={movement()} />);
  fireEvent.click(button('Leave campaign'));
  await act(async () => {
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave campaign',
      }),
    );
  });
  expect(handlers.startMove).toHaveBeenCalledTimes(2);
  expect(handlers.startMove).toHaveBeenLastCalledWith();
});

test('a saved start hands focus to its progress, from the picker or from Leave campaign', async () => {
  const preparing = movement({
    progress: progress('preparing'),
    status: { kind: 'saved' },
    canStart: false,
    canLeave: false,
    canResume: true,
    canCancel: true,
  });
  const view = render(<Host state={movement()} afterStart={preparing} />);
  fireEvent.click(button('Move to campaign'));
  const picker = within(screen.getByRole('dialog'));
  fireEvent.click(picker.getByRole('radio', { name: 'Kingmaker' }));
  await act(async () => {
    fireEvent.click(picker.getByRole('button', { name: 'Move character' }));
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(button('Continue move')).toHaveFocus());
  view.unmount();

  render(<Host state={movement()} afterStart={preparing} />);
  button('Leave campaign').focus();
  fireEvent.click(button('Leave campaign'));
  await act(async () => {
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave campaign',
      }),
    );
  });
  expect(button('Continue move')).toHaveFocus();
});

test('preparing, ready and completed are distinct: progress continues and publishes, and only a finished move says so', async () => {
  const view = render(
    <Host
      state={movement({
        progress: progress('preparing'),
        status: { kind: 'saved' },
        canStart: false,
        canLeave: false,
        canResume: true,
        canCancel: true,
      })}
    />,
  );
  const panel = within(screen.getByRole('region', { name: 'Move progress' }));
  expect(panel.getByText('Preserving homebrew…')).toBeVisible();
  const bar = panel.getByRole('progressbar', { name: 'Homebrew preserved' });
  expect(bar).toHaveAttribute('aria-valuenow', '2');
  expect(bar).toHaveAttribute('aria-valuemax', '6');
  // The old campaign stays authoritative: no entry points, no success.
  expect(screen.queryByRole('button', { name: /campaign/ })).toBeNull();
  expect(announced()).not.toMatch(/moved|Added|Left/);
  fireEvent.click(panel.getByRole('button', { name: 'Continue move' }));
  expect(handlers.resumeMove).toHaveBeenCalledTimes(1);
  fireEvent.click(panel.getByRole('button', { name: 'Cancel move' }));
  expect(handlers.cancelMove).toHaveBeenCalledTimes(1);

  view.rerender(
    <Host
      state={movement({
        progress: progress('ready', 6),
        status: { kind: 'saved' },
        canStart: false,
        canLeave: false,
        canResume: true,
        canCancel: true,
      })}
    />,
  );
  expect(screen.getByText('Ready to move')).toBeVisible();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(announced()).not.toMatch(/moved/);
  fireEvent.click(button('Complete move'));
  expect(handlers.resumeMove).toHaveBeenCalledTimes(2);

  // Published: the live projection now names the destination.
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(screen.queryByRole('region', { name: 'Move progress' })).toBeNull();
  expect(announced()).toBe(
    'Character moved. Add this character to the militia roster separately.',
  );
  expect(button('Move to campaign')).toBeEnabled();
});

test('a join and a departure each name their result; a move finished before the sheet opened, or cancelled, says only that', () => {
  const pending = movement({
    currentCampaignId: undefined,
    progress: progress('ready', 6),
    canStart: false,
    canResume: true,
  });
  const view = render(<Host state={pending} />);
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(announced()).toBe(
    'Added to campaign. Add this character to the militia roster separately.',
  );
  view.unmount();

  const leaving = render(
    <Host
      state={movement({ progress: progress('ready', 6), canStart: false })}
    />,
  );
  leaving.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
        currentCampaignId: undefined,
      })}
    />,
  );
  expect(announced()).toBe('Left campaign.');
  expect(button('Add to campaign')).toBeEnabled();
  leaving.unmount();

  const cancelled = render(
    <Host
      state={movement({ progress: progress('preparing'), canStart: false })}
    />,
  );
  cancelled.rerender(
    <Host
      state={movement({
        progress: progress('cancelled'),
        status: { kind: 'saved' },
      })}
    />,
  );
  expect(announced()).toBe(
    'Move cancelled. Your character stays in its current campaign.',
  );
  expect(button('Move to campaign')).toBeEnabled();
  cancelled.unmount();

  render(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
      })}
    />,
  );
  expect(announced()).toBe('');
});

test('a refusal is an alert beside the picker that keeps the choice; an uncertain reply offers Check progress, never a new move', async () => {
  const view = render(<Host state={movement()} />);
  fireEvent.click(button('Move to campaign'));
  const picker = within(screen.getByRole('dialog'));
  fireEvent.click(picker.getByRole('radio', { name: 'Kingmaker' }));
  const refused = "Move wasn't saved: Choose a different campaign. Try again.";
  handlers.startMove.mockResolvedValue(false);
  await act(async () => {
    fireEvent.click(picker.getByRole('button', { name: 'Move character' }));
  });
  view.rerender(
    <Host state={movement({ status: { kind: 'error', message: refused } })} />,
  );
  expect(picker.getByRole('alert')).toHaveTextContent(refused);
  expect(picker.getByRole('radio', { name: 'Kingmaker' })).toBeChecked();
  // A corrected destination may start again.
  fireEvent.click(picker.getByRole('radio', { name: 'Thornkeep' }));
  fireEvent.click(picker.getByRole('button', { name: 'Move character' }));
  expect(handlers.startMove).toHaveBeenLastCalledWith(thornkeep);
  view.unmount();

  const uncertain =
    'The move may have been saved. Check its progress before trying again.';
  render(
    <Host
      state={movement({
        needsInspection: true,
        canStart: false,
        canLeave: false,
        canResume: true,
        status: { kind: 'error', message: uncertain },
      })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(uncertain);
  expect(screen.queryByText(/failed/i)).toBeNull();
  expect(screen.queryByRole('button', { name: /campaign/ })).toBeNull();
  fireEvent.click(button('Check progress'));
  expect(handlers.resumeMove).toHaveBeenCalledTimes(1);
  expect(handlers.startMove).toHaveBeenCalledTimes(2);
});

test('a failed read offers Try again and nothing else; a newer refusal is never hidden by an earlier success', () => {
  const view = render(
    <Host
      state={movement({
        isAvailable: false,
        readError:
          'Campaign choices or move progress could not be loaded. Try again.',
      })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Campaign choices or move progress could not be loaded.',
  );
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(button('Try again'));
  expect(handlers.retryRead).toHaveBeenCalledTimes(1);
  expect(handlers.startMove).not.toHaveBeenCalled();

  view.rerender(
    <Host
      state={movement({ progress: progress('ready', 6), canStart: false })}
    />,
  );
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(announced()).toMatch(/^Character moved\./);
  const refused = "Move wasn't saved: Campaign not found. Try again.";
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'error', message: refused },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(refused);
  expect(announced()).toBe('');
});

test('leaving confirms lost assignments, copied homebrew and private access before any save', async () => {
  render(
    <Host
      state={movement({
        departureRoles: [
          'Militia roster',
          'Officer: marshal',
          'Team manager: Scouts',
        ],
      })}
    />,
  );
  fireEvent.click(button('Leave campaign'));
  expect(handlers.startMove).not.toHaveBeenCalled();
  const dialog = within(
    screen.getByRole('dialog', { name: 'Take Vessa out of Rusted Hill?' }),
  );
  expect(dialog.getByText(/Officer: marshal/)).toBeVisible();
  expect(dialog.getByText(/Team manager: Scouts/)).toBeVisible();
  expect(dialog.getByText(/homebrew.*own copy/)).toBeVisible();
  expect(dialog.getByText(/Only you can see it afterwards/)).toBeVisible();
  await act(async () =>
    fireEvent.click(dialog.getByRole('button', { name: 'Leave campaign' })),
  );
  expect(handlers.startMove).toHaveBeenCalledWith();
});

test('arrival to a campaign without a militia does not suggest adding a roster place', () => {
  const view = render(
    <Host
      state={movement({
        progress: progress('ready', 6),
        currentCampaignId: undefined,
        canStart: false,
      })}
    />,
  );
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        currentCampaignId: kingmaker,
        currentCampaignHasMilitia: false,
        status: { kind: 'saved' },
      })}
    />,
  );
  expect(announced()).toBe('Added to campaign.');
  expect(
    screen.queryByText(/Add this character to the militia roster separately/),
  ).toBeNull();
});
