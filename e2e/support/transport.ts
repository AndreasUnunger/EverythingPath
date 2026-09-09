import type { Page } from '@playwright/test';

type Frame = string | Buffer;
type Fault = {
  type: 'Mutation' | 'MutationResponse';
  drop: boolean;
  observed: boolean;
  requestId?: number;
  queued: (() => void)[];
};
type ProtocolMessage = { type?: unknown; requestId?: unknown };

function parseFrame(frame: Frame): ProtocolMessage {
  try {
    const parsed: unknown = JSON.parse(frame.toString());
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Non-protocol frames pass through unchanged.
  }
  return {};
}

function observeRequest(
  active: Fault,
  direction: Fault['type'],
  message: ProtocolMessage,
) {
  if (
    active.type === 'MutationResponse' &&
    direction === 'Mutation' &&
    message.type === 'Mutation' &&
    active.requestId === undefined &&
    typeof message.requestId === 'number'
  )
    active.requestId = message.requestId;
}

function matchesFault(active: Fault, message: ProtocolMessage) {
  return (
    message.type === active.type &&
    (active.type === 'Mutation' ||
      (active.requestId !== undefined &&
        message.requestId === active.requestId))
  );
}

function interceptFrame(
  active: Fault,
  message: ProtocolMessage,
  send: () => void,
) {
  if (active.observed && !active.drop) {
    active.queued.push(send);
    return true;
  }
  if (!active.observed && matchesFault(active, message)) {
    active.observed = true;
    if (!active.drop) active.queued.push(send);
    return true;
  }
  return false;
}

/** Timing only: every delivered frame is unchanged and every write runs in Convex. */
export async function controlTransport(page: Page, convexUrl: string) {
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
        if (active) {
          const message = parseFrame(frame);
          observeRequest(active, direction, message);
          if (
            active.type === direction &&
            interceptFrame(active, message, () => send(frame))
          )
            return;
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
