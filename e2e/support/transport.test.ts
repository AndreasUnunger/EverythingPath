// @vitest-environment node
import type { Page, WebSocketRoute } from '@playwright/test';
import { expect, test, vi } from 'vitest';
import { controlTransport } from './transport';

async function transport() {
  const server = {
    send: vi.fn<WebSocketRoute['send']>(),
    onMessage: vi.fn<WebSocketRoute['onMessage']>(),
  };
  const socket = {
    send: vi.fn<WebSocketRoute['send']>(),
    onMessage: vi.fn<WebSocketRoute['onMessage']>(),
    connectToServer: () => server as unknown as WebSocketRoute,
  };
  const page = { routeWebSocket: vi.fn<Page['routeWebSocket']>() };
  const control = await controlTransport(
    page as unknown as Page,
    'https://preview.convex.cloud',
  );
  const [matches, connect] = page.routeWebSocket.mock.calls[0]!;
  if (typeof matches !== 'function') throw new Error('Expected URL predicate');
  await connect(socket as unknown as WebSocketRoute);
  return {
    ...control,
    matches,
    request: socket.onMessage.mock.calls[0]![0],
    response: server.onMessage.mock.calls[0]![0],
    toServer: server.send,
    toClient: socket.send,
  };
}

const mutation = (requestId: number) =>
  JSON.stringify({ type: 'Mutation', requestId });
const response = (requestId: number) =>
  JSON.stringify({ type: 'MutationResponse', requestId });

test('only the configured secure host is intercepted and ordinary frames pass unchanged', async () => {
  const wire = await transport();
  expect(wire.matches(new URL('wss://preview.convex.cloud/api/sync'))).toBe(
    true,
  );
  expect(wire.matches(new URL('wss://other.convex.cloud/api/sync'))).toBe(
    false,
  );
  expect(wire.matches(new URL('ws://preview.convex.cloud/api/sync'))).toBe(
    false,
  );
  const binary = Buffer.from('not JSON');
  wire.request(binary);
  wire.response('null');
  expect(wire.toServer).toHaveBeenCalledWith(binary);
  expect(wire.toClient).toHaveBeenCalledWith('null');
});

test('delaying a request queues subsequent outgoing frames in order and release is idempotent', async () => {
  const wire = await transport();
  const fault = wire.next('delay-request');
  wire.request('null');
  expect(fault.observed()).toBe(false);
  wire.request(mutation(1));
  wire.request('later frame');
  wire.response(response(0));
  expect(fault.observed()).toBe(true);
  expect(wire.toServer.mock.calls).toEqual([['null']]);
  expect(wire.toClient).toHaveBeenCalledWith(response(0));
  fault.release();
  fault.release();
  expect(wire.toServer.mock.calls).toEqual([
    ['null'],
    [mutation(1)],
    ['later frame'],
  ]);
});

test('delaying a response matches the first outgoing request and preserves incoming order', async () => {
  const wire = await transport();
  const fault = wire.next('delay-response');
  wire.response(response(1));
  wire.request(mutation(1));
  wire.request(mutation(2));
  wire.response(response(0));
  wire.response(response(2));
  expect(fault.observed()).toBe(false);
  wire.response(response(1));
  const binary = Buffer.from('later frame');
  wire.response(binary);
  expect(fault.observed()).toBe(true);
  expect(wire.toClient.mock.calls).toEqual([
    [response(1)],
    [response(0)],
    [response(2)],
  ]);
  fault.release();
  expect(wire.toClient.mock.calls).toEqual([
    [response(1)],
    [response(0)],
    [response(2)],
    [response(1)],
    [binary],
  ]);
  expect(wire.toServer.mock.calls).toEqual([[mutation(1)], [mutation(2)]]);
});

test('dropping an acknowledgement drops only the first matched response and never the write', async () => {
  const wire = await transport();
  const fault = wire.next('drop-acknowledgement');
  wire.request(mutation(1));
  wire.response(response(0));
  expect(fault.observed()).toBe(false);
  wire.response(response(1));
  expect(fault.observed()).toBe(true);
  wire.response(response(1));
  wire.response('later frame');
  fault.release();
  expect(wire.toServer.mock.calls).toEqual([[mutation(1)]]);
  expect(wire.toClient.mock.calls).toEqual([
    [response(0)],
    [response(1)],
    ['later frame'],
  ]);
});

test('only one fault can be armed and an old release cannot clear a new fault', async () => {
  const wire = await transport();
  const first = wire.next('delay-request');
  expect(() => wire.next('delay-response')).toThrow(
    'Finish the active transport control first',
  );
  first.release();
  const second = wire.next('delay-request');
  first.release();
  wire.request(mutation(1));
  expect(second.observed()).toBe(true);
  expect(wire.toServer).not.toHaveBeenCalled();
  second.release();
  expect(wire.toServer).toHaveBeenCalledWith(mutation(1));
});
