import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { overseerSupportHolders } from '~/lib/overseer-support';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { threatEventFixture } from '../../../tests/rules/threat-event-fixture';
import { childEvent } from '../../../tests/rules/candidate-reroll-fixture';
import { eventActionFixture } from '../../../tests/rules/event-action-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { eventView } from './event-facts';
import { EventView } from './event-view';
import { overseerToggle } from './overseer-support-facts';
import { persistentView } from './persistent-facts';
import { PersistentView } from './persistent-view';

afterEach(cleanup);

// Sickness twice (Event 1.2 has the mandatory Loyalty save) and a carried
// Theft with a Loyalty mitigation decision. The Overseer's Constitution 16
// adds +3 to Loyalty checks; support starts on the carried Theft.
function week() {
  const { draft, snapshot } = threatEventFixture(90, true);
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  snapshot.characters[0]!.constitution = 16;
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'carried',
        eventType: 'theft',
        startedWeek: draft.week - 1,
        order: 0,
        targets: [],
      },
    ],
  };
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'carried',
      overseerCharacterId: 'pc',
      rolls: { check: roll(20, 12) },
    },
  ];
  return { draft, snapshot };
}

function source(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  return workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Wren Ashby' }],
  });
}
const preview = (draft: WeeklyDraft, snapshot: UpkeepSnapshot) =>
  projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot });

// A small stand-in for the Workspace store: accepted edits apply to the
// draft and re-render; `refuse` rejects chosen edits.
function workspace(
  initial: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  refuse: (edit: WeeklyDraftEdit) => boolean = () => false,
) {
  let draft = initial;
  const listeners = new Set<() => void>();
  const sent: WeeklyDraftEdit[] = [];
  const edit = vi.fn(async (next: WeeklyDraftEdit) => {
    sent.push(next);
    if (refuse(next)) return 'failed' as const;
    const result = editWeeklyDraft(draft, next);
    if (!result.ok) return 'failed' as const;
    draft = result.draft;
    act(() => listeners.forEach((listener) => listener()));
    return 'accepted' as const;
  });
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const events = () =>
    eventView(draft, source(draft, snapshot), preview(draft, snapshot));
  const carried = () =>
    persistentView(draft, source(draft, snapshot), preview(draft, snapshot));
  function Event({ disabled = false }: { disabled?: boolean }) {
    useSyncExternalStore(subscribe, () => draft);
    return (
      <EventView
        view={events()}
        edit={edit}
        disabled={disabled}
        latestOverseer={() => events().overseer}
      />
    );
  }
  function Persistent() {
    useSyncExternalStore(subscribe, () => draft);
    return (
      <PersistentView
        view={carried()}
        edit={edit}
        disabled={false}
        latestOverseer={() => carried().overseer}
      />
    );
  }
  return { Event, Persistent, edit, sent, draft: () => draft };
}

const holders = (draft: WeeklyDraft) =>
  overseerSupportHolders({
    occurrences: draft.event.occurrences,
    decisions: draft.persistent.decisions,
  }).map((holder) => holder.eventId);

test('[EVT-10.overseer-toggle] the check row offers the approved support toggle and names where support is now', () => {
  const { draft, snapshot } = week();
  const store = workspace(draft, snapshot);
  render(<store.Event />);
  const block = screen.getByRole('group', { name: 'Event 1.2' });
  const toggle = within(block).getByRole('switch');
  expect(toggle).toHaveAccessibleName(
    'Use Overseer support · +3 · one event a week for Loyalty check',
  );
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(toggle).toHaveAccessibleDescription(
    'Now on Theft (week 39). Tapping moves it here.',
  );
  // Approved copy: the contribution, never the holder's name or ability.
  expect(
    within(block).getByRole('group', { name: 'Loyalty check' }),
  ).not.toHaveTextContent(/Wren|Constitution|Charisma/);
});

