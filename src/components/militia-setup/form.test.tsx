import {
  cleanup,
  fireEvent,
  isInaccessible,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { MilitiaCorrectionForm } from './form';
import { militiaSetupSchema, newMilitiaSetup } from '~/lib/canonical-setup';
import { militiaSnapshotSchema } from '~/lib/canonical-weekly-source';
import {
  mixedKindRecords,
  mixedKindSnapshot,
} from '../../../tests/rules/character-kind-fixture';
afterEach(cleanup);
// The ledger's current state, as the Militia page opens a correction.
const existing = () => ({
  ...newMilitiaSetup('Loyalty'),
  mode: 'existing' as const,
});
test('a ledger correction requires a field-level reason before saving', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <MilitiaCorrectionForm
      characters={[]}
      onSave={save}
      initialValues={existing()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
  expect(
    await screen.findByText('Reason for correction is required.'),
  ).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Reason for correction' }),
    { target: { value: 'Recorded table reward' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
});
test('a correction explains how it affects choices already staged for the week without blocking the save', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const notice = vi.fn(() => 'Upkeep (1 choice) needs review.');
  render(
    <MilitiaCorrectionForm
      characters={[]}
      onSave={save}
      initialValues={existing()}
      stagedChoiceNotice={notice}
    />,
  );
  const aside = screen.getByRole('complementary', {
    name: 'Staged choices this week',
  });
  expect(within(aside).getByRole('note')).toHaveTextContent(
    'Upkeep (1 choice) needs review.',
  );
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Reason for correction' }),
    { target: { value: 'Team disbanded' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
});

test('a correction keeps the section captions guided Setup drops', () => {
  render(
    <MilitiaCorrectionForm
      characters={[]}
      onSave={vi.fn()}
      initialValues={existing()}
    />,
  );
  for (const caption of [
    'Choose people from the campaign ledger. Record Hit Dice separately from level.',
    'Record the location and condition of characters the militia can hide, rescue or restore.',
    'Record the agreed delivery date, including expedition or enchantment time. Receipt is a separate decision.',
    'Market Day gives a 5% discount in the selected settlements for its recorded duration.',
  ]) {
    expect(screen.getByText(caption)).toBeVisible();
  }
});

// What `getByRole(role, { name })` asserts about a control found another way.
function exposed(element: HTMLElement, role: string, name: string) {
  expect(element).toHaveRole(role);
  expect(isInaccessible(element)).toBe(false);
  expect(element).toHaveAccessibleName(name);
  return element;
}
test('a correction keeps mixed legacy and new character kinds and Hit Dice unchanged', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const setup = newMilitiaSetup('Loyalty');
  const snapshot = militiaSnapshotSchema.parse(mixedKindSnapshot());
  const initialValues = militiaSetupSchema.parse({
    ...setup,
    mode: 'existing',
    state: {
      ...setup.state,
      week: 4,
      context: { ...setup.state.context, firstMilitiaWeek: false },
      militiaSnapshot: snapshot,
    },
  });
  const { container } = render(
    <MilitiaCorrectionForm
      initialValues={initialValues}
      characters={snapshot.characters.map((facts) => ({
        ...facts,
        name: mixedKindRecords.find(
          (record) => record.characterId === facts.characterId,
        )!.name,
      }))}
      onSave={save}
    />,
  );
  // The full form holds hundreds of buttons and inputs, and a screen-wide
  // role query computes the accessible name of each. Query the kind groups
  // inside their section, and find the heading, reason and Save by their
  // name and text, asserting what a role query would.
  const people = within(
    exposed(
      screen.getByText('Characters and officers', { selector: 'h2' }),
      'heading',
      'Characters and officers',
    ).closest('section')!,
  );
  const groups = people.getAllByRole('group', { name: 'Character kind' });
  const pressed = groups.map((group) =>
    within(group)
      .getAllByRole('button')
      .map(
        (button) =>
          `${button.textContent}${button.getAttribute('aria-pressed') === 'true' ? '*' : ''}`,
      ),
  );
  expect(pressed).toEqual([
    ['pc*', 'officer npc', 'other npc'],
    ['pc*', 'officer npc', 'other npc'],
    ['pc', 'officer npc*', 'other npc'],
    ['pc', 'officer npc', 'other npc*'],
    ['pc', 'officer npc', 'other npc', 'npc*'],
  ]);
  const vessa = within(groups[4]!);
  fireEvent.click(vessa.getByRole('button', { name: 'pc' }));
  fireEvent.click(vessa.getByRole('button', { name: 'npc' }));
  expect(vessa.getByRole('button', { name: 'npc' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.change(
    exposed(
      container.querySelector<HTMLElement>('[name="notes"]')!,
      'textbox',
      'Reason for correction',
    ),
    { target: { value: 'Recorded table reward' } },
  );
  fireEvent.click(
    exposed(
      screen.getByText('Save correction').closest('button')!,
      'button',
      'Save correction',
    ),
  );
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]![0].state.militiaSnapshot.roster).toEqual(
    snapshot.roster,
  );
});
