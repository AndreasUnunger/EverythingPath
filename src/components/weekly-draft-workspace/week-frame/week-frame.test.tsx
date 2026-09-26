import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  ShellSlotHost,
  ShellSlotProvider,
} from '~/components/campaign-shell/shell-slots';
import type { Phase, PhaseReadiness } from '../types';
import { WeekFrame, WeekSkeleton } from './week-frame';

afterEach(cleanup);

const item = (id: string) => ({ id, message: id });
function phases(eligible: boolean): PhaseReadiness[] {
  return [
    {
      phase: 'upkeep',
      available: true,
      ready: true,
      requirements: [],
      warnings: [],
    },
    {
      phase: 'activity',
      available: true,
      ready: false,
      requirements: [item('a'), item('b')],
      warnings: [item('w')],
    },
    {
      phase: 'event',
      available: true,
      ready: true,
      requirements: [],
      warnings: [item('x')],
    },
    {
      phase: 'persistent',
      available: eligible,
      ready: false,
      requirements: [item('p')],
      warnings: [],
    },
    {
      phase: 'summary',
      available: true,
      ready: false,
      requirements: [item('a'), item('b'), item('p')],
      warnings: [item('w'), item('x')],
    },
  ];
}
function navigationFor(phase: Phase, eligible: boolean) {
  const order = phases(eligible)
    .filter((step) => step.available)
    .map((step) => step.phase);
  const index = order.indexOf(phase);
  return { previous: order[index - 1] ?? null, next: order[index + 1] ?? null };
}
function frame(
  phase: Phase,
  options: {
    eligible?: boolean;
    reason?: string | null;
    choose?: (phase: Phase) => void;
  } = {},
) {
  const eligible = options.eligible ?? false;
  return (
    <WeekFrame
      week={4}
      phase={phase}
      phases={phases(eligible)}
      navigation={navigationFor(phase, eligible)}
      confirmationDisabledReason={options.reason ?? null}
      choose={options.choose ?? (() => undefined)}
      status={<p role="status">Prepare the week together.</p>}
    >
      <button type="button">Editor control</button>
    </WeekFrame>
  );
}
function stepper() {
  return within(screen.getByRole('navigation', { name: 'Week phases' }));
}

test('five positions stay in rules order with exact names, readiness descriptions and a locked Persistent', () => {
  render(frame('activity'));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Week 4 · Activity',
  );
  const buttons = stepper().getAllByRole('button');
  expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
    'Upkeep',
    'Activity',
    'Event',
    'Persistent',
    'Review & confirm',
  ]);
  expect(
    stepper().getByRole('button', { name: 'Upkeep' }),
  ).toHaveAccessibleDescription('Ready');
  const activity = stepper().getByRole('button', { name: 'Activity' });
  expect(activity).toHaveAttribute('aria-current', 'step');
  expect(activity).toHaveAccessibleDescription('2 to decide · 1 warning');
  expect(
    stepper().getByRole('button', { name: 'Event' }),
  ).toHaveAccessibleDescription('Ready · 1 warning');
  const persistent = stepper().getByRole('button', { name: 'Persistent' });
  expect(persistent).toBeDisabled();
  expect(persistent).toHaveAccessibleDescription('No carried events');
  const review = stepper().getByRole('button', { name: 'Review & confirm' });
  expect(review).toBeEnabled();
  expect(review).not.toHaveAttribute('aria-describedby');
  expect(review).toHaveTextContent(/^Review & confirm$/);
  // The old visible duplicate heading is gone; only the accessible one remains.
  expect(screen.getAllByRole('heading')).toHaveLength(1);
});

test('the footer skips a locked Persistent, never wraps and shows the current readiness line', () => {
  const choose = vi.fn();
  const view = render(frame('event', { choose }));
  expect(
    screen.getByRole('button', { name: 'Previous: Activity' }),
  ).toBeEnabled();
  const next = screen.getByRole('button', { name: 'Next: Review & confirm' });
  fireEvent.click(next);
  expect(choose).toHaveBeenLastCalledWith('summary');
  expect(screen.getByText('Event is ready. 1 warning.')).toBeInTheDocument();
  view.rerender(frame('upkeep', { choose }));
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next: Activity' })).toBeEnabled();
  expect(screen.getByText('Upkeep is ready.')).toBeInTheDocument();
  view.rerender(frame('event', { choose, eligible: true }));
  expect(
    screen.getByRole('button', { name: 'Next: Persistent' }),
  ).toBeEnabled();
  expect(stepper().getByRole('button', { name: 'Persistent' })).toBeEnabled();
  expect(
    stepper().getByRole('button', { name: 'Persistent' }),
  ).toHaveAccessibleDescription('1 to decide');
});