test('[EVT-10.overseer-move-view] tapping the toggle moves support from Persistent to this event, and tapping again turns it off', async () => {
  const { draft, snapshot } = week();
  const store = workspace(draft, snapshot);
  render(<store.Event />);
  const block = () => screen.getByRole('group', { name: 'Event 1.2' });
  fireEvent.click(within(block()).getByRole('switch'));
  await waitFor(() => expect(store.sent).toHaveLength(2));
  // Cleared from the carried Theft first, keeping its roll, then recorded here.
  expect(store.sent[0]).toEqual({
    kind: 'persistent_decision',
    decision: {
      kind: 'mitigate',
      eventId: 'carried',
      rolls: { check: roll(20, 12) },
    },
  });
  expect(store.sent[1]).toMatchObject({
    kind: 'event_occurrence',
    occurrence: { eventId: 'second', overseerCharacterId: 'pc' },
  });
  expect(holders(store.draft())).toEqual(['second']);
  await waitFor(() =>
    expect(within(block()).getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'true',
    ),
  );
  // The breakdown names the source, and the rules apply it once.
  expect(block()).toHaveTextContent('Overseer +3');
  const phases = preview(store.draft(), snapshot).phases!;
  expect(
    [...phases.event.checks, ...phases.persistent.checks]
      .filter(
        (check, index, all) =>
          all.findIndex((entry) => entry.checkId === check.checkId) === index,
      )
      .filter((check) =>
        check.modifiers.some((entry) => entry.source === 'overseer-support'),
      )
      .map((check) => check.checkId),
  ).toEqual(['second:sickness']);
  // Tapping again turns it off.
  fireEvent.click(within(block()).getByRole('switch'));
  await waitFor(() => expect(holders(store.draft())).toEqual([]));
});

test('[EVT-10.overseer-partial-view] a move stopped between edits says where support is now and retries to finish', async () => {
  const { draft, snapshot } = week();
  let refuseAssign = true;
  const store = workspace(
    draft,
    snapshot,
    (edit) => refuseAssign && edit.kind === 'event_occurrence',
  );
  render(<store.Event />);
  fireEvent.click(
    screen.getByRole('switch', {
      name: /for Loyalty check$/,
    }),
  );
  expect(
    await screen.findByText(
      'Overseer support was removed elsewhere but could not be added to Event 1.2 · Sickness. It is on no event now.',
    ),
  ).toBeVisible();
  expect(holders(store.draft())).toEqual([]);
  refuseAssign = false;
  fireEvent.click(
    screen.getByRole('button', { name: 'Try again: move Overseer support' }),
  );
  await waitFor(() => expect(holders(store.draft())).toEqual(['second']));
  await waitFor(() =>
    expect(
      screen.queryByText(/could not be added to Event 1.2/),
    ).not.toBeInTheDocument(),
  );
});

test('[EVT-10.overseer-legacy] a legacy target-level selection reads as this event’s support and moves as one', async () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'carried', rolls: { check: roll(20, 12) } },
  ];
  const second = draft.event.occurrences.find(
    (event) => event.eventId === 'second',
  )!;
  second.targetChecks = [
    { target: { kind: 'team', teamId: 'team' }, overseerCharacterId: 'pc' },
  ];
  const store = workspace(draft, snapshot);
  render(<store.Persistent />);
  const theft = screen.getByRole('group', { name: 'Theft · Event 1' });
  const toggle = within(theft).getByRole('switch', {
    name: /for Theft · Event 1 Loyalty check$/,
  });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(theft).toHaveTextContent(
    'Now on Event 1.2 · Sickness. Tapping moves it here.',
  );
  fireEvent.click(toggle);
  await waitFor(() => expect(holders(store.draft())).toEqual(['carried']));
  // The legacy entry named only its target and support, so it is gone; the
  // event's own inputs stay.
  const moved = store
    .draft()
    .event.occurrences.find((event) => event.eventId === 'second')!;
  expect(moved.targetChecks).toBeUndefined();
  expect(moved.targets).toEqual(second.targets);
  expect(moved.rolls).toEqual(second.rolls);
  expect(store.draft().persistent.decisions).toEqual([
    {
      kind: 'mitigate',
      eventId: 'carried',
      rolls: { check: roll(20, 12) },
      overseerCharacterId: 'pc',
    },
  ]);
});

