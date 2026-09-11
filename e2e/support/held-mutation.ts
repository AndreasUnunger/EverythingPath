import type { Page } from '@playwright/test';
import { z } from 'zod';

const mutationHeader = z.object({
  type: z.literal('Mutation'),
  udfPath: z.string(),
});

// Keep real authentication, queries and server responses flowing while a user
// edit remains in flight. No provider message is written to an artifact.
export async function controlNextDraftEdit(page: Page, convexUrl: string) {
  let armed = false;
  let release: (() => void) | undefined;
  let captured: (() => void) | undefined;
  await page.routeWebSocket(
    (url) => url.hostname === new URL(convexUrl).hostname,
    (socket) => {
      const server = socket.connectToServer();
      socket.onMessage((message) => {
        let value: unknown;
        try {
          value = JSON.parse(message.toString()) as unknown;
        } catch {
          server.send(message);
          return;
        }
        const header = mutationHeader.safeParse(value);
        if (
          armed &&
          header.success &&
          header.data.udfPath === 'canonicalDraftPersistence:edit'
        ) {
          armed = false;
          release = () => server.send(message);
          captured?.();
        } else server.send(message);
      });
    },
  );
  return {
    hold() {
      if (armed || release) throw new Error('An edit is already held');
      armed = true;
      return new Promise<void>((resolve) => {
        captured = resolve;
      });
    },
    release() {
      release?.();
      release = undefined;
      captured = undefined;
      armed = false;
    },
  };
}
