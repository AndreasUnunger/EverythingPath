import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { upkeepFixture, roll } from '../../../tests/rules/upkeep-fixture';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { phaseView } from './phase-view';
import { UpkeepView } from './upkeep-view';

function fixture() {
  const { draft, snapshot } = upkeepFixture();
  snapshot.treasuryCopper = 10000;
  snapshot.training = 20;
  snapshot.roster.teams.push({
    teamId: 'scouts',
    teamType: 'patrons',
    name: 'Scouts',
    status: 'disabled',
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  });
  draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 3) };
  draft.event.chanceRoll = roll(100, 100);
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    sourceRevision: 0,
    snapshot,
    people: [
      {
        characterId: 'pc',
        name: 'A very long officer name that still remains readable',
      },
    ],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('upkeep', draft, source, preview);
  if (view.phase !== 'upkeep') throw new Error('Expected Upkeep');
  return { draft, source, view };
}

test('[rules.P81.recovery-adjustment] recovery cards prefill the baseline and require a reason for a synced override without changing rules outcomes', async () => {
  const { draft, source, view } = fixture();
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  const card = screen.getByRole('group', { name: 'Scouts recovery' });
  const cost = within(card).getByLabelText('Recovery cost (copper)');
  expect(cost).toHaveValue('3000');
  fireEvent.click(within(card).getByRole('button', { name: 'Recover team' }));
  expect(edit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      kind: 'upkeep_team',
      decision: expect.objectContaining({
        decision: 'recover',
        costCopper: 3000,
      }),
    }),
  );
  edit.mockClear();
  fireEvent.change(cost, { target: { value: '2500' } });
  fireEvent.click(within(card).getByRole('button', { name: 'Stage recovery' }));
  expect(
    await within(card).findByText(
      'A reason is required for a changed recovery cost.',
    ),
  ).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(
    within(card).getByLabelText('Reason for recovery adjustment'),
    { target: { value: 'Local healers discount' } },
  );
  fireEvent.click(within(card).getByRole('button', { name: 'Stage recovery' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const result = editWeeklyDraft(draft, edit.mock.calls[0]![0]);
  if (!result.ok) throw new Error(result.error);
  const preview = projectWeeklyDraft({
    revision: result.draft,
    militiaSnapshot: source.snapshot,
  });
  expect(preview.requirements).toEqual([]);
  expect(preview.status).toBe('ready');
  expect(preview.baseline?.militiaSnapshot.treasuryCopper).toBe(7000);
  expect(preview.outcome?.militiaSnapshot.treasuryCopper).toBe(7500);
  expect(preview.baseline?.militiaSnapshot.roster.teams[0]?.status).toBe(
    'active',
  );
  const left = editWeeklyDraft(result.draft, {
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: { teamId: 'scouts', decision: 'leave' },
  });
  if (!left.ok) throw new Error(left.error);
  expect(left.draft.tableAdjustments).toEqual([]);
});

test('[rules.P81.warning-context] warnings name the affected team and officer without exposing identifiers', () => {
  const { view } = fixture();
  view.warnings = [
    'team:scouts:recovery-funds',
    'team:scouts:upkeep-removal',
    'officer:pc:archived',
  ];
  render(<UpkeepView view={view} edit={() => undefined} disabled={false} />);
  expect(
    screen.getByText(/Scouts.*recovery.*available treasury/i),
  ).toBeVisible();
  expect(screen.getByText(/Removing Scouts.*normal Upkeep/i)).toBeVisible();
  expect(screen.getByText(/A very long officer name.*archived/i)).toBeVisible();
  expect(screen.queryByText(/team:scouts/)).not.toBeInTheDocument();
});

test('[rules.P81.recovery-arbitration] disjoint recoveries coexist while stale edits cannot partially overwrite a team and its adjustment', async () => {
  const { draft, source } = fixture();
  source.snapshot.roster.teams.push({
    ...source.snapshot.roster.teams[0]!,
    teamId: 'second',
    name: 'Second team',
  });
  const { createMemoryDraftAuthority } =
    await import('~/lib/memory-draft-persistence');
  const authority = createMemoryDraftAuthority(draft, source.snapshot);
  const request = (teamId: string) => ({
    draftId: draft.draftId,
    operationId: teamId,
    baseRevision: 0,
    edit: {
      kind: 'upkeep_team' as const,
      teamId,
      decision: { teamId, decision: 'recover' as const, costCopper: 3000 },
      recoveryAdjustment: { deltaCopper: 500, reason: 'Local discount' },
    },
  });
  await authority.transport.send(request('scouts'));
  await authority.transport.send(request('second'));
  const before = await authority.transport.read();
  expect(before.draft?.upkeep.teamDecisions).toHaveLength(2);
  expect(before.draft?.tableAdjustments).toHaveLength(2);
  await expect(
    authority.transport.send({
      draftId: draft.draftId,
      operationId: 'stale-adjustment',
      baseRevision: 0,
      edit: { kind: 'table_adjustments', adjustments: [] },
    }),
  ).rejects.toThrow();
  expect(await authority.transport.read()).toEqual(before);
  await authority.transport.send({
    draftId: draft.draftId,
    operationId: 'adjudicate',
    baseRevision: 2,
    edit: {
      kind: 'table_adjustments',
      adjustments: [
        {
          kind: 'militia_value',
          adjustmentId: 'upkeep-recovery:scouts',
          field: 'treasuryCopper',
          operation: 'add',
          value: 250,
          reason: 'Revised discount',
        },
      ],
    },
  });
  const adjusted = await authority.transport.read();
  await expect(
    authority.transport.send({
      draftId: draft.draftId,
      operationId: 'stale-leave',
      baseRevision: 2,
      edit: {
        kind: 'upkeep_team',
        teamId: 'scouts',
        decision: { teamId: 'scouts', decision: 'leave' },
      },
    }),
  ).rejects.toThrow();
  expect(await authority.transport.read()).toEqual(adjusted);
});
