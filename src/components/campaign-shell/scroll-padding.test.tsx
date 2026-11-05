import { render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useRef } from 'react';
import { useScrollPaddingFor } from './scroll-padding';

afterEach(() => {
  vi.unstubAllGlobals();
});

function Bar({ name }: { name: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useScrollPaddingFor(bar);
  return <div ref={bar} data-bar={name} />;
}

// Two pinned bars at once, such as the phone bottom bar (display:none from
// 768px) and the Characters save point: the reservations add up, and one
// bar leaving or collapsing never clears the other's (#198).
test('pinned bars reserve the sum of their heights, and one leaving keeps the other', () => {
  const observed: { target: Element; notify: () => void }[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(target: Element) {
        observed.push({ target, notify: this.callback });
      }
      disconnect() {
        observed.length = 0;
      }
    },
  );
  const heights = new Map<string, number>([
    ['shell', 0],
    ['save', 120],
  ]);
  const view = render(
    <>
      <Bar name="shell" />
      <Bar name="save" />
    </>,
  );
  for (const { target } of observed)
    Object.defineProperty(target, 'offsetHeight', {
      get: () => heights.get(target.getAttribute('data-bar')!)!,
    });
  const notify = () => observed.forEach((entry) => entry.notify());
  const root = document.documentElement.style;
  notify();
  expect(root.scrollPaddingBottom).toBe('136px');
  heights.set('shell', 49);
  notify();
  expect(root.scrollPaddingBottom).toBe('185px');
  view.rerender(<Bar name="shell" />);
  expect(root.scrollPaddingBottom).toBe('65px');
  view.unmount();
  expect(root.scrollPaddingBottom).toBe('');
});