test('[PER-04.overseer-form] the Theft form no longer offers an Overseer field, and saving it keeps the recorded support', async () => {
  const { draft, snapshot } = week();
  const store = workspace(draft, snapshot);
  render(<store.Persistent />);
  const theft = screen.getByRole('group', { name: 'Theft · Event 1' });
  expect(
    within(theft).queryByRole('combobox', { name: /overseer/i }),
  ).not.toBeInTheDocument();
  expect(within(theft).getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  fireEvent.click(
    within(theft).getByRole('button', { name: 'Save persistent decision' }),
  );
  await waitFor(() => expect(store.sent).toHaveLength(1));
  expect(store.sent[0]).toEqual({
    kind: 'persistent_decision',
    decision: {
      kind: 'mitigate',
      eventId: 'carried',
      rolls: { check: roll(20, 12) },
      overseerCharacterId: 'pc',
    },
  });
});

test('[EVT-10.overseer-unavailable] without a filled Overseer role there is no toggle; a recorded selection stays removable', async () => {
  const { draft, snapshot } = week();
  snapshot.roster.officers = [];
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'carried', rolls: { check: roll(20, 12) } },
  ];
  const store = workspace(draft, snapshot);
  const { unmount } = render(<store.Event />);
  const block = screen.getByRole('group', { name: 'Event 1.2' });
  expect(within(block).queryByRole('switch')).not.toBeInTheDocument();
  expect(block).toHaveTextContent(
    'No Overseer is assigned, so no Overseer support this week.',
  );
  unmount();

  draft.event.occurrences.find(
    (event) => event.eventId === 'second',
  )!.overseerCharacterId = 'pc';
  const recorded = workspace(draft, snapshot);
  render(<recorded.Event />);
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Remove Overseer support from Loyalty check',
    }),
  );
  await waitFor(() => expect(holders(recorded.draft())).toEqual([]));
});

test('[WEEK-10.overseer-locked] Confirmation disables the support toggle', () => {
  const { draft, snapshot } = week();
  const store = workspace(draft, snapshot);
  render(<store.Event disabled />);
  expect(
    screen.getByRole('switch', {
      name: /for Loyalty check$/,
    }),
  ).toBeDisabled();
});

test('[EVT-13.overseer-unused] an event the rules do not use this week offers no support switch; support recorded there only offers Remove', () => {
  const { draft, snapshot, choice } = eventActionFixture('guarantee_event');
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  // An earlier Roll Twice expansion of the chosen Raid, now unused, still
  // holds support from before the candidate reroll Ruleset Version.
  const legacy = childEvent('raid/twice/1', 74, 'roll_twice', 'raid');
  legacy.overseerCharacterId = 'pc';
  choice.candidates!.push(legacy);
  const { overseer } = eventView(
    draft,
    source(draft, snapshot),
    preview(draft, snapshot),
  );
  expect([...overseer!.unused].sort()).toEqual(['raid/twice/1', 'theft']);
  expect(overseerToggle(overseer!, 'raid/twice/1', 'loyalty')).toEqual({
    kind: 'unavailable',
    reason: 'unused',
    recorded: true,
  });
  expect(overseerToggle(overseer!, 'theft', 'loyalty')).toEqual({
    kind: 'unavailable',
    reason: 'unused',
    recorded: false,
  });
  expect(overseerToggle(overseer!, 'raid', 'loyalty')).toMatchObject({
    kind: 'available',
    on: false,
    elsewhere: [overseer!.labels['raid/twice/1']],
  });
});
