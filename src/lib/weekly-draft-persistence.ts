import {
  rebaseDraftEdit,
  requireUnchangedTargets,
} from './weekly-draft-consistency';
import {
  draftObservationSchema,
  draftReceiptSchema,
  DraftTransportFailure,
  type DraftObservation,
  type DraftTransport,
  type DraftOperation,
} from './weekly-draft-persistence-contract';
import { editWeeklyDraft } from './weekly-draft';
import type { WeeklyDraft, WeeklyDraftEdit } from './weekly-draft-contract';

export function createDraftPersistence(
  transport: DraftTransport,
  options: { operationId?: () => string; retries?: number } = {},
) {
  let observation: DraftObservation | null = null;
  let pending = 0;
  let pendingDraft: WeeklyDraft | null = null;
  let disposed = false;
  let chain = Promise.resolve();
  const ownRevisions = new Set<number>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  function accept(value: DraftObservation) {
    if (disposed) return;
    const next = draftObservationSchema.parse(value);
    if (
      observation &&
      (next.draftId !== observation.draftId ||
        next.revision < observation.revision ||
        observation.status === 'closed')
    )
      return;
    observation = next;
    notify();
  }
  const unsubscribe = transport.subscribe(accept, () => {
    /* A failed read/edit is surfaced through its operation result. */
  });
  const ready = transport.read().then(accept);
  async function send(operation: DraftOperation) {
    for (let attempt = 0; ; attempt++) {
      try {
        return draftReceiptSchema.parse(await transport.send(operation));
      } catch (error) {
        if (
          !(error instanceof DraftTransportFailure) ||
          attempt >= (options.retries ?? 2)
        )
          throw error;
      }
    }
  }
  return {
    ready,
    getSnapshot: () => ({ observation, pending }),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    edit(edit: WeeklyDraftEdit): Promise<'accepted' | 'failed'> {
      const submitted = pendingDraft ?? observation?.draft;
      const observedBaseRevision = observation?.revision;
      const submittedEdit = structuredClone(edit);
      if (submitted) {
        const projected = editWeeklyDraft(submitted, submittedEdit);
        if (projected.ok) pendingDraft = projected.draft;
      }
      const operationId = options.operationId?.() ?? crypto.randomUUID();
      pending++;
      notify();
      const task = chain.then(async (): Promise<'accepted' | 'failed'> => {
        try {
          await ready;
          const current = observation?.draft;
          if (
            disposed ||
            !submitted ||
            !current ||
            observedBaseRevision === undefined ||
            observation?.status !== 'open'
          )
            return 'failed';
          const intent = {
            draftId: current.draftId,
            operationId,
            baseRevision: observedBaseRevision,
            edit: submittedEdit,
          };
          requireUnchangedTargets(
            submitted,
            observation.targetRevisions,
            intent,
            ownRevisions,
          );
          const operation = {
            ...intent,
            baseRevision: current.revision,
            edit: rebaseDraftEdit(submitted, current, submittedEdit),
          };
          const receipt = await send(operation);
          if (receipt.operationId !== operationId) return 'failed';
          ownRevisions.add(receipt.acceptedRevision);
          accept(receipt.observation);
          return 'accepted';
        } catch {
          try {
            accept(await transport.read());
          } catch {
            /* Retain the newest known accepted state. */
          }
          return 'failed';
        } finally {
          pending--;
          if (pending === 0) pendingDraft = null;
          notify();
        }
      });
      chain = task.then(() => undefined);
      return task;
    },
    settled: () => chain,
    dispose() {
      disposed = true;
      unsubscribe();
      listeners.clear();
    },
  };
}
