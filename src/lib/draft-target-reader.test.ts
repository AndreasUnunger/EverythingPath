import { expect, test } from 'vitest';
import { createWeeklyDraft } from './weekly-draft';
import {
  openObservation,
  type DraftTargetPage,
} from './weekly-draft-persistence-contract';
import { createDraftTargetReader } from './draft-target-reader';
const draft = createWeeklyDraft({
  draftId: 'pagination',
  week: 1,
  slotIds: [],
  context: {
    firstMilitiaWeek: true,
    startDay: 0,
    uneventfulCarry: false,
    carriedEvents: [],
    queuedEffects: [],
    orders: [],
    lastBuyoffWeek: null,
  },
});
const head = (revision: number) => openObservation({ ...draft, revision });
const page = (
  revision: number,
  target: string,
  isDone: boolean,
): DraftTargetPage => ({
  restart: false,
  observation: head(revision),
  page: [{ target, revision }],
  isDone,
  continueCursor: `${revision}-${target}`,
});

test('target hydration discards mixed revision pages and retains cleared-target tombstones across deltas', async () => {
  const pages = [
    page(2, 'discarded', false),
    page(3, 'changed-mid-page', true),
    page(3, 'cleared-ack', false),
    page(3, 'other', true),
    page(4, 'new', true),
  ];
  const requests: { afterRevision: number; cursor: string | null }[] = [];
  const read = createDraftTargetReader(async (request) => {
    requests.push(request);
    const result = pages.shift();
    if (!result) throw Error('Unexpected extra page');
    return result;
  });
  expect((await read(head(2))).targetRevisions).toEqual([
    { target: 'cleared-ack', revision: 3 },
    { target: 'other', revision: 3 },
  ]);
  expect(requests.map((request) => request.cursor)).toEqual([
    null,
    '2-discarded',
    null,
    '3-cleared-ack',
  ]);
  expect((await read(head(4))).targetRevisions).toEqual([
    { target: 'cleared-ack', revision: 3 },
    { target: 'other', revision: 3 },
    { target: 'new', revision: 4 },
  ]);
  expect(requests.at(-1)?.afterRevision).toBe(3);
  expect((await read(head(1))).revision).toBe(4);
  const exposed = await read(head(4));
  exposed.targetRevisions.length = 0;
  expect((await read(head(4))).targetRevisions).toHaveLength(3);
  expect(pages).toHaveLength(0);
});

test('closed observation is terminal even if an earlier open notification arrives later', async () => {
  let calls = 0;
  const closed = { ...head(2), status: 'closed' as const, draft: null };
  const read = createDraftTargetReader(async () => {
    calls++;
    return {
      ...page(2, 'a', true),
      observation: calls === 1 ? closed : head(2),
    };
  });
  expect((await read(closed)).status).toBe('closed');
  expect((await read(head(2))).status).toBe('closed');
  expect(calls).toBe(1);
});

test('repeated mid-pagination changes fail within a bounded number of restarts', async () => {
  let calls = 0;
  const read = createDraftTargetReader(async () =>
    page(++calls, `target-${calls}`, calls > 20),
  );
  await expect(read(head(0))).rejects.toThrow(
    'changed during target hydration',
  );
  expect(calls).toBeLessThanOrEqual(8);
});
