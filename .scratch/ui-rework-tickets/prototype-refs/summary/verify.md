# Verify: summary prototype

Result: **boots and renders.** The approved route `/prototype/summary?variant=B` returns 200 with no Next error overlay and no console or page errors. The prototype code is unchanged.

- Tag `prototype-approved/summary` → `65d472d` ("Apply Summary review changes for Wayfinder #110"), the same commit that #145/#146 pin.
- Port 3136. Date 2026-09-27.

## Commands and timings

1. `git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-summary prototype-approved/summary` took 0.04 s.
2. Copied `.env` and `.env.local` from the main repo.
3. `pnpm install --offline --frozen-lockfile` **failed** after 5.8 s with `ERR_PNPM_NO_OFFLINE_TARBALL` for `next-16.1.1.tgz`.
   - Cause: in `/tmp`, pnpm picks a store on the same filesystem (`/tmp/.pnpm-store/v10`), which is nearly empty. The main repo uses `~/.local/share/pnpm/store/v10`.
   - **Workaround:** `pnpm install --offline --frozen-lockfile --store-dir /home/andreas/.local/share/pnpm/store/v10` completed in 3.7 s. `node_modules` is a real directory, not a symlink. The other `/tmp/ep-ref-*` agents will hit the same failure.
4. `setsid pnpm exec next dev --turbopack -p 3136 > /tmp/ep-ref-summary.log 2>&1 &` printed "Ready in 646ms" (Next 16.1.1).
5. `curl` on the route: first request 200 in 2.2 s (compile 1860 ms), then 200 in 0.04 s.
6. Playwright check: the `nextjs-portal` shadow root has no error dialog or issues element, and there were 0 console or page errors.

## Screenshots

- **Capture method.** The prototype portals its content into a `fixed inset-0 overflow-y-auto` div, so a plain `fullPage` capture only records the viewport. Before each capture the script resized the viewport to that div's `scrollHeight`, and closed the PROTOTYPE STATE panel.
- **Running the script.** Node ESM resolves `@playwright/test` from the script's own location, not the working directory. The script therefore ran from a temporary copy inside the worktree (`/tmp/ep-ref-summary/.ep-ref-shots.mjs`, deleted before the worktree was removed).
- **Files.** Eight PNGs, each 236–280 KB:
  - `summary-summary-{phone,tablet,desktop}.png`
  - `169-focus.png`, `170-focus.png`, `171-focus.png`, `194-focus.png`, `185-focus.png`
- **Observation:** the prototype isn't responsive. At 390×844 the content overflows horizontally by 371 px and the columns are crushed (see the phone PNG). At 1180 and 1440 there is no overflow. Take phone and tablet behaviour from the responsive-shell prototype and #145 §8.

## Cleanup

- Killed process group 1203121, which held the listener on 3136; the port is now free.
- `git worktree remove --force /tmp/ep-ref-summary` succeeded.
- No commits, no pushes, and no GitHub writes. The existing worktree `~/.t3/worktrees/.../t3code-8f5700ab` [prototype/summary] was not touched.
