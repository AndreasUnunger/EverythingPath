import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { stableControl } from '../../../tests/stable-control';
import { afterEach, expect, test } from 'vitest';
import type { RawRoll, StagedActionChoice } from '~/lib/weekly-draft-facts';
import { ActivityView } from './activity-view';
import type { ActivityView as Facts } from './types';
import {
  activityFacts,
  activitySlot,
  acceptingEdit,
  selectSlot,
} from './activity-view-fixture';
afterEach(cleanup);
// react-hook-form runs the submit callback asynchronously; a blocked Save is
// only proven after that callback has had its turn.
async function flushSubmit() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
const table = { kind: 'table' as const };
const legacyCheck: RawRoll = {
  dice: [10],
  sides: 20,
  provenance: table,
  modifiers: [],
};
function facts(choice: StagedActionChoice, requirements: string[] = []): Facts {
  return activityFacts([activitySlot(choice, { requirements })]);
}
const drill = (
  rolls: Extract<StagedActionChoice, { actionId: 'drill_militia' }>['rolls'],
): StagedActionChoice => ({
  actionId: 'drill_militia',
  choiceId: 'drill',
  costCopper: 0,
  rolls,
});
function open(action = 'Drill Militia') {
  selectSlot(action);
}
const textbox = (name: string) => screen.getByRole('textbox', { name });
function lastChoice(edit: ReturnType<typeof acceptingEdit>) {
  const call = edit.mock.lastCall![0];
  if (call.kind !== 'detail') throw new Error('Expected detail edit');
  return call.choice;
}

