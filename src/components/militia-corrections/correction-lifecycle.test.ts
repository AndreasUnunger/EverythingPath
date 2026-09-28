import { describe, expect, test } from 'vitest';
import { acceptedCampaignSetup } from '../../../tests/rules/accepted-campaign';
import { mergeSection, sectionValue } from '~/lib/militia-correction-sections';
import {
  closedCorrection,
  correctionReducer,
  correctionView,
  planPeopleSave,
  planSectionSave,
  type AcceptedMilitia,
  type Correction,
  type CorrectionAction,
} from './correction-lifecycle';

function accepted(): AcceptedMilitia {
  return {
    revision: 3,
    draftId: 'week-9',
    state: acceptedCampaignSetup('officer').state,
  };
}
function withSnapshot(
  base: AcceptedMilitia,
  change: (
    snapshot: AcceptedMilitia['state']['militiaSnapshot'],
  ) => AcceptedMilitia['state']['militiaSnapshot'],
  revision = base.revision + 1,
): AcceptedMilitia {
  return {
    ...base,
    revision,
    state: {
      ...base.state,
      militiaSnapshot: change(base.state.militiaSnapshot),
    },
  };
}
const run = (
  actions: CorrectionAction[],
  state: Correction = closedCorrection,
) => actions.reduce(correctionReducer, state);
const openValues = (from = accepted()) =>
  run([
    {
      type: 'open',
      target: { kind: 'section', section: 'values' },
      accepted: from,
    },
  ]);
const yours = (from = accepted(), treasuryCopper = 50000) => ({
  ...sectionValue('values', from.state.militiaSnapshot),
  treasuryCopper,
});