test('Review & confirm shows only the disabled-Confirmation reason, nothing when ready', () => {
  const view = render(frame('summary', { reason: '3 decisions left' }));
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous: Event' })).toBeEnabled();
  const lines = () =>
    Array.from(document.querySelectorAll('[data-week-readiness]'));
  expect(lines().length).toBeGreaterThan(0);
  for (const line of lines())
    expect(line).toHaveTextContent('3 decisions left');
  view.rerender(frame('summary', { reason: null }));
  for (const line of lines()) expect(line).toHaveTextContent(/^$/);
  expect(
    screen.queryByText(/ready for confirmation|need attention|decisions left/i),
  ).not.toBeInTheDocument();
  // The single announced status is the save status, not any readiness text.
  expect(screen.getAllByRole('status')).toHaveLength(1);
});

test('the phone step button opens a sheet listing every position, chooses one and returns focus', async () => {
  const choose = vi.fn();
  render(frame('activity', { choose }));
  const trigger = screen.getByRole('button', {
    name: /Step 2 of 5 · Activity/,
  });
  expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  expect(trigger).toHaveTextContent('2 to decide · 1 warning');
  trigger.focus();
  fireEvent.click(trigger);
  const sheet = await screen.findByRole('dialog', { name: 'Week 4' });
  const list = within(sheet).getAllByRole('button', {
    name: /^(Upkeep|Activity|Event|Persistent|Review & confirm)$/,
  });
  expect(list.map((button) => button.getAttribute('aria-label'))).toEqual([
    'Upkeep',
    'Activity',
    'Event',
    'Persistent',
    'Review & confirm',
  ]);
  expect(
    within(sheet).getByRole('button', { name: 'Persistent' }),
  ).toBeDisabled();
  expect(
    within(sheet).getByRole('button', { name: 'Review & confirm' }),
  ).not.toHaveAttribute('aria-describedby');
  expect(
    within(sheet).getByRole('button', { name: 'Activity' }),
  ).toHaveAttribute('aria-current', 'step');
  fireEvent.click(within(sheet).getByRole('button', { name: 'Event' }));
  expect(choose).toHaveBeenLastCalledWith('event');
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Week 4' }),
    ).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  await screen.findByRole('dialog', { name: 'Week 4' });
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Week 4' }),
    ).not.toBeInTheDocument(),
  );
});

test('Review & confirm on the phone button has no readiness caption', () => {
  render(frame('summary', { reason: '3 decisions left' }));
  const trigger = screen.getByRole('button', {
    name: /Step 5 of 5 · Review & confirm/,
  });
  expect(trigger).toHaveTextContent(/^Step 5 of 5 · Review & confirm$/);
});

test('the phone strip fills the shell host with previous/next and the readiness line', () => {
  const choose = vi.fn();
  render(
    <ShellSlotProvider>
      {frame('activity', { choose })}
      <div data-testid="bottom">
        <ShellSlotHost name="phone-status-strip" />
      </div>
    </ShellSlotProvider>,
  );
  const strip = within(screen.getByTestId('bottom'));
  fireEvent.click(strip.getByRole('button', { name: 'Previous: Upkeep' }));
  expect(choose).toHaveBeenLastCalledWith('upkeep');
  fireEvent.click(strip.getByRole('button', { name: 'Next: Event' }));
  expect(choose).toHaveBeenLastCalledWith('event');
  expect(
    strip.getByText(
      'Complete the required rolls and decisions to finish Activity. 1 warning.',
    ),
  ).toBeInTheDocument();
});

test('the loading skeleton keeps a readable status without a heading', () => {
  render(<WeekSkeleton />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading the week…');
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
