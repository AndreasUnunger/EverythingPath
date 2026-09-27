import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { upkeepFixture, roll } from '../../../tests/rules/upkeep-fixture';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { phaseView } from './phase-view';
import { UpkeepView } from './upkeep-view';

afterEach(cleanup);

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

function fixture(
  configure: (
    draft: ReturnType<typeof upkeepFixture>['draft'],
    snapshot: ReturnType<typeof upkeepFixture>['snapshot'],
  ) => void,
) {
  const { draft, snapshot } = upkeepFixture();
  snapshot.treasuryCopper = 10000;
  snapshot.training = 20;
  configure(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Aubrin' }],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('upkeep', draft, source, preview);
  if (view.phase !== 'upkeep') throw new Error('Expected Upkeep');
  return { draft, source, view, preview };
}
function missingScouts(snapshot: ReturnType<typeof upkeepFixture>['snapshot']) {
  snapshot.roster.teams.push({
    teamId: 'scouts',
    teamType: 'patrons',
    name: 'Scouts',
    status: 'missing',
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  });
}
const textbox = (name: string) => screen.getByRole('textbox', { name });

test('[rules.WEEK-15.upkeep-total] a recorded 2d4 total is complete, shows in the one total field without writing, and a blank clears through the existing nullable edit', () => {
  // Check 4 + 3 fails DC 10, so the attrition training roll is 2d4.
  const { view, preview } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4), training: total(4, 2, 7) };
  });
  const training = view.rolls.find((fact) => fact.field === 'training')!;
  expect(training).toMatchObject({ count: 2, sides: 4, dice: null });
  expect(training.normalized).toMatchObject({
    status: 'complete',
    diceTotal: 7,
    naturalValue: null,
    rangeWarning: null,
  });
  expect(
    preview.requirements.filter((key) => key.startsWith('upkeep:')),
  ).toEqual([]);
  expect(view.ready).toBe(true);
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  expect(textbox('Attrition training roll')).toHaveValue('7');
  expect(screen.getByText('2d4 · total of the dice only')).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: /die/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('A value is required.')).not.toBeInTheDocument();
  // The complete legacy check shows its value the same way, with no write.
  expect(textbox('Attrition Loyalty roll')).toHaveValue('4');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(textbox('Attrition training roll'), {
    target: { value: '' },
  });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: null,
  });
});

test('[rules.WEEK-15.upkeep-writer] editing a number writes the strict total against the live 2d4 specification and preserves the prior provenance and modifiers', () => {
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
  const modifiers = [{ sourceId: 'helpful', value: 1, reason: 'Allies' }];
  const { view } = fixture((draft) => {
    draft.upkeep.rolls = {
      check: { dice: [4], sides: 20, provenance: generated, modifiers },
      training: roll(4, 3, 4),
    };
  });
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  // Complete legacy arrays display their sum through normalization only.
  expect(textbox('Attrition training roll')).toHaveValue('7');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(textbox('Attrition training roll'), {
    target: { value: '6' },
  });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: {
      diceTotal: 6,
      diceCount: 2,
      sides: 4,
      provenance: table,
      modifiers: [],
    },
  });
  fireEvent.change(textbox('Attrition Loyalty roll'), {
    target: { value: '12' },
  });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'check',
    roll: {
      diceTotal: 12,
      diceCount: 1,
      sides: 20,
      provenance: generated,
      modifiers,
    },
  });
  expect(edit.mock.lastCall![0]).not.toHaveProperty('roll.dice');
});

test('[rules.WEEK-15.upkeep-zero] a recorded total of zero is visible with its range warning and stays complete', () => {
  const { view, preview } = fixture((draft) => {
    draft.upkeep.rolls = { check: total(20, 1, 0) };
  });
  const check = view.rolls.find((fact) => fact.field === 'check')!;
  expect(check.normalized).toMatchObject({
    status: 'complete',
    diceTotal: 0,
    naturalValue: 0,
    rangeWarning: 'total',
  });
  expect(preview.warnings).toContain('upkeep:attrition:roll-range');
  render(<UpkeepView view={view} edit={vi.fn()} disabled={false} />);
  expect(textbox('Attrition Loyalty roll')).toHaveValue('0');
  expect(screen.getByText(/usual range for 1d20 is 1–20/)).toBeVisible();
  expect(
    screen.getByText(
      /Attrition Loyalty total 0 is outside the usual 1–20 range/,
    ),
  ).toBeVisible();
  expect(screen.queryByText(/dice include a value/)).not.toBeInTheDocument();
});

