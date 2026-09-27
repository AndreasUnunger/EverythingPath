# Verify: `upkeep` prototype (2026-09-27)

Tag `prototype-approved/upkeep` is commit `9c91ed3` ("PROTOTYPE: refine Upkeep variant A after review (Wayfinder #107)"). The approved route is `/prototype/upkeep?variant=A` (Rules order). Port 3131.

**Result: boots and renders.** It returned HTTP 200, showed no Next error overlay (only the dev-tools "N" badge), and logged no page or console errors in any Playwright run.

## Commands and timings

1. `git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-upkeep prototype-approved/upkeep` finished in under 1 s.
2. Copied `.env` and `.env.local` from the main repo into the worktree.
3. `pnpm install --offline --frozen-lockfile` **failed** in 0.4 s with `ERR_PNPM_NO_OFFLINE_TARBALL` for `@clerk/nextjs-6.37.3.tgz`.
   - Cause: `/tmp` is a separate tmpfs, so pnpm picked a per-filesystem store at `/tmp/.pnpm-store/v10`, which is empty. The main repo uses `/home/andreas/.local/share/pnpm/store/v10`.
   - Workaround, not committed: `pnpm install --offline --frozen-lockfile --store-dir /home/andreas/.local/share/pnpm/store/v10`. This finished in 3.2 s. `node_modules` is a real directory, not a symlink.
4. `setsid pnpm exec next dev --turbopack -p 3131 > /tmp/ep-ref-upkeep.log 2>&1 < /dev/null &` started Next.js 16.1.1 (Turbopack), which reported "Ready in 816ms".
5. `curl http://localhost:3131/prototype/upkeep?variant=A` returned `200` in 2.29 s. The log shows compile 1948 ms and render 238 ms. The server log contained no errors or warnings.

No prototype code was changed.

## Screenshots

- The script is `/tmp/ep-ref-upkeep-shots.mjs`, copied into the worktree root and run with `node`. It uses chromium from `~/.cache/ms-playwright` and `scale: "css"`.
- The prototype portals its content into a `fixed inset-0 overflow-y-auto` overlay, so `fullPage` alone only captures the viewport. Before each `fullPage` capture, the script grows the viewport height (width unchanged) to the overlay's `scrollHeight`.
- Files:
  - `upkeep-upkeep-phone.png` (390 wide)
  - `upkeep-upkeep-tablet.png` (1180 wide)
  - `upkeep-upkeep-desktop.png` (1440 wide)
  - `156-focus.png`, `157-focus.png`, `158-focus.png` (tablet 1180)
- Every PNG is 115–225 KB, and each was opened to check its contents.

## Observations

- **Tablet and desktop** render as expected with no horizontal overflow.
- **Phone (390×844)** isn't responsive in this snapshot. The fixed 16rem reference panel covers the main column, the overlay scrolls sideways by 370 px, and section text wraps into narrow columns. This is expected, because the phone layout is governed by `prototype/responsive-shell` variant B. It is recorded in `deviations-upkeep.md`.
- The prototype allows a negative treasury after a withdrawal beyond funds ("Treasury 118 → -357 gp") and shows an ASCII hyphen for negative totals.

## Cleanup

- Killed the dev server's process group; port 3131 is free afterwards.
- Ran `git worktree remove --force /tmp/ep-ref-upkeep`.
