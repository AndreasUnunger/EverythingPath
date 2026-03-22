import { describe, expect, it } from 'vitest';
import {
  mergeActivityRollDraftWithServer,
  toActivityRollDraft,
} from '~/components/week-board/activity-roll-sections';

describe('activity roll draft merging', () => {
  it('keeps locally edited values when stale server updates arrive', () => {
    const previousServerDraft = toActivityRollDraft({
      earnGoldCheckTotal: 1,
    });
    const currentDraft = {
      ...previousServerDraft,
      earnGoldCheckTotal: '12',
    };
    const nextServerDraft = toActivityRollDraft({
      earnGoldCheckTotal: 1,
    });

    const merged = mergeActivityRollDraftWithServer({
      currentDraft,
      previousServerDraft,
      nextServerDraft,
    });

    expect(merged.earnGoldCheckTotal).toBe('12');
  });

  it('accepts newer server values when local draft was not changed', () => {
    const previousServerDraft = toActivityRollDraft({
      earnGoldCheckTotal: 1,
    });
    const currentDraft = { ...previousServerDraft };
    const nextServerDraft = toActivityRollDraft({
      earnGoldCheckTotal: 15,
    });

    const merged = mergeActivityRollDraftWithServer({
      currentDraft,
      previousServerDraft,
      nextServerDraft,
    });

    expect(merged.earnGoldCheckTotal).toBe('15');
  });
});
