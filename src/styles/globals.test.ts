import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { expect, test } from 'vitest';

// The compiled stylesheet, scanning the shared UI primitives that use the
// enter/exit animations (dialog, sheet, select, tooltip). This is the seam
// the browser actually receives.
async function compiledStyles() {
  const root = join(__dirname, '..', '..');
  const source = readFileSync(join(__dirname, 'globals.css'), 'utf8').replace(
    "@import 'tailwindcss';",
    `@import 'tailwindcss' source(none);\n@source "${join(root, 'src/components/ui')}";`,
  );
  const result = await postcss([tailwind({ base: root })]).process(source, {
    from: join(__dirname, 'globals.css'),
  });
  return result.css;
}

function keyframeBlocks(css: string) {
  return [...css.matchAll(/@keyframes ([\w-]+)\s*\{[\s\S]*?\}\s*\}/g)].map(
    (match) => ({ name: match[1]!, body: match[0] }),
  );
}

// WebKit's Skia compositor crashes when an animation interpolates `filter`
// into the element's own `filter: none`, which tw-animate-css's default
// enter/exit keyframes do even for fade/zoom/slide-only surfaces (#151,
// character-ledger WebKit failure). The app must never emit such keyframes
// while keeping the fade/zoom/slide animations themselves.
test('[styles.animation] no emitted keyframes animate filter, and enter/exit animations keep opacity and transform', async () => {
  const css = await compiledStyles();
  const blocks = keyframeBlocks(css);
  expect(blocks.map((block) => block.name)).toEqual(
    expect.arrayContaining(['enter-unfiltered', 'exit-unfiltered']),
  );
  expect(blocks.filter((block) => /filter\s*:/.test(block.body))).toEqual([]);
  const enter = blocks.find((block) => block.name === 'enter-unfiltered')!;
  const exit = blocks.find((block) => block.name === 'exit-unfiltered')!;
  for (const block of [enter, exit]) {
    expect(block.body).toMatch(/opacity:\s*var\(--tw-(enter|exit)-opacity/);
    expect(block.body).toMatch(/transform:\s*translate3d\(/);
    expect(block.body).toMatch(/scale3d\(/);
  }
  // The animate-in/animate-out utilities the primitives use (inlined by the
  // theme) resolve to those keyframes, never to the library's filtered
  // `enter`/`exit`, which must not be emitted at all.
  expect(css).toMatch(/animate-in\s*\{[^}]*animation:\s*enter-unfiltered\s/);
  expect(css).toMatch(/animate-out\s*\{[^}]*animation:\s*exit-unfiltered\s/);
  expect(css).not.toMatch(/animation:\s*enter\s/);
  expect(css).not.toMatch(/animation:\s*exit\s/);
  expect(blocks.some((block) => block.name === 'enter')).toBe(false);
  expect(blocks.some((block) => block.name === 'exit')).toBe(false);
});
