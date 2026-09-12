import { createDraftPersistence } from '~/lib/weekly-draft-persistence';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { weeklySourceKey } from '~/lib/canonical-weekly-source';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { AcceptedWeeklyPreview } from '~/lib/weekly-confirmation-contract';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { WorkspaceGateway } from './gateway';
import { phaseView } from './phase-view';
import type { Phase, WeeklyDraftWorkspace } from './types';

export function createWorkspace(gateway: WorkspaceGateway | null) {
  let state: WeeklyDraftWorkspace = {
    status: gateway ? 'loading' : 'unavailable',
  };
  let source: WorkspaceSource | null = null;
  let persistence: ReturnType<typeof createDraftPersistence> | null = null;
  let stopPersistence: () => void = () => undefined;
  let stopSource: () => void = () => undefined;
  let phase: Phase = 'upkeep';
  let feedback: 'idle' | 'saved' | 'failed' = 'idle';
  let pending: { id: number; edit: WeeklyDraftEdit }[] = [];
  let sequence = 0;
  let active = false;
  let reviewed: AcceptedWeeklyPreview | null = null;
  let reviewRequired = false;
  let previewRequest = '';
  let previewGeneration = 0;
  const listeners = new Set<() => void>();
  function publish(next: WeeklyDraftWorkspace) {
    state = next;
    for (const listener of listeners) listener();
  }
  function rebuild() {
    const observed = persistence?.getSnapshot();
    const accepted = observed?.observation?.draft;
    if (!active || !source || !persistence) return;
    if (!accepted || observed.observation?.status !== 'open') {
      publish({ status: 'loading' });
      return;
    }
    let forecast: WeeklyDraft = accepted;
    for (const item of pending) {
      const result = editWeeklyDraft(forecast, item.edit);
      if (result.ok) forecast = result.draft;
    }
    const preview = projectWeeklyDraft({
      revision: forecast,
      militiaSnapshot: source.snapshot,
    });
    const matching =
      reviewed?.reviewed.sourceKey === preview.sourceKey &&
      reviewed.reviewed.sourceRevision === source.sourceRevision &&
      reviewed.reviewed.revision === accepted.revision;
    publish({
      status: 'ready',
      week: accepted.week,
      phaseView: phaseView(phase, forecast, source, preview),
      phases: (
        [
          'upkeep',
          'activity',
          'event',
          'persistent',
          'summary',
        ] satisfies Phase[]
      ).map((value) => ({
        phase: value,
        available:
          value !== 'persistent' || accepted.context.persistentPhaseEligible,
      })),
      feedback: observed.confirming
        ? 'confirming'
        : pending.length || observed.pending
          ? 'pending'
          : feedback,
      canConfirm: Boolean(
        !reviewRequired &&
        matching &&
        reviewed?.status === 'ready' &&
        pending.length === 0 &&
        !observed.pending &&
        !observed.confirming,
      ),
      reviewRequired,
      forecastPending: pending.length > 0 || !matching,
      pendingWork:
        pending.length > 0 || observed.pending > 0 || observed.confirming,
      edit,
      viewPhase,
      confirm,
    });
    if (pending.length || observed.pending || observed.confirming) return;
    const request = weeklySourceKey({
      draft: accepted,
      sourceRevision: source.sourceRevision,
      snapshot: source.snapshot,
    });
    if (request === previewRequest) return;
    previewRequest = request;
    const generation = ++previewGeneration;
    const owner = persistence;
    void owner
      .preview()
      .then((value) => {
        if (
          !active ||
          persistence !== owner ||
          generation !== previewGeneration
        )
          return;
        reviewed = value;
        if (!value) previewRequest = '';
        // A mismatched query waits for the next accepted source observation.
        if (value) rebuild();
      })
      .catch(() => {
        if (active && persistence === owner && generation === previewGeneration)
          publish({ status: 'failed' });
      });
  }
  async function edit(edit: WeeklyDraftEdit): Promise<'accepted' | 'failed'> {
    const owner = persistence;
    if (state.status !== 'ready' || !owner || owner.getSnapshot().confirming)
      return 'failed';
    const item = { id: ++sequence, edit: structuredClone(edit) };
    pending.push(item);
    const saving = owner.edit(item.edit);
    rebuild();
    const result = await saving;
    if (owner === persistence && active) {
      pending = pending.filter((entry) => entry.id !== item.id);
      feedback = result === 'accepted' ? 'saved' : 'failed';
      if (result === 'failed') reviewRequired = true;
      previewRequest = '';
      rebuild();
    }
    return result;
  }
  function viewPhase(next: Phase) {
    if (
      state.status !== 'ready' ||
      !state.phases.some((item) => item.phase === next && item.available)
    )
      return;
    if (next === 'summary' && !state.forecastPending && !state.pendingWork)
      reviewRequired = false;
    phase = next;
    rebuild();
  }
  async function confirm(): Promise<'accepted' | 'failed'> {
    const owner = persistence;
    const review = reviewed;
    if (state.status !== 'ready' || !owner || !review || reviewRequired)
      return 'failed';
    const result = await owner.confirm(review);
    if (active && owner === persistence) {
      feedback = result === 'accepted' ? 'saved' : 'failed';
      reviewRequired = result === 'failed';
      reviewed = null;
      previewRequest = '';
      rebuild();
    }
    return result;
  }
  function receive(next: WorkspaceSource | null) {
    if (!active) return;
    if (!next) {
      stopPersistence();
      persistence?.dispose();
      persistence = null;
      source = null;
      publish({ status: 'unavailable' });
      return;
    }
    if (source?.key.draftId !== next.key.draftId) {
      stopPersistence();
      persistence?.dispose();
      source = next;
      phase = 'upkeep';
      pending = [];
      reviewed = null;
      reviewRequired = false;
      previewRequest = '';
      previewGeneration++;
      const owner = createDraftPersistence(gateway!.transport(next));
      persistence = owner;
      stopPersistence = owner.subscribe(rebuild);
      void owner.ready
        .then(() => {
          if (active && persistence === owner) rebuild();
        })
        .catch(() => {
          if (active && persistence === owner) publish({ status: 'failed' });
        });
    } else if (next.sourceRevision >= source.sourceRevision) source = next;
    rebuild();
  }
  return {
    getSnapshot: () => state,
    subscribe(this: void, listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      active = true;
      if (gateway)
        stopSource = gateway.subscribe(receive, () =>
          publish({ status: 'failed' }),
        );
      return () => {
        active = false;
        stopSource();
        stopPersistence();
        persistence?.dispose();
        persistence = null;
        source = null;
      };
    },
  };
}
