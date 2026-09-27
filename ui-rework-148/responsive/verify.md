# Verify: responsive group (2026-09-27)

Both prototypes were booted one at a time. Both booted cleanly with no code changes.

## responsive-shell (tag `prototype-approved/responsive-shell` = `de10f42`, port 3141)

```bash
git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-responsive-shell prototype-approved/responsive-shell
cd /tmp/ep-ref-responsive-shell
pnpm install --offline --frozen-lockfile --store-dir /home/andreas/.local/share/pnpm/store/v10   # 1.7 s, no missing packages
cp <main>/.env <main>/.env.local .
setsid pnpm exec next dev --turbopack -p 3141 > /tmp/ep-ref-responsive-shell.log 2>&1 < /dev/null &
```

- Next.js 16.1.1 (Turbopack) was ready in 713 ms.
- `GET /prototype/responsive-shell?variant=B` returned 200 in 2.4 s (first compile 2.0 s).
- `GET /prototype/responsive-shell/screen?variant=B&phase=upkeep` returned 200 in 0.7 s.
- All five phases (`upkeep`, `activity`, `event`, `persistent`, `summary`) returned 200 and rendered at 390×844 and 1440×900. There was no Next error overlay, no page errors or console errors, and no errors in the server log.
- Phase values come from `phaseOrder` in `src/components/responsive-shell-prototype/model.ts`. An invalid or absent value falls back to `activity` in the prototype. That fallback is prototype-only: the spec requires Upkeep.

## responsive-pages (tag `prototype-approved/responsive-pages` = `cf13bfc`, port 3142)

Same commands with `responsive-pages` and port 3142. The install took under 1 s.

- The server was ready in 632 ms.
- `GET /prototype/responsive-pages?variant=C` returned 200 in 2.3 s (first compile 1.9 s).
- `&page=` accepts `campaigns | setup | militia | characters | history | week`, set in `index.tsx`. Each of the five pages rendered at both sizes. There was no error overlay and there were no console or page errors.

## Screenshots

There are 20 PNGs, all ≤ 322 KB. The Playwright script (`@playwright/test`, `scale: "css"`) was written in /tmp but had to be copied into the worktree root to run. Node ESM resolves `@playwright/test` from the script's own location, not from the working directory, so running it from /tmp failed with `ERR_MODULE_NOT_FOUND`. The copy was deleted before cleanup.

Capture settings:
- The Next dev indicator (`nextjs-portal`) was hidden with injected CSS. Before hiding it, the script checked its shadow root for error text; none was found.
- **Shell:** the capture is a single viewport screenshot. Variant B's week screen never scrolls the page: the body scrolls in its own column, so `fullPage` equals the viewport. The prototype's yellow STATE toggle is still visible.
- **Pages:** the page renders into a fixed `overflow-y-auto` container. For full-length capture, that container was switched to `position: static` and every other body child was hidden, including the app layout behind the portal, the state panel and the variant switcher.

Observed issues:
- On phone, the shell's STATE toggle covers the top-bar save and remote icons. This is prototype chrome.
- On the phone history page, the Result table overflows horizontally. This is recorded in `deviations-responsive.md`.

## Cleanup

- **Pages server:** stopped cleanly by killing its process group (pgid found via `ss -ltnp` on 3142). The port was then free and `worktree remove --force` succeeded.
- **Shell server:** my first kill used the saved `$!` PID, which failed because setsid had forked. `worktree remove --force` then ran while the server was still up, and deleted the files but not the directory. The server exited on its own soon after, and port 3141 was confirmed free. I removed the leftover `/tmp/ep-ref-responsive-shell/.next` with `rm -rf` and ran `git worktree prune`. Neither `/tmp/ep-ref-*` worktree remains in `git worktree list`. `~/repos/everythingpath/ep-responsive-shell` was not touched.
