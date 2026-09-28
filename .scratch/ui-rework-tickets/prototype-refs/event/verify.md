# Verify: Event prototype

- Tag `prototype-approved/event` resolves to `f93ea1c` ("PROTOTYPE: refine Event variant A after review (Wayfinder #108)").
- Route `/prototype/event?variant=A` on port 3133. Date: 2026-09-27.

## Commands and timings

```sh
git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-event prototype-approved/event
cd /tmp/ep-ref-event
pnpm install --offline --frozen-lockfile        # FAILED, see below
pnpm install --prefer-offline --frozen-lockfile # OK, 83 s (pnpm 10.29.1)
cp /home/andreas/repos/everythingpath/everythingpath/{.env,.env.local} .
setsid pnpm exec next dev --turbopack -p 3133 > /tmp/ep-ref-event.log 2>&1 &
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3133/prototype/event?variant=A"   # 200
```

- Next.js 16.1.1 (Turbopack) was ready in 645 ms. The first request returned 200 in 2.3 s (compile 1944 ms, render 240 ms). The server log showed no errors.

## Errors and workaround

- `pnpm install --offline` failed with `ERR_PNPM_NO_OFFLINE_TARBALL` for `@clerk/nextjs-6.37.3.tgz`, which is missing from the local store. `--prefer-offline` fetched only the missing tarballs from the npm registry. No code or lockfile changes were made. pnpm warned that build scripts for esbuild, sharp and unrs-resolver were ignored; this did not matter for the dev server.
- Running Playwright needed a small change. Node's ESM resolver resolves bare specifiers from the script's own location (`/tmp`), not the working directory, so `import { chromium } from "@playwright/test"` failed. The script instead imports `/tmp/ep-ref-event/node_modules/@playwright/test/index.js` as a default import (it is CommonJS). It used the cached chromium-1243.
- The page content is a `fixed inset-0 overflow-y-auto` portal, so `fullPage` screenshots would capture only one viewport. The script sets the viewport height to the container's `scrollHeight` before each shot. Widths are unchanged.

## Rendering check

- Phone, tablet and desktop render with no Next error overlay. The dev indicator shows no issues on the default route.
- In the 164 and 192 focus states, the dev indicator shows 1–2 issues. These are React "two children with the same key" console errors caused by duplicate requirement texts in This phase (for example "Team that falls sick: choose one" or "Rival teams: choose 2" from two events). This is a prototype bug; see `deviations-event.md`.
- The layout is tablet-only. At 390×844 the frame overflows horizontally by 370 px and the rail overlaps the main column. Tablet and desktop have no overflow.

## Screenshots (10)

- Overview: `event-event-{phone,tablet,desktop}.png`, showing the default state (Roll Twice → Sickness + Invasion).
- Focus: `163-focus.png`, `164-focus.png`, `165-focus.png`, `166-focus.png`, `191-focus.png`, `192-focus.png`, `193-focus.png`. All are 1180 px wide, fullPage, `scale: "css"`, and each is 125–285 KB.
- Script: `/tmp/ep-ref-event-shots.mjs`. It drives the PROTOTYPE STATE checkboxes and fills the aria-labelled die fields.

## Cleanup

- Dev server process group killed and port 3133 confirmed free.
- Worktree `/tmp/ep-ref-event` removed with `git worktree remove --force`.
