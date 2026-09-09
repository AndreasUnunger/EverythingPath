import { actionChoiceEvents } from './weekly-draft-facts';
import {
  weeklyDraftSchema,
  weeklyDraftEditSchema,
  type WeeklyDraft,
  type WeeklyDraftEdit,
  type WeekStartFacts,
} from './weekly-draft-contract';

export function createWeeklyDraft(input: {
  draftId: string;
  week: number;
  context: WeekStartFacts;
  slotIds: string[];
}): WeeklyDraft {
  return weeklyDraftSchema.parse({
    draftId: input.draftId,
    week: input.week,
    context: {
      ...input.context,
      persistentPhaseEligible: input.context.carriedEvents.length > 0,
    },
    revision: 0,
    activity: {
      slots: input.slotIds.map((slotId) => ({ slotId, choice: null })),
    },
  });
}
export function editWeeklyDraft(
  draft: WeeklyDraft,
  input: WeeklyDraftEdit,
): { ok: true; draft: WeeklyDraft } | { ok: false; error: string } {
  const parsed = weeklyDraftEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_edit' };
  const edit = parsed.data;
  const source = weeklyDraftSchema.safeParse(draft);
  if (!source.success) return { ok: false, error: 'invalid_draft' };
  const next = source.data;
  switch (edit.kind) {
    case 'add_slot':
      next.activity.slots.push({ slotId: edit.slotId, choice: null });
      break;
    case 'upkeep':
      next.upkeep = edit.inputs;
      break;
    case 'operating_settlement':
      if (edit.settlementId === null)
        delete next.activity.operatingSettlementId;
      else next.activity.operatingSettlementId = edit.settlementId;
      break;
    case 'consumables':
      next.activity.consumableIds = edit.consumableIds;
      break;
    case 'event_chance':
      if (edit.roll === null) delete next.event.chanceRoll;
      else next.event.chanceRoll = edit.roll;
      break;
    case 'event_tree':
      next.event.occurrences = edit.occurrences;
      break;
    case 'persistent_decision': {
      const event = currentEvent(next, edit.decision.eventId);
      if (event) {
        event.persistentDecision = edit.decision;
        break;
      }
      next.persistent.decisions = next.persistent.decisions
        .filter((value) => value.eventId !== edit.decision.eventId)
        .concat(edit.decision);
      break;
    }
    case 'clear_persistent_decision': {
      const event = currentEvent(next, edit.eventId);
      if (event) delete event.persistentDecision;
      next.persistent.decisions = next.persistent.decisions.filter(
        (value) => value.eventId !== edit.eventId,
      );
      break;
    }
    case 'acknowledge':
      next.acknowledgements = next.acknowledgements
        .filter(
          (value) =>
            value.acknowledgementId !== edit.acknowledgement.acknowledgementId,
        )
        .concat(edit.acknowledgement);
      break;
    case 'clear_acknowledgement':
      next.acknowledgements = next.acknowledgements.filter(
        (value) => value.acknowledgementId !== edit.acknowledgementId,
      );
      break;
    case 'rules_exception':
      next.rulesExceptions = next.rulesExceptions
        .filter((value) => value.exceptionId !== edit.exception.exceptionId)
        .concat(edit.exception);
      break;
    case 'clear_rules_exception':
      next.rulesExceptions = next.rulesExceptions.filter(
        (value) => value.exceptionId !== edit.exceptionId,
      );
      break;
    case 'table_adjustments':
      next.tableAdjustments = edit.adjustments;
      break;
    case 'receive_order':
      if (
        next.orderReceipts.some((receipt) => receipt.orderId === edit.orderId)
      )
        return { ok: false, error: 'already_received' };
      next.orderReceipts.push({
        orderId: edit.orderId,
        receivedDay: edit.receivedDay,
        acknowledgementId: edit.acknowledgementId,
      });
      break;
    case 'clear_receipt':
      next.orderReceipts = next.orderReceipts.filter(
        (receipt) => receipt.orderId !== edit.orderId,
      );
      break;
    default: {
      const error = editActionSlot(next, edit);
      if (error) return { ok: false, error };
    }
  }
  next.revision++;
  const result = weeklyDraftSchema.safeParse(next);
  return result.success
    ? { ok: true, draft: result.data }
    : { ok: false, error: 'invalid_draft' };
}

type ActionSlotEdit = Extract<
  WeeklyDraftEdit,
  { kind: 'stage' | 'replace' | 'detail' | 'clear' | 'move' | 'swap' }
>;
function editActionSlot(
  next: WeeklyDraft,
  edit: ActionSlotEdit,
): string | undefined {
  const slot = next.activity.slots.find(
    (slot) =>
      slot.slotId === ('slotId' in edit ? edit.slotId : edit.fromSlotId),
  );
  if (!slot) return 'unknown_slot';
  if (edit.kind === 'stage') {
    if (slot.choice) return 'occupied_slot';
  } else if (slot.choice?.choiceId !== edit.choiceId) {
    return 'obsolete_choice';
  }
  switch (edit.kind) {
    case 'stage':
    case 'replace':
      if (
        next.activity.slots.some(
          (s) => s.choice?.choiceId === edit.choice.choiceId,
        )
      )
        return 'duplicate_choice';
      slot.choice = edit.choice;
      break;
    case 'detail':
      if (
        edit.choice.choiceId !== edit.choiceId ||
        edit.choice.actionId !== slot.choice?.actionId
      )
        return 'choice_mismatch';
      slot.choice = edit.choice;
      break;
    case 'clear':
      slot.choice = null;
      break;
    case 'move':
    case 'swap': {
      const target = next.activity.slots.find(
        (s) => s.slotId === edit.toSlotId,
      );
      if (!target) return 'unknown_slot';
      if (target === slot) return 'same_slot';
      if (edit.kind === 'move' && target.choice) return 'occupied_slot';
      if (
        edit.kind === 'swap' &&
        target.choice?.choiceId !== edit.otherChoiceId
      )
        return 'obsolete_choice';
      [slot.choice, target.choice] = [target.choice, slot.choice];
      break;
    }
  }
}

function currentEvent(draft: WeeklyDraft, eventId: string) {
  return draft.event.occurrences
    .concat(
      draft.activity.slots.flatMap((slot) => actionChoiceEvents(slot.choice)),
    )
    .find((event) => event.eventId === eventId);
}
