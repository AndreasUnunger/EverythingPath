import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { CharacterSpellsPage } from './character-spells-page';
import {
  characterId,
  findCalculatedWarning,
  type Accepted,
} from './character-sheet-test-fixture';
import {
  buildSpellSheet,
  lastWrite,
  resetSpellsTransport,
  sheetOrigin,
  spells,
  spellsTransport,
  type Recorded,
} from './character-spells-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// One Spell row (#315): the record check, the explicit level of an off-list
// Spell, its own save feedback and warnings, and its phone description.

vi.mock('@convex/_generated/api', async () => {
  const { createCharacterSheetApiMock } =
    await import('./character-sheet-api-test-fixture');
  return createCharacterSheetApiMock();
});
vi.mock('convex/react', async () =>
  (await import('./character-spells-test-fixture')).createSpellsConvexMock(),
);
vi.mock('next/navigation', async () =>
  (
    await import('./character-spells-test-fixture')
  ).createSpellsNavigationMock(),
);
vi.mock('~/components/ui/select', async () =>
  (await import('./character-spells-test-fixture')).createSelectMock(),
);
vi.mock('~/components/use-initial-migration-maintenance', async () => {
  const { spellsTransport } = await import('./character-spells-test-fixture');
  return { useInitialMigrationMaintenance: () => spellsTransport.maintenance };
});
vi.mock(
  '~/components/campaign-shell/navigation-guard',
  async (importOriginal) => ({
    ...(await importOriginal<typeof NavigationGuard>()),
    GuardedLink: (await import('./character-spells-test-fixture'))
      .GuardedLinkMock,
  }),
);

beforeEach(() => resetSpellsTransport('from=%2Fcharacters&add=1'));

function renderPage(snapshot: CharacterSheetSnapshot) {
  spellsTransport.snapshot = snapshot;
  const page = () => (
    <CharacterSpellsPage characterId={characterId} origin={sheetOrigin} />
  );
  const view = render(page());
  return {
    show: (next: CharacterSheetSnapshot) => {
      spellsTransport.snapshot = next;
      view.rerender(page());
    },
  };
}
const check = (name: string) =>
  screen.getByRole('checkbox', { name: `Record ${name}` });
const rowOf = (name: string) => {
  const row = check(name).closest('li');
  if (!row) throw new Error(`Expected a ${name} row`);
  return within(row);
};
const levelField = (name: string) =>
  rowOf(name).getByRole('textbox', { name: `Level of ${name}` });
const saveLevel = (name: string) =>
  fireEvent.click(
    rowOf(name).getByRole('button', { name: `Save level of ${name}` }),
  );
const recordWrites = () =>
  spellsTransport.writes.filter((write) => write.name === 'recordSpell');
const wizard = (recorded: Recorded[] = [], options = {}) =>
  buildSpellSheet({ classes: ['wizard'], recorded, ...options });

