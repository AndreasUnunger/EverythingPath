import type { Page } from '@playwright/test';
import { z } from 'zod';

const observeAdd = z.object({
  type: z.literal('ModifyQuerySet'),
  modifications: z.array(
    z
      .object({
        type: z.literal('Add'),
        udfPath: z.string(),
        args: z.tuple([
          z.object({
            campaignId: z.string(),
            militiaId: z.string(),
            draftId: z.string(),
          }),
        ]),
      })
      .or(z.object({ type: z.string() })),
  ),
});
export type DraftKey = {
  campaignId: string;
  militiaId: string;
  draftId: string;
};

/**
 * Read-only: the key of the open weekly draft this page observes, taken from
 * the page's own first draft-observation subscription. Install before
 * navigating to the Week. Nothing is altered or replayed; the key is the
 * page's own request and never reaches an artifact.
 */
export function observeDraftKey(page: Page) {
  let key: DraftKey | undefined;
  page.on('websocket', (socket) => {
    socket.on('framesent', ({ payload }) => {
      if (key) return;
      try {
        const parsed = observeAdd.safeParse(JSON.parse(payload.toString()));
        if (!parsed.success) return;
        for (const modification of parsed.data.modifications)
          if (
            'udfPath' in modification &&
            modification.udfPath.replace(/\.js$/, '') ===
              'canonicalDraftPersistence:observe'
          )
            key = modification.args[0];
      } catch {
        /* Non-protocol frames are irrelevant. */
      }
    });
  });
  return async () => {
    const deadline = Date.now() + 15_000;
    while (!key && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
    if (!key) throw new Error('The page never observed a weekly draft');
    return key;
  };
}
