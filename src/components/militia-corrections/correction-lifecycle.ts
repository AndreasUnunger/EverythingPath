import {
  weeklySourceKey,
  type CanonicalWeekState,
} from '~/lib/canonical-weekly-source';
import {
  mergeSection,
  sectionKey,
  type MilitiaEntryKey,
  type MilitiaSectionKey,
  type SectionValue,
} from '~/lib/militia-correction-sections';

// One local Militia Correction on this device: which section is open, the
// accepted section it started from, and what became of its last Save. The
// latest accepted militia is never stored here; every view is derived from
// it, so remote changes, a new week and a delayed acknowledgement are
// reconciled when they are observed. Other devices are never locked.

/** The newest accepted militia this device has observed. */
export type AcceptedMilitia = {
  revision: number;
  /** The open week's draft; a new one means the week changed. */
  draftId: string;
  state: CanonicalWeekState;
};

export type CorrectionTarget =
  | { kind: 'section'; section: MilitiaSectionKey }
  // The temporary People & officers fallback (roster and officer roles)
  // until Characters & officers replaces it. It keeps the old editor's
  // revision-bound save: its whole snapshot is sent against the revision it
  // opened from and is refused if the militia changed, never merged.
  | { kind: 'people' };

type Captured = {
  revision: number;
  draftId: string;
  week: number;
  /** Structural identity of the section when Correct was pressed. */
  section: string;
};

/** One Save: the revision it was sent against and the section it wrote. */
export type SaveAttempt = { expectedRevision: number; candidate: string };

type Status =
  | { kind: 'editing'; notice: 'unchanged' | null }
  | { kind: 'conflict' }
  | { kind: 'saving'; attempt: SaveAttempt }
  | { kind: 'rejected'; attempt: SaveAttempt; message: string | null }
  | { kind: 'unknown'; attempt: SaveAttempt };

export type Feedback = { kind: 'saved' | 'matched'; entry: MilitiaEntryKey };

export type Correction =
  | { kind: 'closed'; feedback: Feedback | null }
  | {
      kind: 'open';
      target: CorrectionTarget;
      captured: Captured;
      status: Status;
    };

export type CorrectionAction =
  | { type: 'open'; target: CorrectionTarget; accepted: AcceptedMilitia }
  | { type: 'restart'; accepted: AcceptedMilitia }
  | { type: 'cancel' }
  | { type: 'conflict' }
  | { type: 'unchanged' }
  | { type: 'submit'; attempt: SaveAttempt }
  | { type: 'accepted'; attempt: SaveAttempt }
  | { type: 'rejected'; attempt: SaveAttempt; message: string | null }
  | { type: 'unknown'; attempt: SaveAttempt }
  // The newest militia settled the open correction (see `correctionView`).
  | { type: 'reconciled'; feedback: Feedback };

export const closedCorrection: Correction = { kind: 'closed', feedback: null };

type Snapshot = CanonicalWeekState['militiaSnapshot'];
// Everything the People & officers fallback edits: roster people, officer
// roles and the team managers a roster removal clears.
const rosterKey = (snapshot: Snapshot) => weeklySourceKey(snapshot.roster);
const targetKey = (target: CorrectionTarget, snapshot: Snapshot) =>
  target.kind === 'section'
    ? sectionKey(target.section, snapshot)
    : rosterKey(snapshot);

function capture(
  target: CorrectionTarget,
  accepted: AcceptedMilitia,
): Captured {
  return {
    revision: accepted.revision,
    draftId: accepted.draftId,
    week: accepted.state.week,
    section: targetKey(target, accepted.state.militiaSnapshot),
  };
}

const entryOf = (target: CorrectionTarget): MilitiaEntryKey =>
  target.kind === 'section' ? target.section : 'people';

const sameAttempt = (status: Status, attempt: SaveAttempt) =>
  'attempt' in status &&
  status.attempt.expectedRevision === attempt.expectedRevision &&
  status.attempt.candidate === attempt.candidate;

export function correctionReducer(
  state: Correction,
  action: CorrectionAction,
): Correction {
  if (action.type === 'open')
    return state.kind === 'open'
      ? state
      : {
          kind: 'open',
          target: action.target,
          captured: capture(action.target, action.accepted),
          status: { kind: 'editing', notice: null },
        };
  if (state.kind === 'closed') return state;
  const saving = state.status.kind === 'saving';
  switch (action.type) {
    case 'restart':
      // A new correction from the newest facts: the caller also clears the
      // fields and the reason.
      if (saving) return state;
      return {
        ...state,
        captured: capture(state.target, action.accepted),
        status: { kind: 'editing', notice: null },
      };
    case 'cancel':
      return saving ? state : closedCorrection;
    case 'conflict':
      return saving ? state : { ...state, status: { kind: 'conflict' } };
    case 'unchanged':
      return saving
        ? state
        : { ...state, status: { kind: 'editing', notice: 'unchanged' } };
    case 'submit':
      return saving
        ? state
        : { ...state, status: { kind: 'saving', attempt: action.attempt } };
    case 'accepted':
      return sameAttempt(state.status, action.attempt)
        ? {
            kind: 'closed',
            feedback: { kind: 'saved', entry: entryOf(state.target) },
          }
        : state;
    case 'rejected':
      return sameAttempt(state.status, action.attempt)
        ? {
            ...state,
            status: {
              kind: 'rejected',
              attempt: action.attempt,
              message: action.message,
            },
          }
        : state;
    case 'unknown':
      return sameAttempt(state.status, action.attempt)
        ? { ...state, status: { kind: 'unknown', attempt: action.attempt } }
        : state;
    case 'reconciled':
      return saving ? state : { kind: 'closed', feedback: action.feedback };
  }
}

