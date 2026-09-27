# Verify: persistent group (2026-09-27)

The two prototypes were booted one after the other, never together. No prototype code was changed, and neither prototype needed a workaround to boot.

## persistent (port 3134)

- Tag `prototype-approved/persistent` points to commit `f6d5426439cfa16d3ff189a476005eff3d3664fe`, which matches spec #144 §3.
- `git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-persistent prototype-approved/persistent`
- `cp …/everythingpath/.env …/everythingpath/.env.local /tmp/ep-ref-persistent/`
- `pnpm install --offline --frozen-lockfile` finished with exit 0 in about 1 s. `node_modules` is a real directory, not a symlink. pnpm printed only its usual "approve-builds" notice.
- `setsid bash -c 'exec pnpm exec next dev --turbopack -p 3134' > /tmp/ep-ref-persistent.log` gave "Next.js 16.1.1 (Turbopack) … Ready in 742ms".
- `curl /prototype/persistent?variant=A` returned **200** in 2.43 s on the first, cold compile.
- In Playwright at 390, 1180 and 1440 px there was no Next error overlay, no `pageerror` and no console error. The dev log has no errors.
- Stopped with `kill -- -<pgid>`. Port 3134 was confirmed free, and the worktree was removed with `worktree remove --force`.

## week-layout (port 3135)

- Tag `prototype-approved/week-layout` points to commit `14659d7dc6dc9062098055e29508fa3327912402`, which matches spec #144 §3.
- The worktree was created at `/tmp/ep-ref-week-layout`, with the same `.env` copy and `pnpm install --offline --frozen-lockfile` (exit 0, under 1 s, real `node_modules`).
- `pnpm exec next dev --turbopack -p 3135` was ready in 633 ms. `/prototype/week-layout?variant=A` returned **200** in 2.08 s on the cold compile, and so did `&phase=persistent`.
- There were no overlays or console/page errors at any viewport. The server was stopped, port 3135 confirmed free, and the worktree removed.

## Why #144 pins week-layout

It is the approved shared week frame from [#101 variant A](https://github.com/AndreasUnunger/EverythingPath/issues/101#issuecomment-5831260876), which the Persistent decision sits inside. Persistent uses it for:

- the five-step stepper, including the Persistent step that stays visible but locked with "No carried events" when Persistent is ineligible (fixed Persistent Phase Eligibility, WEEK-02);
- the per-step readiness captions;
- the **This phase** block and the footer readiness line (PER-08/PER-10, where "Earlier phases still need preparation" belongs);
- the reference panel.

Its Persistent main column is a rough placeholder that the persistent prototype supersedes. So the screenshots use `&phase=persistent`, and one extra tablet shot (`persistent-week-layout-locked-tablet.png`) shows the locked step. To get that state, untick *persistent events carried in* in the state panel. The prototype then switches Phase View to Event.

## Screenshots and how they were taken

- 9 PNGs:
  - persistent overview: phone, tablet, desktop;
  - week-layout overview: phone, tablet, desktop, plus the locked-step tablet shot;
  - `167-focus.png` and `168-focus.png`.
- Scripts: `/tmp/ep-ref-persistent-shots.mjs` and `/tmp/ep-ref-week-layout-shots.mjs`. They were run with `node` from inside each worktree, using `scale: "css"`.
- **Workaround for full-page capture.** Both prototypes render inside a `position: fixed` overlay that scrolls itself, so Playwright's `fullPage` only captures the viewport. My first attempt unfixed the overlay, and that exposed the app shell underneath. The fix: measure the overlay's `scrollHeight`, resize the viewport to that height, then take a normal screenshot. This is equivalent to a full page.
- The yellow PROTOTYPE STATE panel and the variant switcher are hidden in the shots, to keep them clean.
- **Phone.** Neither prototype was designed for phone; both were reviewed at tablet landscape, and #101 left phone in "the fog". At 390 px:
  - the persistent content is 760 px wide inside a 390 px viewport, and the cards and reference panel overlap;
  - the week-layout content is 821 px wide, and the stepper, rail and main column overlap.

  The phone PNGs show only the 390 px viewport width, so the overflow is visible as clipped, overlapping content. The phone layout comes from responsive-shell B, which is not part of this group, and from #144 §8.
