import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useSourceFocus } from './use-source-focus';
import type { Phase } from './types';
afterEach(cleanup);

const nextFrame = () =>
  act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );

test('[PER-02.link] a source link shows its phase locally, then focuses the named slot once it renders', async () => {
  const target = document.createElement('div');
  target.id = 'activity-slot-left';
  target.tabIndex = -1;
  const scroll = vi.fn();
  target.scrollIntoView = scroll;
  document.body.append(target);
  const choose = vi.fn();
  const { result, rerender } = renderHook(
    ({ shown }: { shown: Phase }) => useSourceFocus(shown, choose),
    { initialProps: { shown: 'persistent' as Phase } },
  );
  act(() =>
    result.current({ phase: 'activity', anchor: 'activity-slot-left' }),
  );
  expect(choose).toHaveBeenCalledWith('activity');
  expect(document.activeElement).not.toBe(target);
  rerender({ shown: 'activity' });
  await nextFrame();
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(target);
  // A later, unrelated return to Activity does not move focus again.
  target.blur();
  rerender({ shown: 'event' });
  rerender({ shown: 'activity' });
  await nextFrame();
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(document.activeElement).not.toBe(target);
  target.remove();
});
