import { militiaSnapshotSchema } from './canonical-weekly-source';
import { draftReferenceRequirements } from './weekly-draft-references';
import type { UpkeepSnapshot } from './rules-upkeep';
import { weeklyDraftSchema, type WeeklyDraft } from './weekly-draft-contract';
import { weeklySourceKey } from './canonical-weekly-source';
import { acceptDraftOperation } from './weekly-draft-consistency';
import {
  draftOperationSchema,
  openObservation,
  DraftRejected,
  type DraftObservation,
  type DraftReceipt,
  type DraftTransport,
  type DraftTargetRevision,
} from './weekly-draft-persistence-contract';

export function createMemoryDraftAuthority(
  initial: WeeklyDraft,
  snapshot: UpkeepSnapshot,
) {
  const source = militiaSnapshotSchema.parse(snapshot);
  let current = weeklyDraftSchema.parse(initial);
  let closed = false;
  let targets: DraftTargetRevision[] = [];
  const revisions = new Map([[current.revision, current]]);
  const operations = new Map<
    string,
    { request: string; receipt: DraftReceipt }
  >();
  const observers = new Set<(value: DraftObservation) => void>();
  const observe = (): DraftObservation =>
    structuredClone(
      closed
        ? {
            draftId: current.draftId,
            revision: current.revision,
            status: 'closed',
            draft: null,
            targetRevisions: targets,
          }
        : openObservation(current, targets),
    );
  const publish = () => {
    for (const next of observers) next(observe());
  };
  const transport: DraftTransport = {
    read: async () => observe(),
    subscribe(next) {
      observers.add(next);
      next(observe());
      return () => observers.delete(next);
    },
    async send(input) {
      const operation = draftOperationSchema.parse(input);
      if (operation.draftId !== current.draftId)
        throw new DraftRejected('Unknown draft');
      const existing = operations.get(operation.operationId);
      if (existing) {
        if (existing.request !== weeklySourceKey(operation))
          throw new DraftRejected('Operation identity reused');
        return { ...structuredClone(existing.receipt), observation: observe() };
      }
      if (closed) throw new DraftRejected('Draft closed');
      const base = revisions.get(operation.baseRevision);
      if (!base) throw new DraftRejected('Unknown revision');
      const accepted = acceptDraftOperation(current, base, targets, operation);
      if (draftReferenceRequirements(accepted.draft, source, source).length)
        throw new DraftRejected('Invalid draft entity reference');
      current = accepted.draft;
      targets = accepted.targetRevisions;
      revisions.set(current.revision, structuredClone(current));
      const receipt = {
        operationId: operation.operationId,
        acceptedRevision: current.revision,
        observation: observe(),
      };
      operations.set(operation.operationId, {
        request: weeklySourceKey(operation),
        receipt,
      });
      publish();
      return receipt;
    },
  };
  return {
    transport,
    close() {
      closed = true;
      revisions.clear();
      publish();
    },
  };
}
