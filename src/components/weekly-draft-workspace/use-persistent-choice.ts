'use client';
import { useState } from 'react';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import {
  decisionEdit,
  endingEdit,
  endingExceptionEdit,
  type PersistentCard,
} from './persistent-sections';
import type { PersistentView } from './types';

type Event = PersistentView['events'][number];
type Exception = Event['exceptions'][number];
export type PersistentEdit = (
  edit: WeeklyDraftEdit,
) => Promise<'accepted' | 'failed'>;

// One carried event's decision cards. Every card but Ended at the table
// writes at once through the shared store. Ended at the table is only local
// intent until a nonempty outcome is saved: the saved decision keeps
// applying meanwhile, and a failed save keeps the form open to retry.
export function usePersistentChoice(event: Event, edit: PersistentEdit) {
  const [endingIntent, setEndingIntent] = useState(false);
  const saved: PersistentCard = event.decision?.kind ?? 'unattempted';
  // Once an ending is saved (here or on another device) the intent is spent.
  if (endingIntent && saved === 'end') setEndingIntent(false);
  const endingUnsaved = endingIntent && saved !== 'end';
  return {
    saved,
    selected: endingUnsaved ? 'end' : saved,
    endingUnsaved,
    choose: (card: PersistentCard) => {
      if (card === 'end') {
        if (saved !== 'end') setEndingIntent(true);
        return;
      }
      setEndingIntent(false);
      const next = decisionEdit(event, card);
      if (next) void edit(next);
    },
    // The outcome is saved first; its reason, when given, only after the
    // ending was accepted. 'reason-failed' means the ending is saved and its
    // Rules Exception still needs its reason.
    saveEnding: async (
      outcome: string,
      reason?: string,
    ): Promise<'accepted' | 'failed' | 'reason-failed'> => {
      const result = await edit(endingEdit(event, outcome));
      if (result !== 'accepted') return result;
      setEndingIntent(false);
      if (!reason?.trim()) return result;
      const recorded = await edit(endingExceptionEdit(event, reason));
      return recorded === 'accepted' ? recorded : 'reason-failed';
    },
    saveException: (exception: Exception, reason: string) =>
      edit({
        kind: 'rules_exception',
        exception: {
          exceptionId: exception.exceptionId,
          subjectId: exception.subjectId,
          ruleId: exception.ruleId,
          reason: reason.trim(),
        },
      }),
    removeException: (exception: Exception) =>
      edit({
        kind: 'clear_rules_exception',
        exceptionId: exception.exceptionId,
      }),
  };
}
