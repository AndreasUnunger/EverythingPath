import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useState } from 'react';
import { CanonicalRosterEditor } from './canonical-roster-editor';
import type { CanonicalRoster } from '~/lib/canonical-roster';

afterEach(cleanup);

const characters = [
  { characterId: 'alice', name: 'Alice', charisma: 10, isActive: true },
  { characterId: 'bob', name: 'Bob', charisma: 14, isActive: true },
];
function Ledger() {
  const [saved, setSaved] = useState<CanonicalRoster>({
    people: [
      { characterId: 'alice', kind: 'pc', hitDice: null },
      { characterId: 'bob', kind: 'officer_npc', hitDice: 3 },
    ],
    officers: [],
    teams: [],
  });
  return (
    <>
      <CanonicalRosterEditor
        roster={saved}
        revision={0}
        characters={characters}
        maxTeams={2}
        onSave={async (roster, expectedRevision) => {
          setSaved(roster);
          return (expectedRevision ?? -1) + 1;
        }}
      />
      <output aria-label="Saved officers">
        {saved.officers
          .map((officer) => `${officer.characterId}: ${officer.role}`)
          .join(', ')}
      </output>
    </>
  );
}

test('[roster.ui] ledger saves multiple holders and distinguishes malformed Hit Dice from unknown', async () => {
  render(<Ledger />);
  fireEvent.change(screen.getByLabelText('Alice Hit Dice'), {
    target: { value: 'bad' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Alice: Commandant' }));
  fireEvent.click(screen.getByRole('button', { name: 'Bob: Commandant' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  expect(
    await screen.findByText('Hit Dice must be a non-negative whole number'),
  ).toBeVisible();
  expect(screen.getByLabelText('Saved officers')).toHaveTextContent('');
  fireEvent.change(screen.getByLabelText('Alice Hit Dice'), {
    target: { value: '7' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Saved officers')).toHaveTextContent(
      'alice: commandant, bob: commandant',
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Alice: Commandant' }));
  fireEvent.click(screen.getByRole('button', { name: 'Alice: Marshal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Saved officers')).toHaveTextContent(
      'bob: commandant, alice: marshal',
    ),
  );
  expect(screen.getByLabelText('Alice Hit Dice')).toHaveValue('7');
  expect(screen.getByLabelText('Bob Hit Dice')).toHaveValue('3');
});

test('[roster.ui-teams] setup keeps repeated team types distinct and permits advisory overrides', async () => {
  let saved: CanonicalRoster | undefined;
  render(
    <CanonicalRosterEditor
      roster={{ people: [], officers: [], teams: [] }}
      revision={null}
      characters={[]}
      maxTeams={1}
      onSave={async (roster, expectedRevision) => {
        saved = roster;
        return (expectedRevision ?? -1) + 1;
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  expect(await screen.findByText('Team name is required')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Team 1 name'), {
    target: { value: 'First' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Team 1 condition: Disabled' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
  fireEvent.change(screen.getByLabelText('Team 2 name'), {
    target: { value: 'Second' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Team 2 condition: Missing' }),
  );
  expect(screen.getByLabelText('Rules warnings')).toHaveTextContent(
    '2 teams count toward the normal limit of 1.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await screen.findByText('Roster saved.');
  expect(
    saved?.teams.map((team) => [team.name, team.teamType, team.status]),
  ).toEqual([
    ['First', 'defenders', 'disabled'],
    ['Second', 'defenders', 'missing'],
  ]);
  expect(saved?.teams[0]?.teamId).not.toEqual(saved?.teams[1]?.teamId);
  const identity = saved?.teams[1]?.teamId;
  fireEvent.click(screen.getByRole('button', { name: /Team 2: Reward team/ }));
  fireEvent.change(screen.getByLabelText('Team 2 notes / override reason'), {
    target: { value: 'Campaign reward' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await waitFor(() => expect(saved?.teams[1]?.rewardCapExempt).toBe(true));
  expect(saved?.teams[1]?.teamId).toBe(identity);
  expect(screen.queryByLabelText('Rules warnings')).not.toBeInTheDocument();
});

test('[roster.ui-conflict] a newer shared roster preserves local edits until explicit conflict recovery', async () => {
  const initial: CanonicalRoster = {
    people: [{ characterId: 'alice', kind: 'pc', hitDice: 7 }],
    officers: [],
    teams: [],
  };
  let stored = initial;
  let storedRevision = 0;
  const save = async (
    roster: CanonicalRoster,
    expectedRevision: number | null,
  ) => {
    if (expectedRevision !== storedRevision)
      throw new Error(
        'Roster changed. Review the latest roster before saving.',
      );
    stored = roster;
    return ++storedRevision;
  };
  const view = render(
    <CanonicalRosterEditor
      roster={stored}
      revision={storedRevision}
      characters={characters}
      maxTeams={2}
      onSave={save}
    />,
  );
  fireEvent.change(screen.getByLabelText('Alice Hit Dice'), {
    target: { value: '12' },
  });
  stored = {
    ...initial,
    people: [{ characterId: 'alice', kind: 'pc', hitDice: 3 }],
  };
  storedRevision = 1;
  view.rerender(
    <CanonicalRosterEditor
      roster={stored}
      revision={storedRevision}
      characters={characters}
      maxTeams={2}
      onSave={save}
    />,
  );
  expect(screen.getByLabelText('Alice Hit Dice')).toHaveValue('12');
  expect(screen.getByRole('status')).toHaveTextContent(
    'The roster has changed.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Review the latest roster',
  );
  expect(stored.people[0]?.hitDice).toBe(3);
  fireEvent.click(screen.getByRole('button', { name: 'Reload roster' }));
  expect(screen.getByLabelText('Alice Hit Dice')).toHaveValue('3');
  fireEvent.change(screen.getByLabelText('Alice Hit Dice'), {
    target: { value: '4' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await screen.findByText('Roster saved.');
  expect(stored.people[0]?.hitDice).toBe(4);
});
