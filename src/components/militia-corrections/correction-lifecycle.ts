import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
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
  // The temporary full correction editor, opened from a page entry that has
  // no section editor yet. It keeps its own revision-bound save.
  | { kind: 'full'; entry: MilitiaEntryKey };

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
  | { type: 'fullSaved' };

export const closedCorrection: Correction = { kind: 'closed', feedback: null };

function capture(
  target: CorrectionTarget,
  accepted: AcceptedMilitia,
): Captured {
  return {
    revision: accepted.revision,
    draftId: accepted.draftId,
    week: accepted.state.week,
    section:
      target.kind === 'section'
        ? sectionKey(target.section, accepted.state.militiaSnapshot)
        : '',
  };
}

const entryOf = (target: CorrectionTarget): MilitiaEntryKey =>
  target.kind === 'section' ? target.section : target.entry;

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
    case 'fullSaved':
      return {
        kind: 'closed',
        feedback: { kind: 'saved', entry: entryOf(state.target) },
      };
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
  /** Waiting to observe the militia after a Save that was not accepted. */
  | { kind: 'checking' }
  | { kind: 'conflict' }
  | { kind: 'weekChanged' };

const editing = (
  notice: Extract<CorrectionView, { kind: 'editing' }>['notice'] = null,
  message: string | null = null,
): CorrectionView => ({ kind: 'editing', notice, message });

// What the open correction means against the newest accepted militia.
export function correctionView(
  state: Correction,
  accepted: AcceptedMilitia,
): CorrectionView {
  if (state.kind === 'closed') return state;
  const { status, captured, target } = state;
  if (status.kind === 'saving') return { kind: 'saving' };
  if (target.kind === 'full') return editing();
  if (
    accepted.draftId !== captured.draftId ||
    accepted.state.week !== captured.week
  )
    return { kind: 'weekChanged' };
  const latest = sectionKey(target.section, accepted.state.militiaSnapshot);
  const changed = latest !== captured.section;
  switch (status.kind) {
    case 'editing':
      return editing(status.notice);
    case 'conflict':
      return { kind: 'conflict' };
    case 'rejected':
      // A refusal against a revision that is no longer the newest was a
      // race with another write: reconcile instead of reporting it.
      if (accepted.revision === status.attempt.expectedRevision)
        return editing('rejected', status.message);
      return changed ? { kind: 'conflict' } : editing('retry');
    case 'unknown':
      // Saves are bound to their revision, so saving again can never apply
      // the same correction twice. Until a newer revision is observed the
      // earlier Save has not been applied.
      if (accepted.revision === status.attempt.expectedRevision)
        return editing('unconfirmed');
      if (latest === status.attempt.candidate)
        return {
          kind: 'closed',
          feedback: { kind: 'matched', entry: target.section },
        };
      return changed ? { kind: 'conflict' } : editing('unconfirmed');
  }
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
