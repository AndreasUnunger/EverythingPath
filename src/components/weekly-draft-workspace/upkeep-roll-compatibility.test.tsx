import {
  cleanup,
  fireEvent,
  render,
  screen,
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

// Test-only representation; the app never writes totals in this delivery.
function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}

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

test('[rules.WEEK-15.upkeep-total] an incoming 2d4 total is read as complete and shown as the recorded total, never as blank required dice', () => {
  // Check 4 + 3 fails DC 10, so the attrition training roll is 2d4.
  const { view, preview } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4), training: total(4, 2, 7) };
  });
  const training = view.rolls.find((fact) => fact.field === 'training')!;
  expect(training.count).toBe(2);
  expect(training.sides).toBe(4);
  expect(training.dice).toBeNull();
  expect(training.recorded).toEqual(total(4, 2, 7));
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
  const group = screen.getByRole('group', { name: 'Attrition training roll' });
  expect(within(group).getByText('Recorded total')).toBeVisible();
  expect(within(group).getByText('7')).toBeVisible();
  expect(within(group).getByText('2d4')).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: /Attrition training die/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('A value is required.')).not.toBeInTheDocument();
  // The check itself stays on the legacy per-die writer.
  expect(
    screen.getByRole('textbox', { name: 'Attrition Loyalty die' }),
  ).toHaveValue('4');
  fireEvent.click(
    within(group).getByRole('button', {
      name: 'Clear attrition training roll',
    }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: null,
  });
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
  const group = screen.getByRole('group', { name: 'Attrition Loyalty roll' });
  expect(within(group).getByText('0')).toBeVisible();
  expect(within(group).getByText(/usual range for 1d20 is 1–20/)).toBeVisible();
  expect(
    screen.getByText(
      /Attrition Loyalty total 0 is outside the usual 1–20 range/,
    ),
  ).toBeVisible();
  expect(screen.queryByText(/dice include a value/)).not.toBeInTheDocument();
});

test('[rules.WEEK-15.upkeep-wrong-spec] a total recorded for a different specification stays incomplete and says what the step needs', () => {
  const { view, preview } = fixture((draft) => {
    // Failure branch needs 2d4; a stale 1d6 total must not become ready.
    draft.upkeep.rolls = { check: roll(20, 4), training: total(6, 1, 5) };
  });
  const training = view.rolls.find((fact) => fact.field === 'training')!;
  expect(training.normalized.status).toBe('incomplete');
  expect(training.dice).toBeNull();
  expect(preview.requirements).toContain('upkeep:attrition-training:dice:2d4');
  render(<UpkeepView view={view} edit={vi.fn()} disabled={false} />);
  const group = screen.getByRole('group', { name: 'Attrition training roll' });
  expect(within(group).getByText('5')).toBeVisible();
  expect(within(group).getByText('1d6')).toBeVisible();
  expect(
    within(group).getByText(/needs 2d4, but the recorded total is for 1d6/),
  ).toBeVisible();
});

test('[rules.WEEK-15.upkeep-partial] a partial legacy array keeps its real die, stays incomplete and is never summed as complete', () => {
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
  render(<UpkeepView view={view} edit={vi.fn()} disabled={false} />);
  expect(
    screen.getByRole('textbox', { name: 'Attrition training die 1' }),
  ).toHaveValue('3');
  expect(
    screen.getByRole('textbox', { name: 'Attrition training die 2' }),
  ).toHaveValue('');
  expect(screen.queryByText('Recorded total')).not.toBeInTheDocument();
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
  ).toMatchObject({
    count: 1,
    sides: 6,
  });
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

test('[rules.WEEK-15.upkeep-team-roll] a missing team’s recorded return total is shown honestly, kept on decision changes and cleared through the existing edit', () => {
  const { view } = fixture((draft, snapshot) => {
    snapshot.roster.teams.push({
      teamId: 'scouts',
      teamType: 'patrons',
      name: 'Scouts',
      status: 'missing',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    });
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
  const group = within(card).getByRole('group', { name: 'Scouts return roll' });
  expect(within(group).getByText('1')).toBeVisible();
  expect(
    within(card).queryByRole('textbox', { name: 'Scouts return die' }),
  ).not.toBeInTheDocument();
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
  fireEvent.click(
    within(group).getByRole('button', { name: 'Clear scouts return roll' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: { teamId: 'scouts', decision: 'leave' },
  });
});

test('[rules.WEEK-15.upkeep-reentry] after a deliberate clear the existing legacy writer accepts newly supplied dice', () => {
  const { view } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4) };
  });
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Attrition training die 1' }),
    { target: { value: '3' } },
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: { dice: [3], sides: 4, provenance: { kind: 'table' }, modifiers: [] },
  });
});
