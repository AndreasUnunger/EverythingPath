import type { Page } from '@playwright/test';

/** Timing only: every delivered frame is unchanged and every write runs in Convex. */
export async function controlTransport(page: Page, convexUrl: string) {
  type Frame = string | Buffer;
  type Fault = {
    type: 'Mutation' | 'MutationResponse';
    drop: boolean;
    observed: boolean;
    requestId?: number;
    queued: (() => void)[];
  };
  let fault: Fault | undefined;
  const host = new URL(convexUrl).host;
  await page.routeWebSocket(
    (url) => url.protocol === 'wss:' && url.host === host,
    (socket) => {
      const server = socket.connectToServer();
      const forward = (
        frame: Frame,
        direction: 'Mutation' | 'MutationResponse',
        send: (frame: Frame) => void,
      ) => {
        const active = fault;
        let message: { type?: unknown; requestId?: unknown } = {};
        try {
          const parsed: unknown = JSON.parse(frame.toString());
          if (parsed && typeof parsed === 'object') message = parsed;
        } catch {
          // Non-protocol frames pass through unchanged.
        }
        if (
          active?.type === 'MutationResponse' &&
          direction === 'Mutation' &&
          message.type === 'Mutation' &&
          active.requestId === undefined &&
          typeof message.requestId === 'number'
        )
          active.requestId = message.requestId;
        if (active?.type === direction) {
          if (active.observed && !active.drop) {
            active.queued.push(() => send(frame));
            return;
          }
          if (
            !active.observed &&
            message.type === active.type &&
            (active.type === 'Mutation' ||
              (active.requestId !== undefined &&
                message.requestId === active.requestId))
          ) {
            active.observed = true;
            if (!active.drop) active.queued.push(() => send(frame));
            return;
          }
        }
        send(frame);
      };
      socket.onMessage((frame) =>
        forward(frame, 'Mutation', (message) => server.send(message)),
      );
      server.onMessage((frame) =>
        forward(frame, 'MutationResponse', (message) => socket.send(message)),
      );
    },
  );
  return {
    next(mode: 'delay-request' | 'delay-response' | 'drop-acknowledgement') {
      if (fault) throw new Error('Finish the active transport control first');
      const active: Fault = {
        type: mode === 'delay-request' ? 'Mutation' : 'MutationResponse',
        drop: mode === 'drop-acknowledgement',
        observed: false,
        queued: [],
      };
      fault = active;
      return {
        observed: () => active.observed,
        release: () => {
          if (fault !== active) return;
          fault = undefined;
          for (const send of active.queued.splice(0)) send();
        },
      };
    },
  };
}
