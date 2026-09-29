import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchScrollEnd } from './upkeep-layout';

// The settlement touch journey taps only once its pan's scroll has come to
// rest: a tap during the momentum stops the scroll without a click (GitHub
// run 36624233202). Only the Week scroller's own rest after the pan counts.
describe('watchScrollEnd', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    document.documentElement.scrollTop = 0;
  });

  async function settled<T>(promise: Promise<T>) {
    return Promise.race([promise, Promise.resolve('pending' as const)]);
  }

  function scroller(parent: Element = document.body) {
    return parent.appendChild(document.createElement('div'));
  }

  // A glide: the scroller moves 10px every 5ms until stopped.
  function glide(element: Element) {
    const timer = setInterval(() => (element.scrollTop += 10), 5);
    return () => clearInterval(timer);
  }

  // Arms the watch on a scroller at rest, as the pan does.
  async function arm(element: Element) {
    const watch = watchScrollEnd(element, 10_000);
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(watch.ready)).toBe(true);
    return watch;
  }

  it('stays pending while its scroller keeps scrolling and resolves once it rests after its scrollend', async () => {
    const week = scroller();
    const { ended } = await arm(week);
    const stop = glide(week);
    await vi.advanceTimersByTimeAsync(200);
    expect(await settled(ended)).toBe('pending');
    stop();
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ended)).toBe(true);
  });

  it("ignores another scroller's scrollend while its own is still scrolling", async () => {
    const week = scroller();
    const inner = scroller(week);
    const sidebar = scroller();
    const { ended } = await arm(week);
    const stop = glide(week);
    sidebar.scrollTop = 40;
    sidebar.dispatchEvent(new Event('scrollend'));
    inner.dispatchEvent(new Event('scrollend', { bubbles: true }));
    document.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ended)).toBe('pending');
    stop();
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ended)).toBe(true);
  });

  it('ignores a stale scrollend before its scroller has moved', async () => {
    const week = scroller();
    week.scrollTop = 100;
    const { ended } = await arm(week);
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ended)).toBe('pending');
    week.scrollTop = 260;
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ended)).toBe(true);
  });

  it('ignores a stale scrollend that arrives after its scroller has started moving', async () => {
    const week = scroller();
    const { ended } = await arm(week);
    const stop = glide(week);
    await vi.advanceTimersByTimeAsync(20);
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(200);
    expect(await settled(ended)).toBe('pending');
    stop();
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ended)).toBe(true);
  });

  it('arms only once its scroller has come to rest', async () => {
    const week = scroller();
    const stop = glide(week);
    const { ready } = watchScrollEnd(week, 10_000);
    await vi.advanceTimersByTimeAsync(200);
    expect(await settled(ready)).toBe('pending');
    stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ready)).toBe(true);
  });

  it("watches the document when the page's own scroller moves", async () => {
    const page = document.documentElement;
    const { ended } = await arm(page);
    page.scrollTop = 160;
    scroller().dispatchEvent(new Event('scrollend', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ended)).toBe('pending');
    document.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ended)).toBe(true);
  });

  it('reports a scroll that never comes to rest', async () => {
    const week = scroller();
    const { ready, ended } = watchScrollEnd(week, 10_000);
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ready)).toBe(true);
    glide(week);
    await vi.advanceTimersByTimeAsync(9_800);
    expect(await settled(ended)).toBe('pending');
    await vi.advanceTimersByTimeAsync(100);
    expect(await settled(ended)).toBe(false);
  });

  it('reports a scroller that never rests before the pan', async () => {
    const week = scroller();
    glide(week);
    const { ready, ended } = watchScrollEnd(week, 10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await settled(ready)).toBe(false);
    expect(await settled(ended)).toBe(false);
  });
});