test('checking an on-list Spell records it at once; only its own row waits, and a refusal stays on that row for a retry', async () => {
  const { show } = renderPage(wizard());
  fireEvent.click(check('Shield'));
  expect(lastWrite('recordSpell').args).toEqual({
    characterId,
    castingClassId: 'wizard',
    catalogEntryId: 'shield',
    operationId: expect.any(String),
  });
  expect(check('Shield')).toBeDisabled();
  expect(check('Magic missile')).toBeEnabled();

  fireEvent.click(check('Magic missile'));
  await act(async () =>
    lastWrite('recordSpell').reject(new ConvexError('Character is read only')),
  );
  expect(rowOf('Magic missile').getByRole('alert')).toHaveTextContent(
    "Magic missile wasn't saved",
  );
  expect(rowOf('Shield').queryByRole('alert')).toBeNull();
  expect(check('Magic missile')).not.toBeChecked();
  expect(check('Magic missile')).toBeEnabled();
  fireEvent.click(check('Magic missile'));
  expect(recordWrites()).toHaveLength(3);

  await act(async () => recordWrites()[0]?.resolve('row-shield'));
  show(
    wizard([
      { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
    ]),
  );
  expect(check('Shield')).toBeChecked();
  fireEvent.click(check('Shield'));
  expect(lastWrite('removeRecordedSpell').args).toMatchObject({
    entryId: 'row-shield',
  });
});

test('an off-list Spell records only with a valid explicit level: empty and malformed levels say different things and save nothing; a high level saves and earns its warnings', async () => {
  spellsTransport.params.set('other', '1');
  const { show } = renderPage(wizard());
  fireEvent.click(check('Bless'));
  expect(check('Bless')).toBeChecked();
  saveLevel('Bless');
  expect(await rowOf('Bless').findByRole('alert')).toHaveTextContent(
    'Spell level is required',
  );
  expect(levelField('Bless')).toHaveAttribute('aria-invalid', 'true');
  expect(levelField('Bless')).toHaveAccessibleDescription(
    'Spell level is required',
  );
  for (const malformed of ['1.5', '-1', 'two', '99999999999999999999']) {
    fireEvent.change(levelField('Bless'), { target: { value: malformed } });
    saveLevel('Bless');
    expect(await rowOf('Bless').findByRole('alert')).toHaveTextContent(
      'Spell level must be a whole number of 0 or more',
    );
  }
  expect(spellsTransport.writes).toEqual([]);

  fireEvent.change(levelField('Bless'), { target: { value: '7' } });
  saveLevel('Bless');
  await act(async () => undefined);
  expect(lastWrite('recordSpell').args).toMatchObject({
    castingClassId: 'wizard',
    catalogEntryId: 'bless',
    level: 7,
  });
  await act(async () =>
    lastWrite('recordSpell').reject(new ConvexError('Character is read only')),
  );
  expect(rowOf('Bless').getByRole('alert')).toHaveTextContent(
    "Bless wasn't saved",
  );
  expect(levelField('Bless')).toHaveValue('7');
  expect(levelField('Bless')).toHaveFocus();
  expect(check('Bless')).toBeChecked();

  saveLevel('Bless');
  await act(async () => undefined);
  await act(async () => lastWrite('recordSpell').resolve('row-bless'));
  show(
    wizard([
      {
        id: 'row-bless',
        spell: spells.bless,
        castingClassId: 'wizard',
        level: 7,
      },
    ]),
  );
  fireEvent.mouseDown(screen.getByRole('tab', { name: '7th' }));
  const bless = rowOf('Bless');
  expect(bless.getByText('off-list')).toBeVisible();
  expect(bless.getByText('too high')).toHaveAttribute(
    'title',
    'Wizard casts up to 1st level now',
  );
  expect(
    bless.getByText('Bless is not on the Wizard spell list.'),
  ).toBeVisible();
  expect(
    bless.getByText('Wizard cannot cast level 7 spells yet.'),
  ).toBeVisible();
});

test('unchecking an unsaved off-list draft closes its level field without a write', () => {
  spellsTransport.params.set('other', '1');
  renderPage(wizard());
  fireEvent.click(check('Bless'));
  expect(levelField('Bless')).toBeVisible();
  fireEvent.click(check('Bless'));
  expect(rowOf('Bless').queryByRole('textbox')).toBeNull();
  expect(check('Bless')).not.toBeChecked();
  expect(spellsTransport.writes).toEqual([]);
});

test('a Spell its class list lost stays in the Spellbook at its explicit level, off-list and warned; editing the level saves onto the same Spell', async () => {
  const shieldOffList = { ...spells.shield, levels: { sorcerer: 1 } };
  const definitions = Object.values(spells).map((spell) =>
    spell.id === 'shield' ? shieldOffList : spell,
  );
  spellsTransport.params.delete('add');
  renderPage(
    wizard(
      [
        {
          id: 'row-shield',
          spell: shieldOffList,
          castingClassId: 'wizard',
          level: 1,
        },
      ],
      { definitions },
    ),
  );
  const book = within(screen.getByRole('region', { name: 'Spellbook' }));
  expect(book.getByText('off-list')).toBeVisible();
  expect(levelField('Shield')).toHaveValue('1');
  expect(
    book.getByText('Shield is not on the Wizard spell list.'),
  ).toBeVisible();
  fireEvent.change(levelField('Shield'), { target: { value: '0' } });
  saveLevel('Shield');
  await act(async () => undefined);
  expect(lastWrite('recordSpell').args).toMatchObject({
    castingClassId: 'wizard',
    catalogEntryId: 'shield',
    level: 0,
  });
  expect(spellsTransport.writes).toHaveLength(1);
});

test('a count over the allowance warns under its level; Accept and Reopen use the sheet’s warning controls, keep the counts, and a changed count reopens it', async () => {
  spellsTransport.params.delete('add');
  const mageArmor = {
    id: 'mage-armor',
    name: 'Mage armor',
    levels: { sorcerer: 1, wizard: 1 },
    school: 'con',
  };
  const sleep = {
    id: 'sleep',
    name: 'Sleep',
    levels: { sorcerer: 1, wizard: 1 },
    school: 'enc',
  };
  const definitions = [...Object.values(spells), mageArmor, sleep];
  const recordedFor = (list: typeof definitions) =>
    list.map((spell) => ({
      id: `row-${spell.id}`,
      spell,
      castingClassId: 'sorcerer',
    }));
  const three = recordedFor([spells.shield, spells.magicMissile, mageArmor]);
  const four = recordedFor([
    spells.shield,
    spells.magicMissile,
    mageArmor,
    sleep,
  ]);
  const known = (recorded: Recorded[], accepted: Accepted[] = []) =>
    buildSpellSheet({
      classes: ['sorcerer'],
      recorded,
      definitions,
      accepted,
    });
  const acceptance = findCalculatedWarning(known(three), 'spellCount');
  const { show } = renderPage(known(three));
  const first = () => {
    const section = screen
      .getByRole('heading', { name: /^1st-level/ })
      .closest('section');
    if (!section) throw new Error('Expected the 1st-level group');
    return within(section);
  };
  expect(first().getByText('3/2 known')).toBeVisible();
  const warning = '3 level 1 spells known exceeds the allowance of 2.';
  expect(first().getByText(warning)).toBeVisible();
  fireEvent.click(first().getByRole('button', { name: 'Accept' }));
  expect(lastWrite('accept').args).toMatchObject({ check: 'spellCount' });
  await act(async () => lastWrite('accept').resolve(null));

  show(known(three, [acceptance]));
  expect(first().getByText('Accepted')).toBeVisible();
  expect(first().getByRole('button', { name: 'Reopen' })).toBeVisible();
  expect(first().getByText('3/2 known')).toBeVisible();

  show(known(four, [acceptance]));
  expect(
    first().getByText('4 level 1 spells known exceeds the allowance of 2.'),
  ).toBeVisible();
  expect(first().getByRole('button', { name: 'Accept' })).toBeVisible();
  expect(first().getByText('4/2 known')).toBeVisible();
  expect(screen.queryByText(/prepared/i)).toBeNull();
  expect(screen.queryByRole('button', { name: /^Cast/ })).toBeNull();
  expect(screen.queryByRole('spinbutton')).toBeNull();
});

test('a whole-list caster that once recorded keeps those Spells under no Spellcasting, removable, while its list stays read-only', () => {
  spellsTransport.params.delete('add');
  renderPage(
    buildSpellSheet({
      classes: ['cleric'],
      recorded: [
        { id: 'row-bless', spell: spells.bless, castingClassId: 'cleric' },
      ],
    }),
  );
  const list = within(screen.getByRole('region', { name: 'The cleric list' }));
  expect(list.queryByRole('checkbox')).toBeNull();
  const orphans = within(
    screen.getByRole('region', { name: 'Not under any Spellcasting' }),
  );
  expect(orphans.getByText('recorded for Cleric')).toBeVisible();
  expect(
    orphans.getByText('Bless is not under any Spellcasting.'),
  ).toBeVisible();
  fireEvent.click(orphans.getByRole('button', { name: 'Remove Bless' }));
  expect(lastWrite('removeRecordedSpell').args).toMatchObject({
    entryId: 'row-bless',
  });
  expect(list.queryByRole('checkbox')).toBeNull();
});

test('on the phone the name opens and closes the description without touching the record check; wider rows keep the school short with its full name', () => {
  renderPage(wizard());
  const shield = rowOf('Shield');
  const name = shield.getByRole('button', { name: 'Shield' });
  expect(name).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(name);
  expect(name).toHaveAttribute('aria-expanded', 'true');
  const description = document.getElementById(
    name.getAttribute('aria-controls') ?? '',
  );
  expect(description).toHaveTextContent(
    'Abjuration · Invisible disc gives +4 to AC, blocks magic missiles.',
  );
  expect(check('Shield')).not.toBeChecked();
  expect(spellsTransport.writes).toEqual([]);
  fireEvent.click(name);
  expect(name).toHaveAttribute('aria-expanded', 'false');
  expect(name).not.toHaveAttribute('aria-controls');

  expect(
    shield.getAllByText('Abj').every((abbr) => abbr.title === 'Abjuration'),
  ).toBe(true);
  expect(
    rowOf('Magic missile')
      .getAllByText('Evoc')
      .every((abbr) => abbr.title === 'Evocation'),
  ).toBe(true);
  expect(
    shield.getByText('Invisible disc gives +4 to AC, blocks magic missiles.'),
  ).toHaveAttribute(
    'title',
    'Invisible disc gives +4 to AC, blocks magic missiles.',
  );
});

test('maintenance disables recording and removal with one stated reason, while filters and tabs stay usable', () => {
  spellsTransport.maintenance = {
    kind: 'maintenance',
    readOnly: true,
    message: 'Saving is paused for maintenance.',
  };
  renderPage(
    buildSpellSheet({
      classes: ['wizard'],
      recorded: [
        { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
        { id: 'row-bless', spell: spells.bless, castingClassId: 'fighter' },
      ],
    }),
  );
  expect(screen.getAllByText('Saving is paused for maintenance.')).toHaveLength(
    1,
  );
  expect(check('Shield')).toBeDisabled();
  expect(check('Shield')).toHaveAccessibleDescription(
    'Saving is paused for maintenance.',
  );
  expect(check('Magic missile')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove Bless' })).toBeDisabled();
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search the wizard list' }),
    { target: { value: 'fire' } },
  );
  expect(check('Fireball')).toBeDisabled();
  expect(spellsTransport.writes).toEqual([]);
});
