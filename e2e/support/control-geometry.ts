import { expect, type Locator } from '@playwright/test';
import { settleAnimations } from './responsive-shell';

/** A visible control's layout facts, as one-call measurement returns them. */
export type ControlGeometry = {
  tag: string;
  ariaLabel: string | null;
  text: string | null;
  isInput: boolean;
  /** An input's first label's text; undefined for other controls. */
  inputLabel: string | null | undefined;
  /** The border box relative to the viewport, null without a box of its own. */
  bounds: { x: number; y: number; width: number; height: number } | null;
  /** The content is no wider than the element's own box. */
  contentFits: boolean;
};

/**
 * Every visible element `controls` matches, measured in one browser call
 * instead of several protocol calls per control (#774). Visibility is
 * Playwright's own (the `visible` filter, as `isVisible()`). Bounds match
 * `boundingBox()`: the border box relative to the viewport, null for an
 * element with no box, such as `display: contents`. The snapshot is taken
 * once finite CSS transitions have settled, so a resize is measured after
 * its responsive update, not mid-transition. A selection with nothing
 * visible fails with `what`, so a broken selector cannot pass by measuring
 * no controls. Geometry only: reachability, scrolling and trial clicks stay
 * with `expectReachable`.
 */
export async function measureVisibleControls(
  controls: Locator,
  what: string,
): Promise<ControlGeometry[]> {
  await settleAnimations(controls.page());
  const measured = await controls
    .filter({ visible: true })
    .evaluateAll((elements) =>
      elements.map((element) => {
        const isInput = element instanceof HTMLInputElement;
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          ariaLabel: element.getAttribute('aria-label'),
          text: element.textContent,
          isInput,
          inputLabel: isInput ? element.labels?.[0]?.textContent : undefined,
          bounds:
            element.getClientRects().length === 0
              ? null
              : {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                },
          contentFits: element.scrollWidth <= element.clientWidth,
        };
      }),
    );
  expect(measured.length, `${what}: visible controls measured`).toBeGreaterThan(
    0,
  );
  return measured;
}

/**
 * Every visible one of `controls` lies within the viewport width, and each
 * button's label fits its own box: `expectControlsFit` with one measurement
 * for all controls. `size` names the viewport in messages.
 */
export async function expectVisibleControlsFit(
  controls: Locator,
  size: string,
  width: number,
) {
  for (const control of await measureVisibleControls(controls, size)) {
    const label =
      control.ariaLabel ??
      (control.isInput ? control.inputLabel : control.text) ??
      'Unlabelled control';
    const description = `${size}: ${control.tag} ${label}`;
    expect(control.bounds, description).not.toBeNull();
    expect(control.bounds!.x, description).toBeGreaterThanOrEqual(0);
    expect(
      control.bounds!.x + control.bounds!.width,
      description,
    ).toBeLessThanOrEqual(width);
    // Text fields intentionally scroll long entered values inside their bounds.
    if (control.tag === 'BUTTON')
      expect(control.contentFits, description).toBe(true);
  }
}
