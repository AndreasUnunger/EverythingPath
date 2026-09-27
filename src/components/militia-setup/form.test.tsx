import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { MilitiaSetupForm } from './form';
import { militiaSetupSchema, newMilitiaSetup } from '~/lib/canonical-setup';
import { militiaSnapshotSchema } from '~/lib/canonical-weekly-source';
import {
  mixedKindRecords,
  mixedKindSnapshot,
} from '../../../tests/rules/character-kind-fixture';
import { stableControl } from '../../../tests/stable-control';
afterEach(cleanup);
test('a ledger correction requires a field-level reason before saving', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<MilitiaSetupForm characters={[]} onSave={save} correction />);
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
test('[setup.form] setup distinguishes missing and malformed numbers and accepts advisory deviations', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<MilitiaSetupForm characters={[]} onSave={save} />);
  const rank = screen.getByRole('textbox', { name: 'Rank' });
  fireEvent.change(rank, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start militia week' }));
  expect(await screen.findByText('Rank is required.')).toBeVisible();
  fireEvent.change(rank, { target: { value: 'oops' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start militia week' }));
  expect(
    await screen.findByText('Enter a valid whole number for Rank.'),
  ).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  expect(rank).toHaveValue('oops');
  fireEvent.change(rank, { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Existing militia' }));
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Focus' })).getByRole('button', {
      name: 'Security',
    }),
  );
  expect(screen.getByLabelText('Rules warnings')).toHaveTextContent(
    'Rank never decreases',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start militia week' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'existing',
        state: expect.objectContaining({
          militiaSnapshot: expect.objectContaining({
            rank: 5,
            training: 0,
            treasuryCopper: 1000,
            focus: 'Security',
          }),
        }),
      }),
    ),
  );
});

test('[setup.carry-form] character conditions and scoped expiring benefits can be carried into ordinary play', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <MilitiaSetupForm
      characters={[
        {
          characterId: 'hero',
          name: 'Hero',
          level: 4,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
          isActive: true,
        },
      ]}
      onSave={save}
    />,
  );
  const click = (name: string) =>
    fireEvent.click(screen.getByRole('button', { name }));
  const fill = (name: string, value: string) =>
    fireEvent.change(screen.getByRole('textbox', { name }), {
      target: { value },
    });
  const choose = (label: string, name: string) =>
    fireEvent.click(
      within(screen.getByRole('group', { name: label })).getByRole('button', {
        name,
      }),
    );
  click('Add Hero');
  click('Add character condition');
  choose('Character', 'Hero');
  choose('Condition', 'captured');
  click('Record capture');
  choose('Capture source', 'raid');
  fill('Captured week', '3');
  fill('Rescued week (optional)', '2');
  fill('Rescued week (optional)', '');
  click('Add team');
  fill('Team name', 'Scouts');
  click('Add settlement');
  fill('Settlement name', 'Home');
  click('Record Reduce Danger benefit');
  fill('Reduce Danger ends week', '12');
  click('Add bonus');
  fill('Bonus source', 'Prior mission');
  choose('Bonus team (optional)', 'Scouts');
  choose('Bonus phase (optional)', 'activity');
  click('Add skill benefit');
  choose('Benefiting characters', 'Hero');
  choose('Affected skills', 'diplomacy');
  fill('Skill bonus', '2');
  fill('Skill benefit ends week', '12');
  click('Add Market Day benefit');
  choose('Discount settlements', 'Home');
  click('Start militia week');
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    state: {
      militiaSnapshot: {
        characterActions: {
          people: [
            {
              characterId: 'hero',
              status: 'captured',
              location: { kind: 'headquarters' },
              capture: { source: 'raid', week: 3 },
            },
          ],
        },
        settlements: [
          {
            name: 'Home',
            reduceDangerReputationShift: 1,
            reduceDangerUntilWeek: 12,
          },
        ],
        bonuses: [
          {
            source: 'Prior mission',
            teamId: expect.any(String),
            phase: 'activity',
          },
        ],
        eventBenefits: {
          skills: [
            {
              characterIds: ['hero'],
              skills: ['diplomacy'],
              value: 2,
              endsWeek: 12,
            },
          ],
          markets: [
            { discountPercent: 5, settlementIds: [expect.any(String)] },
          ],
        },
      },
    },
  });
}, 15000);