test('[rules.WEEK-15.upkeep-wrong-spec] a total recorded for a different specification stays incomplete, shows what the step needs and is replaced only by a deliberate edit', () => {
  const { view, preview } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4), training: total(6, 1, 5) };
  });
  const training = view.rolls.find((fact) => fact.field === 'training')!;
  expect(training.normalized.status).toBe('incomplete');
  expect(preview.requirements).toContain('upkeep:attrition-training:dice:2d4');
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  expect(textbox('Attrition training roll')).toHaveValue('');
  expect(
    screen.getByText(
      /Recorded total 5 was entered for 1d6, but this step needs 2d4/,
    ),
  ).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(textbox('Attrition training roll'), {
    target: { value: '5' },
  });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: {
      diceTotal: 5,
      diceCount: 2,
      sides: 4,
      provenance: table,
      modifiers: [],
    },
  });
});

test('[rules.WEEK-15.upkeep-partial] a partial legacy array keeps its real die, stays incomplete, is never summed as complete and clears explicitly', () => {
  const { view, preview } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4), training: roll(4, 3) };
  });
  const training = view.rolls.find((fact) => fact.field === 'training')!;
  expect(training.dice).toEqual([3, null]);
  expect(training.normalized).toMatchObject({
    status: 'incomplete',
    diceTotal: null,
  });
  expect(preview.requirements).toContain('upkeep:attrition-training:dice:2d4');
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  expect(textbox('Attrition training roll')).toHaveValue('');
  expect(
    screen.getByText(/Recorded dice 3 are incomplete for 2d4/),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Clear attrition training roll' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: null,
  });
});

test('[rules.WEEK-15.upkeep-legacy-equivalence] a complete legacy array and an equal total produce the same Upkeep facts and outcome', () => {
  const legacy = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4), training: roll(4, 3, 4) };
  });
  const totals = fixture((draft) => {
    draft.upkeep.rolls = { check: total(20, 1, 4), training: total(4, 2, 7) };
  });
  expect(totals.view.after).toEqual(legacy.view.after);
  expect(totals.view.ready).toBe(legacy.view.ready);
  expect(totals.preview.outcome).toEqual(legacy.preview.outcome);
  const strip = (view: typeof legacy.view) =>
    view.rolls.map(
      ({ dice: _dice, recorded: _recorded, normalized, ...rest }) => ({
        ...rest,
        diceTotal: normalized.diceTotal,
        status: normalized.status,
      }),
    );
  expect(strip(totals.view)).toEqual(strip(legacy.view));
});

test('[rules.WEEK-15.upkeep-natural] a single-die total of 20 keeps natural-20 attrition semantics while a multi-die 20 never does', () => {
  const natural = fixture((draft) => {
    draft.upkeep.rolls = { check: total(20, 1, 20), training: total(6, 1, 6) };
  });
  expect(
    natural.view.rolls.find((fact) => fact.field === 'training'),
  ).toMatchObject({ count: 1, sides: 6 });
  expect(natural.view.after.training).toBe(26);
  const twoDice = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4), training: total(4, 2, 20) };
  });
  const training = twoDice.view.rolls.find(
    (fact) => fact.field === 'training',
  )!;
  expect(training.normalized).toMatchObject({
    status: 'complete',
    naturalValue: null,
    rangeWarning: 'total',
  });
});

