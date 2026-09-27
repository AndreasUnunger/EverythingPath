import { expect, test } from 'vitest';
import { persistentEventFixture } from '../../tests/rules/persistent-event-fixture';
import { upkeepFixture } from '../../tests/rules/upkeep-fixture';
import {
  CANONICAL_WEEKLY_RULESET_VERSION,
  prepareCanonicalResolutionRecord,
  projectWeeklyDraft,
  resolveCanonicalWeeklyDraft,
} from './canonical-weekly-resolution';
import { canonicalResolutionRecordSchema } from './canonical-resolution-record';
import { correctionStagedChoices } from './correction-staged-choices';
import { editWeeklyDraft } from './weekly-draft';
import { weeklyDraftSchema, type WeeklyDraft } from './weekly-draft-contract';
import { acceptDraftOperation } from './weekly-draft-consistency';
import { DraftRejected } from './weekly-draft-persistence-contract';
import { draftReferenceRequirements } from './weekly-draft-references';

// Transfers became characterless under Ruleset Version 6 (#158, approved in
// #107). New transfers carry no character; older ones keep theirs as
// metadata that never blocks the week.

const legacy = {
  transferId: 'legacy',
  characterId: 'gone',
  direction: 'deposit' as const,
  copper: 700,
};
const actorless = {
  transferId: 'new',
  direction: 'withdraw' as const,
  copper: 7,
};

test('[rules.U05.transfer-schema] drafts and edits accept actorless and actor-bearing transfers and keep the rest strict', () => {
  const { draft } = upkeepFixture();
  const both = editWeeklyDraft(draft, {
    kind: 'upkeep',
    inputs: {
      rolls: {},
      treasuryTransfers: [legacy, actorless],
      teamDecisions: [],
    },
  });
  expect(both.ok && both.draft.upkeep.treasuryTransfers).toEqual([
    legacy,
    actorless,
  ]);
  const added = editWeeklyDraft(draft, {
    kind: 'upkeep_transfer',
    transfer: actorless,
  });
  expect(added.ok && added.draft.upkeep.treasuryTransfers).toEqual([actorless]);
  for (const transfer of [
    { ...actorless, character: 'pc' },
    { ...actorless, direction: 'gift' },
    { ...actorless, copper: 0.5 },
    { ...actorless, characterId: '' },
    { direction: 'deposit', copper: 1 },
  ])
    expect(
      weeklyDraftSchema.safeParse({
        ...draft,
        upkeep: { ...draft.upkeep, treasuryTransfers: [transfer] },
      }).success,
    ).toBe(false);
});

test('[rules.U05.legacy-actor] a transfer actor missing from the roster is no reference blocker, correction warning or preview requirement', () => {
  const input = persistentEventFixture('low_morale');
  input.snapshot.training = 15;
  input.draft.upkeep.treasuryTransfers = [legacy, actorless];
  expect(
    draftReferenceRequirements(input.draft, input.snapshot, input.snapshot),
  ).toEqual([]);
  const edited = structuredClone(input.snapshot);
  edited.characters = [];
  expect(correctionStagedChoices(input.draft, input.snapshot, edited)).toEqual(
    [],
  );
  const preview = projectWeeklyDraft({
    revision: input.draft,
    militiaSnapshot: input.snapshot,
  });
  expect(
    preview.requirements.filter((key) => key.startsWith('transfer:')),
  ).toEqual([]);
  expect(preview.status).toBe('ready');
});

test('[rules.U05.ruleset-version] a week with actorless and legacy transfers confirms under Ruleset Version 6, keeping the recorded actor and naming no one in the plan', () => {
  expect(CANONICAL_WEEKLY_RULESET_VERSION).toBe(6);
  const input = persistentEventFixture('low_morale');
  input.snapshot.training = 15;
  input.snapshot.roster.officers = [];
  input.draft.upkeep.treasuryTransfers = [legacy, actorless];
  const result = resolveCanonicalWeeklyDraft({
    revision: input.draft,
    militiaSnapshot: input.snapshot,
  });
  const record = prepareCanonicalResolutionRecord(result, 'record');
  expect(record.rulesetVersion).toBe(6);
  expect(record.source.upkeep.treasuryTransfers).toEqual([legacy, actorless]);
  expect(
    result.finalPlan.effects.upkeep.flatMap((change) =>
      change.kind === 'treasury' ? [[change.sourceId, change.characterId]] : [],
    ),
  ).toEqual([
    ['legacy', null],
    ['new', null],
  ]);
});

test('[rules.U05.old-record] an earlier record with an officer transfer and its officer ruling parses unchanged under its own version', () => {
  const input = persistentEventFixture('low_morale');
  input.snapshot.training = 15;
  input.draft.upkeep.treasuryTransfers = [{ ...legacy, characterId: 'pc' }];
  const ruling = {
    exceptionId: 'old-ruling',
    subjectId: 'legacy',
    ruleId: 'upkeep-transfer-officer',
    reason: 'A trusted ally deposits for the officers',
  };
  input.draft.rulesExceptions = [ruling];
  const current = prepareCanonicalResolutionRecord(
    resolveCanonicalWeeklyDraft({
      revision: input.draft,
      militiaSnapshot: input.snapshot,
    }),
    'old',
  );
  const old = structuredClone({ ...current, rulesetVersion: 5 });
  const upkeep = old.finalPlan.data.effects as { upkeep: unknown[] };
  upkeep.upkeep = upkeep.upkeep.map((change) =>
    (change as { sourceId?: string }).sourceId === 'legacy'
      ? { ...(change as object), characterId: 'pc' }
      : change,
  );
  expect(canonicalResolutionRecordSchema.parse(old)).toEqual(old);
  expect(old.adjudication.rulesExceptions).toEqual([ruling]);
});

test('[rules.U05.actor-scope] a newly sent transfer character must belong to the campaign, while a stored one is never re-checked', () => {
  const { draft, snapshot } = upkeepFixture();
  const accept = (
    current: WeeklyDraft,
    edit: Parameters<typeof editWeeklyDraft>[1],
  ) =>
    acceptDraftOperation(
      current,
      current,
      [],
      {
        draftId: current.draftId,
        operationId: 'op',
        baseRevision: current.revision,
        edit,
      },
      snapshot,
    ).draft;
  expect(() =>
    accept(draft, {
      kind: 'upkeep_transfer',
      transfer: { ...actorless, characterId: 'foreign' },
    }),
  ).toThrow(new DraftRejected('Invalid transfer character'));
  expect(
    accept(draft, {
      kind: 'upkeep_transfer',
      transfer: { ...actorless, characterId: 'pc' },
    }).upkeep.treasuryTransfers,
  ).toEqual([{ ...actorless, characterId: 'pc' }]);
  const stored = weeklyDraftSchema.parse({
    ...draft,
    upkeep: { ...draft.upkeep, treasuryTransfers: [legacy] },
  });
  const next = accept(stored, { kind: 'upkeep_transfer', transfer: actorless });
  expect(next.upkeep.treasuryTransfers).toEqual([legacy, actorless]);
  expect(
    accept(next, { kind: 'clear_upkeep_transfer', transferId: 'legacy' }).upkeep
      .treasuryTransfers,
  ).toEqual([actorless]);
});
