import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { acceptedCampaignSetup } from '../../../tests/rules/accepted-campaign';
import {
  mixedKindRecords,
  mixedKindSnapshot,
} from '../../../tests/rules/character-kind-fixture';
import { militiaSetupSchema, newMilitiaSetup } from '~/lib/canonical-setup';
import {
  militiaSnapshotSchema,
  type CanonicalWeekState,
} from '~/lib/canonical-weekly-source';
import type { MilitiaEntryKey } from '~/lib/militia-correction-sections';
import { MilitiaSection } from '~/components/campaign-sections/militia-section';
import { stableControl } from '../../../tests/stable-control';

// The People & officers fallback (#178): the roster and officer roles, kept
// until Characters & officers replaces them. It is the only correction left
// of the retired full editor, keeps its revision-bound whole-snapshot save
// and runs exclusively with section corrections.

type Call = {
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let queries: Record<string, unknown> = {};
type CharacterRecord = { _id: string; name: string; charisma: number };
let records: CharacterRecord[] = [];

vi.mock('@convex/_generated/api', () => ({
  api: {
    canonicalDraftPersistence: { workspace: 'workspace', observe: 'observe' },
    canonicalLedger: { read: 'read', save: 'save' },
  },
}));
vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) =>
    args === 'skip' ? undefined : queries[name],
  useMutation: () => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      calls.push({ args, resolve, reject });
    }),
}));
vi.mock('~/lib/sharedQueries', () => ({
  characterLedgerQuery: () => ({
    data: records.map((record) => ({
      level: 12,
      strength: 10,
      dexterity: 11,
      constitution: 12,
      intelligence: 13,
      wisdom: 14,
      ...record,
    })),
  }),
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({
    href,
    children,
    ...props
  }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

type Snapshot = CanonicalWeekState['militiaSnapshot'];
const campaignId = 'campaign' as Id<'campaign'>;
const state = (): CanonicalWeekState =>
  structuredClone(acceptedCampaignSetup('officer').state);
function setMilitia(revision: number, week: CanonicalWeekState) {
  queries = {
    workspace: {
      key: { campaignId, militiaId: 'militia', draftId: 'draft-9' },
      week: week.week,
    },
    read: { revision, state: week },
    observe: undefined,
  };
}
const page = (initialEntry?: MilitiaEntryKey) => (
  <MilitiaSection
    campaignId={campaignId}
    organizationId="org"
    initialEntry={initialEntry}
  />
);
const index = () =>
  screen.getByRole('navigation', { name: 'Militia sections' });
const entry = (name: RegExp) => within(index()).getByRole('button', { name });
async function press(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}
function openPeople() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Correct people & officers' }),
  );
  const editor = within(
    screen
      .getByRole('heading', { name: 'Correct people & officers' })
      .closest<HTMLElement>('section')!,
  );
  return {
    editor,
    reason: stableControl('textbox', 'Reason for correction', editor),
    save: stableControl('button', 'Save correction', editor),
  };
}
const sent = (at = 0) => calls[at]!.args.snapshot as Snapshot;
// Ada's officer role buttons, inside her roster entry.
const role = (
  editor: Pick<typeof screen, 'getByRole'>,
  name: string,
  person = 'Ada',
) =>
  within(editor.getByRole('group', { name: person })).getByRole('button', {
    name,
  });

beforeEach(() => {
  calls = [];
  records = [{ _id: 'officer', name: 'Ada', charisma: 15 }];
  setMilitia(3, state());
});
afterEach(cleanup);

describe('People & officers fallback', () => {
  test('an address can select it; it holds only the roster and officers, without captions', () => {
    render(page('people'));
    expect(entry(/^People & officers/)).toHaveAttribute('aria-current', 'true');
    const { editor } = openPeople();
    expect(
      editor.getAllByRole('heading').map((heading) => heading.textContent),
    ).toEqual(['Correct people & officers', 'Characters and officers']);
    expect(
      screen.queryByText(/Choose people from the campaign ledger/),
    ).toBeNull();
    expect(
      editor.queryByRole('textbox', { name: 'Treasury (copper)' }),
    ).toBeNull();
    expect(
      within(editor.getByRole('group', { name: 'Ada' })).getByRole('textbox', {
        name: 'Hit Dice',
      }),
    ).toBeVisible();
  });

  test('is exclusive with section editing, and Cancel writes nothing', () => {
    render(page('people'));
    const { editor } = openPeople();
    for (const button of within(index()).getAllByRole('button'))
      if (!(button.textContent ?? '').startsWith('People & officers'))
        expect(button).toBeDisabled();
    fireEvent.click(editor.getByRole('button', { name: 'Cancel' }));
    expect(calls).toHaveLength(0);
    expect(entry(/^Values/)).toBeEnabled();
    fireEvent.click(entry(/^Values/));
    fireEvent.click(screen.getByRole('button', { name: 'Correct values' }));
    expect(entry(/^People & officers/)).toBeDisabled();
  });

  test('assigning a role needs a reason and sends the whole snapshot at the revision it opened from', async () => {
    const view = render(page('people'));
    const { editor, reason, save } = openPeople();
    fireEvent.click(role(editor, 'marshal'));
    await press(save());
    expect(calls).toHaveLength(0);
    expect(reason()).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getAllByText('Reason for correction is required.').length,
    ).toBeGreaterThan(0);
    fireEvent.change(reason(), { target: { value: 'Ada leads the drills' } });
    // Another player corrected Values meanwhile: the fallback is not merged
    // onto it, so the server refuses the stale snapshot.
    const latest = state();
    latest.militiaSnapshot.notoriety = 30;
    setMilitia(4, latest);
    view.rerender(page('people'));
    const button = save();
    await press(button);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toMatchObject({
      expectedRevision: 3,
      reason: 'Ada leads the drills',
    });
    const opened = state().militiaSnapshot;
    expect(sent()).toEqual({
      ...opened,
      roster: {
        ...opened.roster,
        officers: [
          ...opened.roster.officers,
          { role: 'marshal', characterId: 'officer' },
        ],
      },
    });
    expect(button).toHaveAccessibleName('Saving correction…');
    expect(button).toBeDisabled();
    await press(button);
    expect(calls).toHaveLength(1);
    await act(async () =>
      calls[0]!.reject(
        new ConvexError(
          'Militia changed. Review the latest ledger before saving.',
        ),
      ),
    );
    expect(screen.getByText(/The correction wasn't saved/)).toBeVisible();
    expect(role(editor, 'marshal')).toHaveAttribute('aria-pressed', 'true');
    expect(reason()).toHaveValue('Ada leads the drills');
  });

  test('a saved role closes the correction with feedback', async () => {
    const view = render(page('people'));
    const { editor, reason, save } = openPeople();
    fireEvent.click(role(editor, 'marshal'));
    fireEvent.change(reason(), { target: { value: 'Ada leads the drills' } });
    await press(save());
    const saved = state();
    saved.militiaSnapshot = sent();
    await act(async () => calls[0]!.resolve(4));
    setMilitia(4, saved);
    view.rerender(page('people'));
    expect(screen.queryByLabelText('Reason for correction')).toBeNull();
    expect(
      screen.getAllByText('People & officers corrected.').length,
    ).toBeGreaterThan(0);
  });

  test('mixed legacy and new character kinds and Hit Dice stay unchanged', async () => {
    records = mixedKindRecords.map((record) => ({
      _id: record.characterId,
      name: record.name,
      charisma: record.charisma,
    }));
    const setup = newMilitiaSetup('Loyalty');
    const snapshot = militiaSnapshotSchema.parse(mixedKindSnapshot());
    const { state: mixed } = militiaSetupSchema.parse({
      ...setup,
      mode: 'existing',
      state: {
        ...setup.state,
        week: 4,
        context: { ...setup.state.context, firstMilitiaWeek: false },
        militiaSnapshot: snapshot,
      },
    });
    setMilitia(3, mixed);
    render(page('people'));
    const { editor, reason, save } = openPeople();
    const pressed = editor
      .getAllByRole('group', { name: 'Character kind' })
      .map((group) =>
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
    const vessa = within(editor.getByRole('group', { name: 'Vessa' }));
    fireEvent.click(vessa.getByRole('button', { name: 'pc' }));
    fireEvent.click(vessa.getByRole('button', { name: 'npc' }));
    expect(vessa.getByRole('button', { name: 'npc' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(role(editor, 'spymaster', 'Aubrin'));
    fireEvent.change(reason(), { target: { value: 'Aubrin spies' } });
    await press(save());
    expect(calls).toHaveLength(1);
    expect(sent().roster.people).toEqual(snapshot.roster.people);
    expect(sent().roster.officers).toEqual([
      ...snapshot.roster.officers,
      { role: 'spymaster', characterId: 'aubrin' },
    ]);
  });
});