test('[rules.WEEK-15.upkeep-team-roll] a missing team’s recorded return total shows in its field, survives decision changes exactly and clears through the decision edit', () => {
  const { view } = fixture((draft, snapshot) => {
    missingScouts(snapshot);
    draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 3) };
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'leave', roll: total(20, 1, 1) },
    ];
  });
  const team = view.teams.find((team) => team.teamId === 'scouts')!;
  expect(team.roll.recorded).toEqual(total(20, 1, 1));
  expect(team.roll.normalized).toMatchObject({
    status: 'complete',
    naturalValue: 1,
  });
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  const card = screen.getByRole('group', { name: 'Scouts recovery' });
  const field = within(card).getByRole('textbox', {
    name: 'Scouts return roll',
  });
  expect(field).toHaveValue('1');
  fireEvent.click(within(card).getByRole('button', { name: 'Leave team' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: {
      teamId: 'scouts',
      decision: 'leave',
      costCopper: 3000,
      roll: total(20, 1, 1),
    },
  });
  fireEvent.change(field, { target: { value: '17' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: {
      teamId: 'scouts',
      decision: 'leave',
      roll: total(20, 1, 17),
    },
  });
  fireEvent.change(field, { target: { value: '' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: { teamId: 'scouts', decision: 'leave' },
  });
});

test.each([
  ['wrong sides', total(6, 1, 5), 'Recorded total 5 was entered for 1d6'],
  ['wrong count', total(20, 2, 25), 'Recorded total 25 was entered for 2d20'],
  ['partial legacy', roll(20), 'Recorded dice  are incomplete for 1d20'],
])(
  '[rules.WEEK-15.upkeep-team-incompatible] a missing team’s %s return roll stays visible with its explanation, can be cleared, and a deliberate total replaces it',
  (_label, recorded, explanation) => {
    const { view, preview } = fixture((draft, snapshot) => {
      missingScouts(snapshot);
      draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 3) };
      draft.upkeep.teamDecisions = [
        {
          teamId: 'scouts',
          decision: 'leave',
          roll: 'dice' in recorded ? { ...recorded, dice: [] } : recorded,
        },
      ];
      // An empty legacy array is not a valid stored roll; use one die of the
      // wrong sides for the "partial" case instead.
      if ('dice' in recorded) draft.upkeep.teamDecisions[0]!.roll = roll(6, 3);
    });
    expect(preview.requirements).toContain('team:scouts:return:dice:1d20');
    const team = view.teams.find((team) => team.teamId === 'scouts')!;
    expect(team.roll.normalized.status).toBe('incomplete');
    expect(team.needsReturnRoll).toBe(true);
    const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
    render(<UpkeepView view={view} edit={edit} disabled={false} />);
    const card = screen.getByRole('group', { name: 'Scouts recovery' });
    const field = within(card).getByRole('textbox', {
      name: 'Scouts return roll',
    });
    expect(field).toHaveValue('');
    if ('dice' in recorded)
      expect(
        within(card).getByText(/Recorded dice 3 were entered for 1d6/),
      ).toBeVisible();
    else expect(within(card).getByText(new RegExp(explanation))).toBeVisible();
    fireEvent.click(
      within(card).getByRole('button', { name: 'Clear scouts return roll' }),
    );
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'upkeep_team',
      teamId: 'scouts',
      decision: { teamId: 'scouts', decision: 'leave' },
    });
    // The explicit clear discards the field's local state, so query it again.
    fireEvent.change(
      within(card).getByRole('textbox', { name: 'Scouts return roll' }),
      { target: { value: '12' } },
    );
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'upkeep_team',
      teamId: 'scouts',
      decision: {
        teamId: 'scouts',
        decision: 'leave',
        roll: {
          diceTotal: 12,
          diceCount: 1,
          sides: 20,
          provenance: table,
          modifiers: [],
        },
      },
    });
  },
);

test('[rules.WEEK-14.upkeep-malformed] malformed totals never reach the edit and required feedback is distinct from format errors', async () => {
  const { view } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4) };
  });
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  const field = textbox('Attrition training roll');
  const alerts = () =>
    screen.getAllByRole('alert').map((alert) => alert.textContent);
  for (const invalid of ['-1', '2.5', '1e1', ' 7', '７']) {
    fireEvent.change(field, { target: { value: invalid } });
    expect(field).toHaveValue('');
    expect(alerts()).toContain('Use digits only.');
  }
  expect(edit).not.toHaveBeenCalled();
  fireEvent.blur(field);
  await waitFor(() => expect(alerts()).toContain('A value is required.'));
});
