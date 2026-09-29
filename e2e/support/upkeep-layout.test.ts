import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchScrollEnd } from './upkeep-layout';

// The settlement touch journey taps only once its pan's scroll has come to
// rest: a tap during the momentum stops the scroll without a click (GitHub
// run 36624233202). Only the Week scroller's own rest after the pan counts.
describe('watchScrollEnd', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    document.documentElement.scrollTop = 0;
  });

  async function settled(ended: Promise<boolean>) {
    return Promise.race([ended, Promise.resolve('pending' as const)]);
  }

  function scroller(parent: Element = document.body) {
    return parent.appendChild(document.createElement('div'));
  }

  it('stays pending while its scroller keeps scrolling and resolves on its scrollend', async () => {
    const week = scroller();
    const { ended } = watchScrollEnd(week, 10_000);
    week.scrollTop = 80;
    week.dispatchEvent(new Event('scroll'));
    week.scrollTop = 160;
    week.dispatchEvent(new Event('scroll'));
    expect(await settled(ended)).toBe('pending');
    week.dispatchEvent(new Event('scrollend'));
    expect(await ended).toBe(true);
  });

  it("ignores another scroller's scrollend while its own is still scrolling", async () => {
    const week = scroller();
    const inner = scroller(week);
    const sidebar = scroller();
    const { ended } = watchScrollEnd(week, 10_000);
    week.scrollTop = 160;
    sidebar.scrollTop = 40;
    sidebar.dispatchEvent(new Event('scrollend'));
    inner.dispatchEvent(new Event('scrollend', { bubbles: true }));
    document.dispatchEvent(new Event('scrollend'));
    expect(await settled(ended)).toBe('pending');
    week.dispatchEvent(new Event('scrollend'));
    expect(await ended).toBe(true);
  });

  it('ignores a scrollend from a scroll that ended before arming', async () => {
    const week = scroller();
    week.scrollTop = 100;
    const { ended } = watchScrollEnd(week, 10_000);
    week.dispatchEvent(new Event('scrollend'));
    expect(await settled(ended)).toBe('pending');
    week.scrollTop = 260;
    week.dispatchEvent(new Event('scrollend'));
    expect(await ended).toBe(true);
  });

  it("watches the document when the page's own scroller moves", async () => {
    const page = document.documentElement;
    const { ended } = watchScrollEnd(page, 10_000);
    page.scrollTop = 160;
    scroller().dispatchEvent(new Event('scrollend', { bubbles: true }));
    expect(await settled(ended)).toBe('pending');
    document.dispatchEvent(new Event('scrollend'));
    expect(await ended).toBe(true);
  });

  it('reports a scroll that never comes to rest', async () => {
    vi.useFakeTimers();
    const week = scroller();
    const { ended } = watchScrollEnd(week, 10_000);
    week.scrollTop = 160;
    week.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(await settled(ended)).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(await ended).toBe(false);
  });
});