function send(state: Correction, from: AcceptedMilitia, value = yours(from)) {
  const plan = planSectionSave(state, from, 'values', value);
  if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`);
  return plan;
}

describe('opening and cancelling', () => {
  test('only one correction is open on a device; Cancel closes it without a write', () => {
    const base = accepted();
    const open = openValues(base);
    expect(open.kind).toBe('open');
    const second = correctionReducer(open, {
      type: 'open',
      target: { kind: 'people' },
      accepted: base,
    });
    expect(second).toBe(open);
    expect(correctionReducer(open, { type: 'cancel' })).toEqual(
      closedCorrection,
    );
  });

  test('an unchanged section has nothing to save', () => {
    const base = accepted();
    const open = openValues(base);
    expect(
      planSectionSave(
        open,
        base,
        'values',
        sectionValue('values', base.state.militiaSnapshot),
      ),
    ).toEqual({ kind: 'unchanged' });
  });
});

describe('saving against the latest militia', () => {
  test('a change to another section merges onto the latest snapshot at its newest revision', () => {
    const opened = accepted();
    const open = openValues(opened);
    const latest = withSnapshot(opened, (snapshot) => ({
      ...snapshot,
      roster: {
        ...snapshot.roster,
        teams: snapshot.roster.teams.map((team) => ({
          ...team,
          notes: 'Found',
        })),
      },
    }));
    const plan = send(open, latest, yours(opened));
    expect(plan.attempt.expectedRevision).toBe(4);
    expect(plan.snapshot.treasuryCopper).toBe(50000);
    expect(plan.snapshot.roster.teams[0]?.notes).toBe('Found');
  });

  test('another player changing the same section is a conflict, never a field merge', () => {
    const opened = accepted();
    const open = openValues(opened);
    const theirs = withSnapshot(opened, (snapshot) => ({
      ...snapshot,
      notoriety: 30,
    }));
    expect(planSectionSave(open, theirs, 'values', yours(opened))).toEqual({
      kind: 'conflict',
    });
    const conflict = correctionReducer(open, { type: 'conflict' });
    expect(correctionView(conflict, theirs)).toEqual({ kind: 'conflict' });
  });

  test('Start again captures the newest section, so the next Save is no longer a conflict', () => {
    const opened = accepted();
    const theirs = withSnapshot(opened, (snapshot) => ({
      ...snapshot,
      notoriety: 30,
    }));
    const restarted = run(
      [{ type: 'conflict' }, { type: 'restart', accepted: theirs }],
      openValues(opened),
    );
    expect(correctionView(restarted, theirs)).toEqual({
      kind: 'editing',
      notice: null,
      message: null,
    });
    const plan = send(restarted, theirs, yours(theirs));
    expect(plan.snapshot.notoriety).toBe(30);
  });

  test('a pending Save cannot be duplicated, cancelled or restarted', () => {
    const base = accepted();
    const open = openValues(base);
    const plan = send(open, base);
    const saving = correctionReducer(open, {
      type: 'submit',
      attempt: plan.attempt,
    });
    expect(correctionView(saving, base)).toEqual({ kind: 'saving' });
    expect(planSectionSave(saving, base, 'values', yours(base))).toEqual({
      kind: 'busy',
    });
    for (const action of [
      { type: 'cancel' },
      { type: 'restart', accepted: base },
      { type: 'submit', attempt: { ...plan.attempt, candidate: 'other' } },
    ] satisfies CorrectionAction[])
      expect(correctionReducer(saving, action)).toBe(saving);
  });

  test('an accepted Save closes the correction with feedback for its section', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    expect(
      run(
        [
          { type: 'submit', attempt },
          { type: 'accepted', attempt },
        ],
        open,
      ),
    ).toEqual({
      kind: 'closed',
      feedback: { kind: 'saved', entry: 'values' },
    });
  });

  test('a late acknowledgement for another attempt is ignored', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const saving = correctionReducer(open, { type: 'submit', attempt });
    const stale = { ...attempt, expectedRevision: 1 };
    expect(
      correctionReducer(saving, { type: 'accepted', attempt: stale }),
    ).toBe(saving);
  });
});

describe('failures and reconciliation', () => {
  test('a refusal at the newest revision keeps the input and reports it', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const rejected = run(
      [
        { type: 'submit', attempt },
        { type: 'rejected', attempt, message: 'Campaign editing is paused' },
      ],
      open,
    );
    expect(correctionView(rejected, base)).toEqual({
      kind: 'editing',
      notice: 'rejected',
      message: 'Campaign editing is paused',
    });
    // Saving again is allowed and uses the same newest revision.
    expect(send(rejected, base).attempt.expectedRevision).toBe(3);
  });

  test('a revision race with another section asks for a retry against the refreshed militia', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const rejected = run(
      [
        { type: 'submit', attempt },
        { type: 'rejected', attempt, message: null },
      ],
      open,
    );
    const characterEdit = withSnapshot(base, (snapshot) => ({
      ...snapshot,
      characters: snapshot.characters.map((c) => ({ ...c, charisma: 20 })),
    }));
    expect(correctionView(rejected, characterEdit)).toMatchObject({
      kind: 'editing',
      notice: 'retry',
    });
    const retry = send(rejected, characterEdit);
    expect(retry.attempt.expectedRevision).toBe(4);
    expect(retry.snapshot.characters[0]?.charisma).toBe(20);
  });

  test('a revision race with the same section becomes a conflict', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const rejected = run(
      [
        { type: 'submit', attempt },
        { type: 'rejected', attempt, message: null },
      ],
      open,
    );
    const theirs = withSnapshot(base, (snapshot) => ({ ...snapshot, rank: 5 }));
    expect(correctionView(rejected, theirs)).toEqual({ kind: 'conflict' });
    expect(planSectionSave(rejected, theirs, 'values', yours(base))).toEqual({
      kind: 'conflict',
    });
  });

  test('an unknown acknowledgement is reconciled before another Save is offered', () => {
    const base = accepted();
    const open = openValues(base);
    const plan = send(open, base);
    const unknown = run(
      [
        { type: 'submit', attempt: plan.attempt },
        { type: 'unknown', attempt: plan.attempt },
      ],
      open,
    );
    // Not yet applied: saving again is bound to the same revision, so it can
    // never apply the correction twice.
    expect(correctionView(unknown, base)).toMatchObject({
      notice: 'unconfirmed',
    });
    expect(send(unknown, base).attempt.expectedRevision).toBe(3);
    // The militia now shows these values: close without claiming the reason
    // was stored.
    const applied = {
      ...base,
      revision: 4,
      state: { ...base.state, militiaSnapshot: plan.snapshot },
    };
    expect(correctionView(unknown, applied)).toEqual({
      kind: 'closed',
      feedback: { kind: 'matched', entry: 'values' },
    });
    // Another player changed this section instead.
    const theirs = withSnapshot(base, (snapshot) => ({ ...snapshot, rank: 5 }));
    expect(correctionView(unknown, theirs)).toEqual({ kind: 'conflict' });
    // Only another section changed: not applied, save again at the newer revision.
    const other = withSnapshot(base, (snapshot) =>
      mergeSection('settlements', snapshot, []),
    );
    expect(correctionView(unknown, other)).toMatchObject({
      notice: 'unconfirmed',
    });
    expect(send(unknown, other).attempt.expectedRevision).toBe(4);
  });

  test('a new week requires restarting from its facts; an old-week edit is never applied to it', () => {
    const base = accepted();
    const open = openValues(base);
    const next: AcceptedMilitia = {
      revision: 4,
      draftId: 'week-10',
      state: { ...base.state, week: 10 },
    };
    expect(correctionView(open, next)).toEqual({ kind: 'weekChanged' });
    expect(planSectionSave(open, next, 'values', yours(base))).toEqual({
      kind: 'busy',
    });
    const restarted = correctionReducer(open, {
      type: 'restart',
      accepted: next,
    });
    expect(correctionView(restarted, next)).toMatchObject({ kind: 'editing' });
  });
});

// The People & officers fallback keeps the old editor's revision-bound save:
// its whole snapshot is sent against the revision it opened from, never
// merged onto a newer militia (#139 §5).
const openPeople = (from = accepted()) =>
  run([{ type: 'open', target: { kind: 'people' }, accepted: from }]);
type Snapshot = AcceptedMilitia['state']['militiaSnapshot'];
const withMarshal = (from = accepted()): Snapshot => {
  const snapshot = from.state.militiaSnapshot;
  return {
    ...snapshot,
    roster: {
      ...snapshot.roster,
      officers: [
        ...snapshot.roster.officers.filter(
          (officer) => officer.role !== 'marshal',
        ),
        { role: 'marshal', characterId: 'officer' },
      ],
    },
  };
};
function sendPeople(state: Correction, snapshot = withMarshal()) {
  const plan = planPeopleSave(state, snapshot);
  if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`);
  return plan;
}

