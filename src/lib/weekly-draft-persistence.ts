import { weeklySourceKey } from './canonical-weekly-source';
import {
  acceptedWeeklyPreviewSchema,
  confirmationReceiptSchema,
  type AcceptedWeeklyPreview,
  type ConfirmationReceipt,
} from './weekly-confirmation-contract';
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
} from './weekly-draft-persistence-contract';
import { editWeeklyDraft } from './weekly-draft';
import type { WeeklyDraft, WeeklyDraftEdit } from './weekly-draft-contract';

export function createDraftPersistence(
  transport: DraftTransport,
  options: { operationId?: () => string; retries?: number } = {},
) {
  let observation: DraftObservation | null = null;
  let pending = 0;
  let confirming = false;
  let acceptedReview: AcceptedWeeklyPreview | null = null;
  let confirmation: ConfirmationReceipt | null = null;
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
  async function retry<T>(request: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await request();
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
    getSnapshot: () => ({
      observation,
      pending,
      confirming,
      confirmation: structuredClone(confirmation),
    }),
    async preview(): Promise<AcceptedWeeklyPreview | null> {
      if (pending || confirming || disposed || !transport.preview) return null;
      await ready;
      const preview = acceptedWeeklyPreviewSchema.parse(
        await transport.preview(),
      );
      if (
        pending ||
        confirming ||
        disposed ||
        observation?.status !== 'open' ||
        preview.reviewed.draftId !== observation.draftId ||
        preview.reviewed.revision !== observation.revision
      )
        return null;
      if (
        acceptedReview &&
        preview.reviewed.sourceRevision < acceptedReview.reviewed.sourceRevision
      )
        return null;
      acceptedReview = structuredClone(preview);
      return preview;
    },
    confirm(review: AcceptedWeeklyPreview): Promise<'accepted' | 'failed'> {
      const parsed = acceptedWeeklyPreviewSchema.safeParse(review);
      if (
        confirming ||
        disposed ||
        observation?.status !== 'open' ||
        !transport.confirm ||
        !parsed.success ||
        parsed.data.status !== 'ready' ||
        !acceptedReview ||
        weeklySourceKey(parsed.data) !== weeklySourceKey(acceptedReview)
      )
        return Promise.resolve('failed');
      const operation = {
        operationId: options.operationId?.() ?? crypto.randomUUID(),
        reviewed: parsed.data.reviewed,
      };
      const confirm = transport.confirm;
      acceptedReview = null;
      confirming = true;
      notify();
      const task = chain.then(async (): Promise<'accepted' | 'failed'> => {
        try {
          await ready;
          if (disposed) return 'failed';
          const receipt = confirmationReceiptSchema.parse(
            await retry(() => confirm(operation)),
          );
          if (receipt.operationId !== operation.operationId) return 'failed';
          confirmation = receipt;
          accept(receipt.observation);
          return 'accepted';
        } catch {
          try {
            accept(await transport.read());
          } catch {
            /* Retain last accepted state. */
          }
          return 'failed';
        } finally {
          confirming = false;
          notify();
        }
      });
      chain = task.then(() => undefined);
      return task;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    edit(edit: WeeklyDraftEdit): Promise<'accepted' | 'failed'> {
      if (confirming || disposed) return Promise.resolve('failed');
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
          const receipt = draftReceiptSchema.parse(
            await retry(() => transport.send(operation)),
          );
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
