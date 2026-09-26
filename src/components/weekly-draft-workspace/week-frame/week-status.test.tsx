import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  ConfirmedWeekNotice,
  FeedbackDetails,
  RemoteChangeNote,
  SaveStatus,
  remoteChangeText,
} from './week-status';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
afterEach(cleanup);

function status() {
  return document.querySelector('[data-week-status]')!;
}

test.each([
  ['idle', 'Prepare the week together.'],
  ['pending', 'Saving changes…'],
  ['saved', 'Changes saved.'],
  ['confirming', 'Confirming the week…'],
] as const)(
  '[status.%s] the one status line is a polite status with the exact text',
  (feedback, text) => {
    render(<SaveStatus feedback={feedback} failureReason={null} />);
    expect(screen.getByRole('status')).toBe(status());
    expect(document.querySelectorAll('[data-week-status]')).toHaveLength(1);
    expect(status()).toHaveTextContent(text);
    expect(status()).toHaveAttribute('aria-live', 'polite');
    expect(status()).not.toHaveAttribute('data-week-status-failed');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

test('[status.failed] a failed save is one red alert with the exact text; the polite status falls silent', () => {
  const view = render(<SaveStatus feedback="saved" failureReason={null} />);
  const polite = screen.getByRole('status');
  view.rerender(<SaveStatus feedback="failed" failureReason={null} />);
  expect(screen.getByRole('alert')).toBe(status());
  expect(document.querySelectorAll('[data-week-status]')).toHaveLength(1);
  expect(status()).toHaveTextContent(
    'Changes could not be saved. The latest saved values are shown.',
  );
  expect(status()).toHaveAttribute('data-week-status-failed');
  expect(status()).toHaveClass('text-destructive');
  // The polite region stays mounted (so the recovery is announced) but
  // carries nothing while the alert speaks.
  expect(polite).toBeInTheDocument();
  expect(polite).toBeEmptyDOMElement();
  view.rerender(<SaveStatus feedback="pending" failureReason={null} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toBe(polite);
  expect(status()).toBe(polite);
  expect(polite).toHaveTextContent('Saving changes…');
});

test('[status.reason] a safe server reason follows the failure text inside the same status', () => {
  render(
    <SaveStatus
      feedback="failed"
      failureReason="Campaign editing is paused for maintenance. Please try again later."
    />,
  );
  expect(status().textContent).toBe(
    'Changes could not be saved. The latest saved values are shown. Campaign editing is paused for maintenance. Please try again later.',
  );
});

test('[status.reason-only-failed] a reason is never shown with a non-failed feedback', () => {
  render(<SaveStatus feedback="saved" failureReason="stale reason" />);
  expect(status().textContent).toBe('Changes saved.');
});

test('[remote.text] the note names every changed phase in order, never one arbitrary phase', () => {
  expect(remoteChangeText(['upkeep'])).toBe('Another player changed Upkeep.');
  expect(remoteChangeText(['upkeep', 'event'])).toBe(
    'Another player changed Upkeep and Event.',
  );
  expect(remoteChangeText(['activity', 'persistent', 'summary'])).toBe(
    'Another player changed Activity, Persistent and Review & confirm.',
  );
});

test('[remote.note] the note is its own polite status beside the save status and stays mounted (empty) without evidence', () => {
  const view = render(<RemoteChangeNote change={null} />);
  const note = document.querySelector('[data-week-remote-note]')!;
  expect(note).toHaveAttribute('role', 'status');
  expect(note).toBeEmptyDOMElement();
  view.rerender(
    <RemoteChangeNote change={{ sequence: 1, phases: ['upkeep', 'event'] }} />,
  );
  expect(note).toHaveTextContent('Another player changed Upkeep and Event.');
  expect(note).not.toHaveAttribute('data-week-status');
  view.rerender(<RemoteChangeNote change={null} />);
  expect(note).toBeEmptyDOMElement();
});

test('[remote.reannounce] a new batch in the same phase replaces the text node so it is announced again; a rerender of the same batch does not', () => {
  const view = render(
    <RemoteChangeNote change={{ sequence: 1, phases: ['upkeep'] }} />,
  );
  const note = document.querySelector('[data-week-remote-note]')!;
  const first = note.firstElementChild;
  view.rerender(
    <RemoteChangeNote change={{ sequence: 1, phases: ['upkeep'] }} />,
  );
  expect(note.firstElementChild).toBe(first);
  view.rerender(
    <RemoteChangeNote change={{ sequence: 2, phases: ['upkeep'] }} />,
  );
  expect(note).toHaveTextContent('Another player changed Upkeep.');
  expect(note.firstElementChild).not.toBe(first);
});

test('[details] the phone details button shows Not saved on failure and opens the full status, reason and note as plain text', () => {
  const view = render(
    <FeedbackDetails feedback="saved" failureReason={null} change={null} />,
  );
  const trigger = screen.getByRole('button', { name: 'Show status details' });
  expect(trigger).toHaveClass('md:hidden');
  view.rerender(
    <FeedbackDetails
      feedback="failed"
      failureReason="Campaign editing is paused for maintenance. Please try again later."
      change={{ sequence: 3, phases: ['event'] }}
    />,
  );
  const failedTrigger = screen.getByRole('button', {
    name: 'Not saved. Show status details',
  });
  expect(failedTrigger).toHaveTextContent('Not saved');
  fireEvent.click(failedTrigger);
  const dialog = screen.getByRole('dialog', { name: 'Status' });
  expect(dialog).toHaveTextContent(
    'Changes could not be saved. The latest saved values are shown. Campaign editing is paused for maintenance. Please try again later.',
  );
  expect(dialog).toHaveTextContent('Another player changed Event.');
  // Plain text only: the dialog adds no live region or alert of its own.
  expect(dialog.querySelector('[role="status"], [role="alert"]')).toBeNull();
  expect(dialog.querySelector('[data-week-status]')).toBeNull();
});

test('[notice] the confirmed-week notice announces once with the exact history link and can be dismissed', () => {
  const dismiss = vi.fn();
  const view = render(
    <ConfirmedWeekNotice notice={null} campaignId="alpha" dismiss={dismiss} />,
  );
  const notice = document.querySelector('[data-week-confirmed]')!;
  expect(notice).toHaveAttribute('role', 'status');
  expect(notice).toBeEmptyDOMElement();
  view.rerender(
    <ConfirmedWeekNotice
      notice={{ transitionId: 'a:b', week: 4 }}
      campaignId="alpha"
      dismiss={dismiss}
    />,
  );
  expect(notice).toHaveTextContent('Week 4 confirmed.');
  expect(
    screen.getByRole('link', { name: 'Open in Finished weeks' }),
  ).toHaveAttribute('href', '/campaigns/alpha/history?week=4');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test('[notice.no-campaign] without a campaign the notice keeps its text and offers no link', () => {
  render(
    <ConfirmedWeekNotice
      notice={{ transitionId: 'a:b', week: 4 }}
      campaignId={null}
      dismiss={() => undefined}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Week 4 confirmed.');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