test('[rules.ACT-12.total] Drill training (2d6) shows a recorded total in its one field, writes a replacement against the rule spec and blanks to the existing rolls omission', () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(drill({ check: legacyCheck, training: total(6, 2, 9) }))}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  expect(textbox('Training roll')).toHaveValue('9');
  expect(screen.getByText(/Training · 2d6/)).toBeVisible();
  expect(textbox('Check roll')).toHaveValue('10');
  expect(
    screen.queryByRole('textbox', { name: /die/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(textbox('Training roll'), { target: { value: '11' } });
  expect(lastChoice(edit)).toEqual(
    drill({ check: legacyCheck, training: total(6, 2, 11) }),
  );
  fireEvent.change(textbox('Training roll'), { target: { value: '' } });
  expect(lastChoice(edit)).toEqual(drill({ check: legacyCheck }));
});

test('[rules.ACT-13.legacy-check] a complete legacy check shows its value without a write and a new number preserves its metadata in the total form', () => {
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
  const modifiers = [{ sourceId: 'helpful', value: 2, reason: 'Allies' }];
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(
        drill({ check: { ...legacyCheck, provenance: generated, modifiers } }),
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  expect(textbox('Check roll')).toHaveValue('10');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(textbox('Check roll'), { target: { value: '20' } });
  expect(lastChoice(edit)).toEqual(
    drill({
      check: {
        diceTotal: 20,
        diceCount: 1,
        sides: 20,
        provenance: generated,
        modifiers,
      },
    }),
  );
});

test('[rules.ACT-12.modifiers] adding a custom modifier to a total roll preserves its numeric representation exactly', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(drill({ check: total(20, 1, 0) }))}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  expect(textbox('Check roll')).toHaveValue('0');
  expect(screen.getByText(/usual range for 1d20 is 1–20/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Add modifier' }));
  fireEvent.change(textbox('Value'), { target: { value: '2' } });
  fireEvent.change(textbox('Reason'), {
    target: { value: 'Favourable weather' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add modifier' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const choice = lastChoice(edit);
  if (choice.actionId !== 'drill_militia') throw new Error('Expected Drill');
  expect(choice.rolls?.check).toEqual({
    ...total(20, 1, 0),
    modifiers: [
      {
        sourceId: expect.stringMatching(/^custom:/),
        value: 2,
        reason: 'Favourable weather',
      },
    ],
  });
  expect(choice.rolls?.check).not.toHaveProperty('dice');
});

test('[rules.ACT-12.modifier-only-legacy] a modifier-only edit keeps a legacy array in its legacy form', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(drill({ check: legacyCheck }))}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Add modifier' }));
  fireEvent.change(textbox('Value'), { target: { value: '1' } });
  fireEvent.change(textbox('Reason'), { target: { value: 'Allies' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add modifier' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const choice = lastChoice(edit);
  if (choice.actionId !== 'drill_militia') throw new Error('Expected Drill');
  expect(choice.rolls?.check).toEqual({
    ...legacyCheck,
    modifiers: [
      {
        sourceId: expect.stringMatching(/^custom:/),
        value: 1,
        reason: 'Allies',
      },
    ],
  });
});

test('[rules.ACT-12.wrong-count] a total recorded for another specification stays required, explains the mismatch and is replaced only by a deliberate total', () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(drill({ check: legacyCheck, training: total(6, 1, 4) }), [
        'drill:training:2d6',
      ])}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  expect(textbox('Training roll')).toHaveValue('');
  expect(
    screen.getByText(
      /Recorded total 4 was entered for 1d6, but this step needs 2d6/,
    ),
  ).toBeVisible();
  expect(screen.getByText(/Training · 2d6/)).toBeVisible();
  fireEvent.change(textbox('Training roll'), { target: { value: '8' } });
  expect(lastChoice(edit)).toEqual(
    drill({ check: legacyCheck, training: total(6, 2, 8) }),
  );
});

test('[rules.ACT-12.partial] a partial legacy training array keeps its recorded die, an empty required total, and an explicit clear', () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(
        drill({
          check: legacyCheck,
          training: { ...legacyCheck, dice: [5], sides: 6 },
        }),
        ['drill:training:2d6'],
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  expect(textbox('Training roll')).toHaveValue('');
  expect(
    screen.getByText(/Recorded dice 5 are incomplete for 2d6/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Clear training roll' }));
  expect(lastChoice(edit)).toEqual(drill({ check: legacyCheck }));
});

test('[rules.ACT-12.specs] Special Order delivery is 2d6, Reduce Danger notoriety is 1d4, and roll-less actions render no roll field', () => {
  const edit = acceptingEdit();
  const { rerender } = render(
    <ActivityView
      view={facts(
        {
          actionId: 'special_order',
          choiceId: 'order',
          itemId: 'item',
          settlementId: 'town',
        } as StagedActionChoice,
        ['order:delivery:2d6'],
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open('Special Order');
  expect(screen.getByText(/Delivery · 2d6/)).toBeVisible();
  fireEvent.change(textbox('Delivery roll'), { target: { value: '7' } });
  expect(lastChoice(edit)).toMatchObject({
    actionId: 'special_order',
    rolls: { delivery: total(6, 2, 7) },
  });
  rerender(
    <ActivityView
      view={facts({
        actionId: 'reduce_danger',
        choiceId: 'danger',
        settlementId: 'town',
        rolls: { notoriety: total(4, 1, 3) },
      } as StagedActionChoice)}
      edit={edit}
      disabled={false}
    />,
  );
  open('Reduce Danger');
  expect(screen.getByText(/Notoriety · 1d4/)).toBeVisible();
  expect(textbox('Notoriety roll')).toHaveValue('3');
  rerender(
    <ActivityView
      view={facts({
        actionId: 'lie_low',
        choiceId: 'low',
      } as StagedActionChoice)}
      edit={edit}
      disabled={false}
    />,
  );
  open('Lie Low');
  expect(
    screen.queryByRole('textbox', { name: /roll/ }),
  ).not.toBeInTheDocument();
});

const candidateChoice = (
  candidates: Extract<
    StagedActionChoice,
    { actionId: 'guarantee_event' }
  >['candidates'],
): StagedActionChoice =>
  ({
    choiceId: 'guarantee',
    actionId: 'guarantee_event',
    teamId: 'team',
    candidates,
  }) as StagedActionChoice;
function candidateEntries() {
  return within(screen.getByRole('group', { name: 'Candidates' })).getAllByRole(
    'group',
    { name: /^Entry \d$/ },
  );
}

test('[rules.EVT-07.candidate-context] a saved candidate with a known table roll keeps its nested total editors in the Activity editor, while an unresolved one offers only its table roll', () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(
        candidateChoice([
          {
            eventId: 'theft-candidate',
            origin: { kind: 'rolled' },
            tableRoll: total(100, 1, 76),
          },
          { eventId: 'pending-candidate', origin: { kind: 'rolled' } },
        ]),
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open('Guarantee Event');
  const [theft, pending] = candidateEntries();
  fireEvent.click(within(theft!).getByRole('button', { name: 'Add rolls' }));
  expect(
    within(theft!).getByRole('textbox', { name: 'Check roll' }),
  ).toBeVisible();
  expect(
    within(theft!).getByText('1d20 · total of the dice only'),
  ).toBeVisible();
  expect(
    within(pending!).getByRole('textbox', { name: 'Table Roll' }),
  ).toBeVisible();
  fireEvent.click(within(pending!).getByRole('button', { name: 'Add rolls' }));
  expect(
    within(pending!).queryByRole('textbox', { name: 'Check roll' }),
  ).not.toBeInTheDocument();
});

test('[rules.EVT-07.candidate-live-context] an unsaved table roll change re-resolves the candidate’s nested specifications immediately, and an explicit eventType never overrides the table', () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(
        candidateChoice([
          {
            eventId: 'declared',
            origin: { kind: 'rolled' },
            // Declared Turncoat, but the table roll says Theft: the table wins.
            eventType: 'turncoat',
            tableRoll: total(100, 1, 76),
          },
        ]),
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open('Guarantee Event');
  const [entry] = candidateEntries();
  fireEvent.click(within(entry!).getByRole('button', { name: 'Add rolls' }));
  expect(
    within(entry!).getByRole('textbox', { name: 'Check roll' }),
  ).toBeVisible();
  expect(
    within(entry!).queryByRole('group', { name: 'Loss' }),
  ).not.toBeInTheDocument();
  // Typing a Turncoat table roll (60) locally, before any Save, switches the
  // supported nested fields: no check, a 1d6 loss.
  fireEvent.change(
    within(entry!).getByRole('textbox', { name: 'Table Roll' }),
    {
      target: { value: '60' },
    },
  );
  expect(edit).not.toHaveBeenCalled();
  expect(
    within(entry!).queryByRole('textbox', { name: 'Check roll' }),
  ).not.toBeInTheDocument();
  expect(
    within(entry!).getByText('1d6 · total of the dice only'),
  ).toBeVisible();
  // A wrong-specification table roll leaves the candidate unresolved again.
  fireEvent.change(
    within(entry!).getByRole('textbox', { name: 'Table Roll' }),
    {
      target: { value: '' },
    },
  );
  expect(
    within(entry!).queryByRole('group', { name: 'Loss' }),
  ).not.toBeInTheDocument();
});

test('[rules.EVT-07.candidate-removal] removing the first candidate keeps the survivor’s own table-roll context, not the removed entry’s', () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(
        candidateChoice([
          {
            eventId: 'turncoat-candidate',
            origin: { kind: 'rolled' },
            tableRoll: total(100, 1, 60),
          },
          {
            eventId: 'theft-candidate',
            origin: { kind: 'rolled' },
            tableRoll: total(100, 1, 76),
            rolls: { check: total(20, 1, 9) },
          },
        ]),
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open('Guarantee Event');
  fireEvent.click(screen.getByRole('button', { name: 'Remove candidates 1' }));
  const [survivor] = candidateEntries();
  expect(
    within(survivor!).getByRole('textbox', { name: 'Table Roll' }),
  ).toHaveValue('76');
  expect(
    within(survivor!).getByRole('textbox', { name: 'Check roll' }),
  ).toHaveValue('9');
  expect(
    within(survivor!).queryByRole('group', { name: 'Loss' }),
  ).not.toBeInTheDocument();
});

test('[rules.EVT-11.invalid-spec-lost] malformed text in a candidate check no longer blocks Save once the table roll changes to an event without that check, while another still-editable malformed field keeps blocking', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(
        candidateChoice([
          {
            eventId: 'first',
            origin: { kind: 'rolled' },
            tableRoll: total(100, 1, 76),
          },
          {
            eventId: 'second',
            origin: { kind: 'rolled' },
            tableRoll: total(100, 1, 76),
          },
        ]),
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open('Guarantee Event');
  const [first, second] = candidateEntries();
  const save = stableControl('button', 'Save candidates');
  fireEvent.click(within(first!).getByRole('button', { name: 'Add rolls' }));
  fireEvent.change(
    within(first!).getByRole('textbox', { name: 'Check roll' }),
    {
      target: { value: 'x' },
    },
  );
  fireEvent.click(within(second!).getByRole('button', { name: 'Add rolls' }));
  fireEvent.change(
    within(second!).getByRole('textbox', { name: 'Check roll' }),
    {
      target: { value: '7z' },
    },
  );
  fireEvent.click(save());
  await flushSubmit();
  expect(edit).not.toHaveBeenCalled();
  // The first candidate becomes Turncoat: its check control disappears and so
  // must its malformed-text block. The second candidate still blocks.
  fireEvent.change(
    within(first!).getByRole('textbox', { name: 'Table Roll' }),
    {
      target: { value: '60' },
    },
  );
  expect(
    within(first!).queryByRole('textbox', { name: 'Check roll' }),
  ).not.toBeInTheDocument();
  fireEvent.click(save());
  await flushSubmit();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(
    within(second!).getByRole('textbox', { name: 'Check roll' }),
    {
      target: { value: '7' },
    },
  );
  fireEvent.click(save());
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const choice = lastChoice(edit);
  if (choice.actionId !== 'guarantee_event')
    throw new Error('Expected guarantee');
  expect(choice.candidates?.[0]).toEqual({
    eventId: 'first',
    origin: { kind: 'rolled' },
    tableRoll: total(100, 1, 60),
    rolls: {},
  });
  expect(choice.candidates?.[1]?.rolls).toEqual({ check: total(20, 1, 7) });
});

test('[rules.EVT-11.invalid-spec-cleared] clearing the table roll of a candidate with a malformed check leaves the check unresolved and releases its block', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(
        candidateChoice([
          {
            eventId: 'only',
            origin: { kind: 'rolled' },
            tableRoll: total(100, 1, 76),
          },
        ]),
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open('Guarantee Event');
  const [entry] = candidateEntries();
  fireEvent.click(within(entry!).getByRole('button', { name: 'Add rolls' }));
  fireEvent.change(
    within(entry!).getByRole('textbox', { name: 'Check roll' }),
    {
      target: { value: '-' },
    },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save candidates' }));
  await flushSubmit();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(
    within(entry!).getByRole('textbox', { name: 'Table Roll' }),
    {
      target: { value: '' },
    },
  );
  // Structural Save succeeds; the missing table roll is a readiness matter
  // for the rules, not a structural blocker.
  fireEvent.click(screen.getByRole('button', { name: 'Save candidates' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const choice = lastChoice(edit);
  if (choice.actionId !== 'guarantee_event')
    throw new Error('Expected guarantee');
  expect(choice.candidates?.[0]).toEqual({
    eventId: 'only',
    origin: { kind: 'rolled' },
    rolls: {},
  });
});
