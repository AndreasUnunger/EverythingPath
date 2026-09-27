'use client';
import { useMemo, useReducer, useRef, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useCanonicalLedger } from '~/components/use-canonical-ledger';
import type { SetupCharacter } from '~/components/militia-setup/roster';
import { phaseLabels } from '~/components/weekly-draft-workspace/week-frame/labels';
import { weekPath } from '~/lib/campaign-routes';
import { newMilitiaSetup, type MilitiaSetup } from '~/lib/canonical-setup';
import {
  militiaSnapshotSchema,
  type CanonicalWeekState,
} from '~/lib/canonical-weekly-source';
import {
  correctionStagedChoices,
  type StagedChoicePhase,
} from '~/lib/correction-staged-choices';
import {
  MILITIA_ENTRY_LABELS,
  MILITIA_SECTION_KEYS,
  mergeSection,
  militiaEntryForLocation,
  sectionValue,
  type MilitiaEntryKey,
  type MilitiaSectionKey,
} from '~/lib/militia-correction-sections';
import {
  militiaEntryFacts,
  type EntryFacts,
} from '~/lib/militia-section-facts';
import {
  militiaCorrectionSchema,
  setupErrorDescriptors,
  setupWarningDescriptors,
  type SetupErrorDescriptor,
} from '~/lib/setup-validation';
import {
  weeklyDraftSchema,
  type WeeklyDraft,
} from '~/lib/weekly-draft-contract';
import { classifyWriteFailure } from '~/lib/write-outcome';
import {
  closedCorrection,
  correctionReducer,
  correctionView,
  planSectionSave,
  type AcceptedMilitia,
  type CorrectionView,
  type SaveAttempt,
} from './correction-lifecycle';
import {
  correctLabel,
  editingNotice,
  errorSummary,
  feedbackMessage,
  REASON_LABEL,
  reasonError,
  type ErrorSummaryItem,
} from './correction-copy';

// Sections with their own isolated correction. Every other correctable
// section still opens the temporary full editor until its replacement ships.
const SECTION_EDITORS = new Set<MilitiaSectionKey>(['values']);
// The controls of each section editor, for linked errors.
const SECTION_FIELDS: Partial<
  Record<
    MilitiaSectionKey,
    Record<string, { label: string; numeric?: boolean }>
  >
> = {
  values: {
    'state.militiaSnapshot.focus': { label: 'Focus' },
    'state.militiaSnapshot.rank': { label: 'Rank', numeric: true },
    'state.militiaSnapshot.training': { label: 'Training', numeric: true },
    'state.militiaSnapshot.treasuryCopper': {
      label: 'Treasury (copper)',
      numeric: true,
    },
    'state.militiaSnapshot.notoriety': { label: 'Notoriety', numeric: true },
  },
};

export type MilitiaEntryView = {
  key: MilitiaEntryKey;
  label: string;
  /** Correctable sections, the read-only week view, or the temporary fallback. */
  group: 'sections' | 'week' | 'fallback';
  facts: EntryFacts;
  /** Advisory rules warnings for the accepted facts. */
  warnings: string[];
  /** Label of this entry's Correct button; null for read-only entries. */
  correct: string | null;
};

export type AffectedPhase = {
  phase: StagedChoicePhase;
  label: string;
  count: number;
  href: string;
};

export type SectionCorrection = {
  kind: 'section';
  entry: MilitiaSectionKey;
  heading: string;
  form: UseFormReturn<MilitiaSetup>;
  /** Editing, saving, checking, conflict or week changed. */
  view: Exclude<CorrectionView, { kind: 'closed' }>;
  /** Accessible status text for the editing view, or null. */
  notice: string | null;
  /** Advisory warnings for the corrected section against the latest facts. */
  warnings: string[];
  /** Staged choices this correction would leave without their subject. */
  affectsWeek: AffectedPhase[];
  /** Shown once a Save found errors. */
  errors: ErrorSummaryItem[];
  reason: { label: string; error: string | null };
  /** Their latest section and yours, while in conflict. */
  comparison: { theirs: EntryFacts; yours: EntryFacts } | null;
  focusField: (field: string) => void;
  save: () => void;
  cancel: () => void;
  restart: () => void;
};

export type FullCorrection = {
  kind: 'full';
  entry: MilitiaEntryKey;
  heading: string;
  initialValues: MilitiaSetup;
  characters: SetupCharacter[];
  stagedChoiceNotice?: (setup: MilitiaSetup) => string | null;
  onSave: (setup: MilitiaSetup) => Promise<void>;
  cancel: () => void;
};

export type MilitiaCorrections =
  | { status: 'loading' }
  | {
      status: 'ready';
      entries: MilitiaEntryView[];
      selected: MilitiaEntryKey;
      select: (entry: MilitiaEntryKey) => void;
      /** A correction is open: every other entry and Correct is disabled. */
      locked: boolean;
      open: (entry: MilitiaEntryKey) => void;
      correction: SectionCorrection | FullCorrection | null;
      /** Accessible result of the last correction on this device. */
      feedback: string | null;
    };