test('[rules.U01.setup-form] switching to an existing militia clears the initial Upkeep skip', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<MilitiaSetupForm characters={[]} onSave={save} />);
  expect(
    within(screen.getByRole('group', { name: 'First militia week' })).getByRole(
      'button',
      { name: 'Yes' },
    ),
  ).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Existing militia' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Current week' }), {
    target: { value: '9' },
  });
  expect(
    screen.queryByRole('group', { name: 'First militia week' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start militia week' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'existing',
        state: expect.objectContaining({
          week: 9,
          context: expect.objectContaining({ firstMilitiaWeek: false }),
        }),
      }),
    ),
  );
});

test('[setup.receipt-decimal] enchantment delivery preserves decimal input and explicit receipt days', async () => {
  const { newMilitiaSetup } = await import('~/lib/canonical-setup');
  const initial = newMilitiaSetup('Loyalty');
  initial.state.militiaSnapshot.settlements = [
    {
      settlementId: 'town',
      name: 'Town',
      reputation: 'Friendly',
      secured: true,
      occupied: false,
      temporaryReputationShift: 0,
      refugeActivatedWeek: null,
      refugeActiveUntilWeek: null,
    },
  ];
  initial.state.militiaSnapshot.economy = {
    items: [
      {
        itemId: 'sword',
        name: 'Sword',
        valueCopper: 1234,
        weight: 2,
        location: 'order',
      },
    ],
    caches: [],
    markets: [],
    orders: [
      {
        orderId: 'order',
        itemId: 'sword',
        settlementId: 'town',
        source: 'special_order',
        mode: 'enchantment',
        orderedWeek: 1,
        orderedDay: 0,
        dueDay: 1,
        dueActivityWeek: null,
        priceCopper: 1234,
        deliveryDays: 1,
        enchantmentValueCopper: 50000,
        receipt: null,
      },
    ],
  };
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <MilitiaSetupForm initialValues={initial} characters={[]} onSave={save} />,
  );
  const duration = screen.getByRole('textbox', {
    name: 'Delivery duration (days)',
  });
  fireEvent.change(duration, { target: { value: '0.' } });
  expect(duration).toHaveValue('0.');
  fireEvent.change(duration, { target: { value: '0.5' } });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Due day (day delivery)' }),
    { target: { value: '0.5' } },
  );
  const start = stableControl('button', 'Start militia week');
  fireEvent.click(screen.getByRole('button', { name: 'Record receipt' }));
  const received = screen.getByRole('textbox', { name: 'Received day' });
  fireEvent.change(received, { target: { value: '' } });
  fireEvent.click(start());
  expect(await screen.findByText('Received day is required.')).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(received, { target: { value: 'abc' } });
  fireEvent.click(start());
  expect(
    await screen.findByText('Enter a valid whole number for Received day.'),
  ).toBeVisible();
  fireEvent.change(received, { target: { value: '2' } });
  fireEvent.click(start());
  await waitFor(() =>
    expect(
      save,
      screen
        .queryAllByRole('alert')
        .map((node) => node.textContent)
        .join('; '),
    ).toHaveBeenCalledOnce(),
  );
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    state: {
      militiaSnapshot: {
        economy: {
          orders: [
            {
              priceCopper: 1234,
              dueDay: 0.5,
              deliveryDays: 0.5,
              enchantmentValueCopper: 50000,
              receipt: { receivedDay: 2 },
            },
          ],
        },
      },
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Mark unreceived' }));
  fireEvent.click(start());
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]?.[0]).toMatchObject({
    state: {
      militiaSnapshot: {
        economy: { orders: [{ receipt: null, dueDay: 0.5 }] },
      },
    },
  });
});