export type CorrectionView =
  | { kind: 'closed'; feedback: Feedback | null }
  | {
      kind: 'editing';
      /**
       * `retry`: the militia changed while saving but not in this section;
       * `unconfirmed`: the last Save may not have been applied and the
       * militia does not show it; `rejected`: refused with `message`.
       */
      notice: 'unchanged' | 'retry' | 'unconfirmed' | 'rejected' | null;
      message: string | null;
    }
  | { kind: 'saving' }
  | { kind: 'conflict' }
  | { kind: 'weekChanged' };

const editing = (
  notice: Extract<CorrectionView, { kind: 'editing' }>['notice'] = null,
  message: string | null = null,
): CorrectionView => ({ kind: 'editing', notice, message });

// The People & officers fallback against the newest militia. Its Save is
// bound to the revision it opened from, so a stale one is refused by the
// server rather than merged or detected here as a conflict. An unconfirmed
// Save the militia now shows is settled; nothing is replayed.
function peopleView(
  status: Exclude<Status, { kind: 'saving' }>,
  accepted: AcceptedMilitia,
): CorrectionView {
  if (status.kind === 'editing') return editing(status.notice);
  if (status.kind === 'conflict') return editing();
  if (
    accepted.revision !== status.attempt.expectedRevision &&
    rosterKey(accepted.state.militiaSnapshot) === status.attempt.candidate
  )
    return { kind: 'closed', feedback: { kind: 'matched', entry: 'people' } };
  return status.kind === 'rejected'
    ? editing('rejected', status.message)
    : editing('unconfirmed');
}

// What the open correction means against the newest accepted militia.
export function correctionView(
  state: Correction,
  accepted: AcceptedMilitia,
): CorrectionView {
  if (state.kind === 'closed') return state;
  const { status, captured, target } = state;
  if (status.kind === 'saving') return { kind: 'saving' };
  if (target.kind === 'people') return peopleView(status, accepted);
  if (
    accepted.draftId !== captured.draftId ||
    accepted.state.week !== captured.week
  )
    return { kind: 'weekChanged' };
  const latest = sectionKey(target.section, accepted.state.militiaSnapshot);
  const changed = latest !== captured.section;
  if (status.kind === 'editing') return editing(status.notice);
  if (status.kind === 'conflict') return { kind: 'conflict' };
  // Saves are bound to their revision, so saving again can never apply the
  // same correction twice. Until a newer revision is observed, a Save that
  // failed or went unconfirmed has not been applied.
  if (accepted.revision === status.attempt.expectedRevision)
    return status.kind === 'rejected'
      ? editing('rejected', status.message)
      : editing('unconfirmed');
  // The militia moved on. If it now shows this correction (an earlier
  // unconfirmed Save was applied), there is nothing left to save; the reason
  // is not claimed as stored.
  if (latest === status.attempt.candidate)
    return {
      kind: 'closed',
      feedback: { kind: 'matched', entry: target.section },
    };
  if (changed) return { kind: 'conflict' };
  // A refusal against an older revision was a race with another section's
  // write: retry against the newest militia.
  return editing(status.kind === 'rejected' ? 'retry' : 'unconfirmed');
}

export type SavePlan =
  | { kind: 'busy' }
  | { kind: 'conflict' }
  | { kind: 'unchanged' }
  | {
      kind: 'send';
      attempt: SaveAttempt;
      snapshot: CanonicalWeekState['militiaSnapshot'];
    };

// The People & officers fallback sends the whole snapshot it edited against
// the revision it opened from, as the old full editor did: a militia changed
// meanwhile refuses it, and it is never merged onto newer facts.
export function planPeopleSave(
  state: Correction,
  snapshot: Snapshot,
): SavePlan {
  if (
    state.kind !== 'open' ||
    state.target.kind !== 'people' ||
    state.status.kind === 'saving'
  )
    return { kind: 'busy' };
  const candidate = rosterKey(snapshot);
  if (candidate === state.captured.section) return { kind: 'unchanged' };
  return {
    kind: 'send',
    attempt: { expectedRevision: state.captured.revision, candidate },
    snapshot,
  };
}

// Save merges the player's section onto the newest accepted militia and
// sends it against the newest revision, unless another player changed this
// section since Correct (even another row of it), which is a conflict.
export function planSectionSave<K extends MilitiaSectionKey>(
  state: Correction,
  accepted: AcceptedMilitia,
  section: K,
  yours: SectionValue<K>,
): SavePlan {
  if (state.kind !== 'open' || state.target.kind !== 'section')
    return { kind: 'busy' };
  const view = correctionView(state, accepted);
  if (view.kind !== 'editing' && view.kind !== 'conflict')
    return { kind: 'busy' };
  const latest = accepted.state.militiaSnapshot;
  const current = sectionKey(section, latest);
  if (view.kind === 'conflict' || current !== state.captured.section)
    return { kind: 'conflict' };
  const snapshot = mergeSection(section, latest, yours);
  const candidate = sectionKey(section, snapshot);
  if (candidate === current) return { kind: 'unchanged' };
  return {
    kind: 'send',
    attempt: { expectedRevision: accepted.revision, candidate },
    snapshot,
  };
}
