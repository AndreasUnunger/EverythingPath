import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchScrollEnd } from './upkeep-layout';

// The settlement touch journey taps only once its pan's scroll has come to
// rest: a tap during the momentum stops the scroll without a click (GitHub
// run 36624233202).
describe('watchScrollEnd', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  async function settled(ended: Promise<boolean>) {
    return Promise.race([ended, Promise.resolve('pending' as const)]);
  }

  it('stays pending while a scroller keeps scrolling and resolves on its scrollend', async () => {
    const scroller = document.body.appendChild(document.createElement('div'));
    const { ended } = watchScrollEnd(10_000);
    scroller.dispatchEvent(new Event('scroll'));
    scroller.dispatchEvent(new Event('scroll'));
    expect(await settled(ended)).toBe('pending');
    scroller.dispatchEvent(new Event('scrollend'));
    expect(await ended).toBe(true);
  });

  it('resolves when the document itself stops scrolling', async () => {
    const { ended } = watchScrollEnd(10_000);
    document.dispatchEvent(new Event('scrollend'));
    expect(await ended).toBe(true);
  });

  it('reports a scroll that never comes to rest', async () => {
    vi.useFakeTimers();
    const { ended } = watchScrollEnd(10_000);
    document.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(await settled(ended)).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(await ended).toBe(false);
  });
});