test('[setup.event-instances] repeated carried events retain separate targets, age, order and mitigation when another is removed', async () => {
  const { newMilitiaSetup } = await import('~/lib/canonical-setup');
  const initial = newMilitiaSetup('Loyalty');
  initial.mode = 'existing';
  initial.state.week = 9;
  initial.state.context.firstMilitiaWeek = false;
  initial.state.context.lastBuyoffWeek = 6;
  initial.state.militiaSnapshot.roster.teams = ['north', 'south'].map(
    (teamId) => ({
      teamId,
      name: teamId,
      teamType: 'defenders',
      status: 'active',
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    }),
  );
  initial.state.context.carriedEvents = [
    {
      eventId: 'older',
      eventType: 'theft',
      startedWeek: 5,
      order: 1,
      targets: [{ kind: 'team', teamId: 'north' }],
    },
    {
      eventId: 'younger',
      eventType: 'theft',
      startedWeek: 7,
      order: 2,
      targets: [{ kind: 'team', teamId: 'south' }],
    },
  ];
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <MilitiaSetupForm initialValues={initial} characters={[]} onSave={save} />,
  );
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Event 1' })).getByRole('button', {
      name: 'Record Theft mitigation',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start militia week' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    state: {
      context: {
        lastBuyoffWeek: 6,
        carriedEvents: [
          {
            eventId: 'older',
            startedWeek: 5,
            order: 1,
            targets: [{ kind: 'team', teamId: 'north' }],
            mitigation: { week: 9, retainedIncomePercent: 90 },
          },
          {
            eventId: 'younger',
            startedWeek: 7,
            order: 2,
            targets: [{ kind: 'team', teamId: 'south' }],
          },
        ],
      },
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Remove Event 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start militia week' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]?.[0].state.context.carriedEvents).toEqual([
    initial.state.context.carriedEvents[1],
  ]);
});

test('[setup.event-references] removing a targeted team blocks save until the carried event is removed', async () => {
  const { newMilitiaSetup } = await import('~/lib/canonical-setup');
  const initial = newMilitiaSetup('Loyalty');
  initial.state.militiaSnapshot.roster.teams = [
    {
      teamId: 'patrol',
      name: 'Patrol',
      teamType: 'defenders',
      status: 'active',
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    },
  ];
  initial.state.context.carriedEvents = [
    {
      eventId: 'sickness',
      eventType: 'sickness',
      startedWeek: 0,
      order: 0,
      targets: [{ kind: 'team', teamId: 'patrol' }],
    },
  ];
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <MilitiaSetupForm initialValues={initial} characters={[]} onSave={save} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove Team 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start militia week' }));
  expect(
    await screen.findByText(
      'A carried event, order or queued effect refers to an entity missing from this setup. Restore it or choose another target.',
    ),
  ).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Event 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start militia week' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    state: {
      context: { carriedEvents: [] },
      militiaSnapshot: { roster: { teams: [] } },
    },
  });
});
test('a correction explains how it affects choices already staged for the week without blocking the save', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const notice = vi.fn(() => 'Upkeep (1 choice) needs review.');
  render(
    <MilitiaSetupForm
      characters={[]}
      onSave={save}
      correction
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
  render(
    <MilitiaSetupForm
      correction
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
  const pressed = screen
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
  const vessa = within(
    screen.getAllByRole('group', { name: 'Character kind' })[4]!,
  );
  fireEvent.click(vessa.getByRole('button', { name: 'pc' }));
  fireEvent.click(vessa.getByRole('button', { name: 'npc' }));
  expect(vessa.getByRole('button', { name: 'npc' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Reason for correction' }),
    { target: { value: 'Recorded table reward' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]![0].state.militiaSnapshot.roster).toEqual(
    snapshot.roster,
  );
});