describe('the People & officers fallback', () => {
  test('is exclusive with section editing and closes with feedback when saved', () => {
    const base = accepted();
    const people = run(
      [
        {
          type: 'open',
          target: { kind: 'section', section: 'values' },
          accepted: base,
        },
      ],
      openPeople(base),
    );
    expect(people).toMatchObject({ kind: 'open', target: { kind: 'people' } });
    expect(planSectionSave(people, base, 'values', yours(base))).toEqual({
      kind: 'busy',
    });
    const { attempt } = sendPeople(people);
    expect(
      run(
        [
          { type: 'submit', attempt },
          { type: 'accepted', attempt },
        ],
        people,
      ),
    ).toEqual({
      kind: 'closed',
      feedback: { kind: 'saved', entry: 'people' },
    });
  });

  test('sends its whole snapshot at the revision it opened from; an unchanged roster is not sent', () => {
    const base = accepted();
    const people = openPeople(base);
    const snapshot = withMarshal(base);
    expect(planPeopleSave(people, snapshot)).toEqual({
      kind: 'send',
      attempt: { expectedRevision: 3, candidate: expect.any(String) },
      snapshot,
    });
    expect(planPeopleSave(people, base.state.militiaSnapshot)).toEqual({
      kind: 'unchanged',
    });
    expect(planPeopleSave(openValues(base), snapshot)).toEqual({
      kind: 'busy',
    });
  });

  test('a refused Save keeps the entries and says why, even once the militia moved on', () => {
    const base = accepted();
    const people = openPeople(base);
    const { attempt } = sendPeople(people);
    const refused = run(
      [
        { type: 'submit', attempt },
        { type: 'rejected', attempt, message: 'Militia changed.' },
      ],
      people,
    );
    expect(correctionView(refused, base)).toEqual({
      kind: 'editing',
      notice: 'rejected',
      message: 'Militia changed.',
    });
    const moved = withSnapshot(base, (snapshot) => ({
      ...snapshot,
      notoriety: 30,
    }));
    expect(correctionView(refused, moved)).toMatchObject({
      kind: 'editing',
      notice: 'rejected',
    });
  });

  test('an unconfirmed Save the militia now shows closes as matched; otherwise it stays open', () => {
    const base = accepted();
    const people = openPeople(base);
    const { attempt, snapshot } = sendPeople(people);
    const unknown = run(
      [
        { type: 'submit', attempt },
        { type: 'unknown', attempt },
      ],
      people,
    );
    expect(correctionView(unknown, base)).toMatchObject({
      kind: 'editing',
      notice: 'unconfirmed',
    });
    expect(
      correctionView(
        unknown,
        withSnapshot(base, () => snapshot),
      ),
    ).toEqual({
      kind: 'closed',
      feedback: { kind: 'matched', entry: 'people' },
    });
    expect(
      correctionView(
        unknown,
        withSnapshot(base, (latest) => ({ ...latest, notoriety: 30 })),
      ),
    ).toMatchObject({ kind: 'editing', notice: 'unconfirmed' });
  });
});

describe('settling an unconfirmed Save', () => {
  test('a retry refused because the first Save was applied closes as matched, not as a conflict', () => {
    const base = accepted();
    const open = openValues(base);
    const first = send(open, base);
    const unknown = run(
      [
        { type: 'submit', attempt: first.attempt },
        { type: 'unknown', attempt: first.attempt },
      ],
      open,
    );
    // Saved again before the first write was observed; refused as stale.
    const retry = send(unknown, base);
    const refused = run(
      [
        { type: 'submit', attempt: retry.attempt },
        { type: 'rejected', attempt: retry.attempt, message: null },
      ],
      unknown,
    );
    const applied = {
      ...base,
      revision: 4,
      state: { ...base.state, militiaSnapshot: first.snapshot },
    };
    expect(correctionView(refused, applied)).toEqual({
      kind: 'closed',
      feedback: { kind: 'matched', entry: 'values' },
    });
  });

  test('once settled, the correction closes and the page is free for the next one', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const reconciled = run(
      [
        { type: 'submit', attempt },
        { type: 'unknown', attempt },
        { type: 'reconciled', feedback: { kind: 'matched', entry: 'values' } },
      ],
      open,
    );
    expect(reconciled).toEqual({
      kind: 'closed',
      feedback: { kind: 'matched', entry: 'values' },
    });
    expect(
      correctionReducer(reconciled, {
        type: 'open',
        target: { kind: 'people' },
        accepted: base,
      }),
    ).toMatchObject({ kind: 'open' });
  });
});