const setupFrom = (state: CanonicalWeekState, notes = ''): MilitiaSetup => ({
  mode: 'existing',
  phase: 'upkeep',
  notes,
  state,
});

function groupedWarnings(state: CanonicalWeekState) {
  const grouped = new Map<MilitiaEntryKey, string[]>();
  for (const warning of setupWarningDescriptors(setupFrom(state))) {
    const entry = militiaEntryForLocation(warning);
    if (entry)
      grouped.set(entry, [...(grouped.get(entry) ?? []), warning.message]);
  }
  return grouped;
}

function affectedPhases(
  campaignId: string,
  draft: WeeklyDraft | null,
  latest: CanonicalWeekState['militiaSnapshot'],
  candidate: CanonicalWeekState['militiaSnapshot'],
): AffectedPhase[] {
  if (!draft || !militiaSnapshotSchema.safeParse(candidate).success) return [];
  return correctionStagedChoices(draft, latest, candidate).map(
    ({ phase, count }) => ({
      phase,
      count,
      label: phaseLabels[phase],
      href: weekPath(campaignId, phase),
    }),
  );
}

// The Militia page: accepted facts by section, the one local correction and
// its lifecycle. Mount per campaign, militia and organization (keyed), so a
// scope change discards the correction and any late acknowledgement.
export function useMilitiaCorrections({
  campaignId,
  militiaId,
  draftId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  /** The open week's draft, as currently observed. */
  draftId: string;
  organizationId: string;
}): MilitiaCorrections {
  const { ledger, characters, save } = useCanonicalLedger({
    campaignId,
    militiaId,
    organizationId,
  });
  const observation = useQuery(api.canonicalDraftPersistence.observe, {
    campaignId,
    militiaId,
    draftId,
  });
  const [correction, dispatch] = useReducer(
    correctionReducer,
    closedCorrection,
  );
  const [selected, setSelected] = useState<MilitiaEntryKey>('values');
  const [fullBase, setFullBase] = useState<AcceptedMilitia | null>(null);
  const [candidateErrors, setCandidateErrors] = useState<
    SetupErrorDescriptor[]
  >([]);
  // Set synchronously on Save, before validation settles, so a second press
  // can never send the same correction twice.
  const sending = useRef<SaveAttempt | 'validating' | null>(null);
  const form = useForm<MilitiaSetup>({
    resolver: zodResolver(militiaCorrectionSchema),
    defaultValues: newMilitiaSetup('Loyalty'),
  });
  const values = form.watch();
  const names = useMemo(
    () =>
      new Map(
        characters.map((character) => [character.characterId, character.name]),
      ),
    [characters],
  );
  const warnings = useMemo(
    () =>
      ledger
        ? groupedWarnings(ledger.state)
        : new Map<MilitiaEntryKey, string[]>(),
    [ledger],
  );
  if (!ledger) return { status: 'loading' };

  const accepted: AcceptedMilitia = {
    revision: ledger.revision,
    draftId,
    state: ledger.state,
  };
  const parsedDraft =
    observation?.status === 'open'
      ? weeklyDraftSchema.safeParse(observation.draft)
      : null;
  const draft = parsedDraft?.success ? parsedDraft.data : null;
  const view = correctionView(correction, accepted);
  const locked = correction.kind === 'open' && view.kind !== 'closed';

  const entries: MilitiaEntryView[] = (
    [...MILITIA_SECTION_KEYS, 'weekCarried', 'people'] as MilitiaEntryKey[]
  ).map((key) => ({
    key,
    label: MILITIA_ENTRY_LABELS[key],
    group:
      key === 'weekCarried'
        ? 'week'
        : key === 'people'
          ? 'fallback'
          : 'sections',
    facts: militiaEntryFacts(key, ledger.state, names),
    warnings: warnings.get(key) ?? [],
    correct: key === 'weekCarried' ? null : correctLabel(key),
  }));

  function open(entry: MilitiaEntryKey) {
    if (locked || entry === 'weekCarried') return;
    setSelected(entry);
    setCandidateErrors([]);
    if (entry !== 'people' && SECTION_EDITORS.has(entry)) {
      form.reset(setupFrom(accepted.state));
      dispatch({
        type: 'open',
        target: { kind: 'section', section: entry },
        accepted,
      });
      return;
    }
    setFullBase(accepted);
    dispatch({ type: 'open', target: { kind: 'full', entry }, accepted });
  }

  let current: SectionCorrection | FullCorrection | null = null;
  if (correction.kind === 'open' && view.kind !== 'closed') {
    const { target } = correction;
    if (target.kind === 'full' && fullBase) {
      const base = fullBase;
      current = {
        kind: 'full',
        entry: target.entry,
        heading: correctLabel(target.entry),
        initialValues: setupFrom(base.state),
        characters,
        stagedChoiceNotice: draft
          ? (setup) => {
              const affected = correctionStagedChoices(
                draft,
                base.state.militiaSnapshot,
                setup.state.militiaSnapshot,
              );
              if (affected.length === 0) return null;
              const phases = affected
                .map(
                  ({ phase, count }) =>
                    `${phaseLabels[phase]} (${count} ${count === 1 ? 'choice' : 'choices'})`,
                )
                .join(', ');
              return `This correction removes something that choices already staged for the current week use: ${phases}. After saving, review those choices in the week; Upkeep lets you clear a staged decision for a removed team.`;
            }
          : undefined,
        // The existing editor's revision-bound save: a stale full snapshot
        // is refused, never merged.
        onSave: async (setup) => {
          await save({
            expectedRevision: base.revision,
            snapshot: setup.state.militiaSnapshot,
            reason: setup.notes,
          });
          dispatch({ type: 'fullSaved' });
        },
        cancel: () => dispatch({ type: 'cancel' }),
      };
    }
    if (target.kind === 'section') {
      const section = target.section;
      const latest = accepted.state.militiaSnapshot;
      const yours = sectionValue(section, values.state.militiaSnapshot);
      const candidate = mergeSection(section, latest, yours);
      const candidateSetup = setupFrom({
        ...accepted.state,
        militiaSnapshot: candidate,
      });
      const fields = SECTION_FIELDS[section] ?? {};
      const formErrors = Object.keys(form.formState.errors).length > 0;
      const errors = formErrors
        ? setupErrorDescriptors(values, militiaCorrectionSchema)
        : candidateErrors;
      current = {
        kind: 'section',
        entry: section,
        heading: correctLabel(section),
        form,
        view,
        notice: view.kind === 'editing' ? editingNotice(view) : null,
        warnings: setupWarningDescriptors(candidateSetup)
          .filter((warning) => militiaEntryForLocation(warning) === section)
          .map((warning) => warning.message),
        affectsWeek: affectedPhases(campaignId, draft, latest, candidate),
        errors: errorSummary(errors, values, {
          ...fields,
          notes: { label: REASON_LABEL },
        }),
        reason: {
          label: REASON_LABEL,
          error: reasonError(
            values.notes,
            form.formState.errors.notes?.message,
          ),
        },
        comparison:
          view.kind === 'conflict'
            ? {
                theirs: militiaEntryFacts(section, accepted.state, names),
                yours: militiaEntryFacts(
                  section,
                  { ...accepted.state, militiaSnapshot: candidate },
                  names,
                ),
              }
            : null,
        focusField: (field) => form.setFocus(field as never),
        save: () => {
          if (sending.current) return;
          sending.current = 'validating';
          void form
            .handleSubmit(
              (setup) => {
                const plan = planSectionSave(
                  correction,
                  accepted,
                  section,
                  sectionValue(section, setup.state.militiaSnapshot),
                );
                if (plan.kind !== 'send') {
                  sending.current = null;
                  if (plan.kind !== 'busy') dispatch({ type: plan.kind });
                  return;
                }
                const invalid = setupErrorDescriptors(
                  setupFrom(
                    { ...accepted.state, militiaSnapshot: plan.snapshot },
                    setup.notes,
                  ),
                  militiaCorrectionSchema,
                );
                setCandidateErrors(invalid);
                if (invalid.length) {
                  sending.current = null;
                  return;
                }
                const { attempt } = plan;
                sending.current = attempt;
                dispatch({ type: 'submit', attempt });
                save({
                  expectedRevision: attempt.expectedRevision,
                  snapshot: plan.snapshot,
                  reason: setup.notes,
                })
                  .then(
                    () => dispatch({ type: 'accepted', attempt }),
                    (error: unknown) => {
                      const failure = classifyWriteFailure(error);
                      dispatch(
                        failure.kind === 'rejected'
                          ? {
                              type: 'rejected',
                              attempt,
                              message: failure.message,
                            }
                          : { type: 'unknown', attempt },
                      );
                    },
                  )
                  .finally(() => {
                    if (sending.current === attempt) sending.current = null;
                  });
              },
              () => {
                sending.current = null;
              },
            )()
            .catch(() => {
              sending.current = null;
            });
        },
        cancel: () => {
          setCandidateErrors([]);
          dispatch({ type: 'cancel' });
        },
        // A new correction from the newest facts: fields and the reason are
        // cleared, so it must be reviewed again.
        restart: () => {
          form.reset(setupFrom(accepted.state));
          setCandidateErrors([]);
          dispatch({ type: 'restart', accepted });
        },
      };
    }
  }

  const feedback =
    view.kind === 'closed' && view.feedback
      ? feedbackMessage(view.feedback)
      : null;

  return {
    status: 'ready',
    entries,
    selected,
    select: (entry) => {
      if (!locked) setSelected(entry);
    },
    locked,
    open,
    correction: current,
    feedback,
  };
}
