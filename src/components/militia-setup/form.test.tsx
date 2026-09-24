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
