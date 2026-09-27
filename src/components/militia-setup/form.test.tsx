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
import { normalizeCharacterKind } from '~/lib/character-kind';
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
    'Choose people from the campaign ledger. Leave Hit Dice blank to use the character’s level.',
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
test('a correction shows each record’s PC or NPC kind read-only and keeps roster membership and Hit Dice', async () => {
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
      characters={snapshot.characters.map((facts) => {
        const record = mixedKindRecords.find(
          (entry) => entry.characterId === facts.characterId,
        )!;
        return {
          ...facts,
          name: record.name,
          kind: normalizeCharacterKind(record.kind),
        };
      })}
      onSave={save}
    />,
  );
  // The full form holds hundreds of buttons and inputs, and a screen-wide
  // role query computes the accessible name of each. Query the kinds inside
  // their section, and find the heading, reason and Save by their name and
  // text, asserting what a role query would.
  const people = within(
    exposed(
      screen.getByText('Characters and officers', { selector: 'h2' }),
      'heading',
      'Characters and officers',
    ).closest('section')!,
  );
  // The record owns the kind: Rook's stale other_npc mirror reads as the
  // record's PC default, and no kind can be chosen here.
  expect(
    people
      .getAllByRole('group', { name: 'Kind' })
      .map((group) => group.textContent),
  ).toEqual(['KindPC', 'KindPC', 'KindNPC', 'KindPC', 'KindNPC']);
  expect(people.queryByRole('group', { name: 'Character kind' })).toBeNull();
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
  // Membership, order, Hit Dice and assignments are untouched; the write
  // boundary mirrors kinds from the records.
  expect(save.mock.calls[0]![0].state.militiaSnapshot.roster).toEqual(
    snapshot.roster,
  );
});
