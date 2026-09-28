# Verify: setup-correction prototype

Result: **it boots and renders.** Both approved routes return 200 with no Next error overlay and no console or page errors. I did not change the prototype code.

- Tag `prototype-approved/setup-correction` points to `c479521` ("Apply the Wayfinder #113 pick: variant B with C's Characters & officers"). #138 and #139 pin the same commit.
- Port 3137. Date 2026-09-27.

## Commands and timings

1. `git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-setup-correction prototype-approved/setup-correction`
2. Copied `.env` and `.env.local` from the main repo into the worktree.
3. `pnpm install --offline --frozen-lockfile --store-dir /home/andreas/.local/share/pnpm/store/v10` succeeded ("Done in 1.6s"). Steps 1–3 took about 2 s in total. `node_modules` is a real directory.
4. `setsid nohup pnpm exec next dev --turbopack -p 3137 > /tmp/ep-ref-setup-correction.log 2>&1 &` reported "Ready in 643ms".
5. curl results:
   - `/prototype/setup-correction?variant=B`: 200 in 2.25 s (compile 1918 ms).
   - `/prototype/setup-correction?variant=B&screen=militia`: 200 in 0.04 s.
6. Playwright found no error dialog in the `nextjs-portal` shadow root (checked on every capture), and there were no `pageerror` or console errors.

## Screenshots

- **Capture method.** Content is portalled into a `fixed inset-0 overflow-y-auto` div, so before each capture the script resized the viewport to that div's `scrollHeight`, then took a `fullPage` capture with `scale: "css"`. The script ran as `node` from a copy inside the worktree, because ESM resolves `@playwright/test` from the script's own location. I deleted that copy before removing the worktree.
- **Workaround.** The PROTOTYPE STATE panel at the bottom right covers the sticky footer button: *Next* / *Start militia week*. Playwright's click was intercepted, so the script used `dispatchEvent('click')` for *Start militia week*. The panel and the variant switcher are visible in the PNGs.
- **Files.** 12 PNGs, each 33–109 KB:
  - Setup overview: `setup-setup-correction-{phone,tablet,desktop}.png`
  - Militia overview: `militia-setup-correction-{phone,tablet,desktop}.png`
  - Focus: `172-focus.png`, `173-focus.png`, `175-focus.png`, `176-focus.png`, `177-focus.png`, `178-focus.png`
  - #195 has no prototype surface, so its screenshot is null.
- **Observation: the prototype isn't responsive.** At 390×844 the tablet grid is squashed:
  - Setup overflows horizontally by 30 px.
  - Militia overflows by 343 px.

  There is no overflow at 1180 or 1440, and desktop is the tablet layout stretched. Take phone and desktop behaviour from `responsive-pages?variant=C`, as §3 of #138 and #139 says.
- **Observation: restarting a conflict keeps the reason.** After *Start again from their values*, the reason field kept the old text "Miscounted at the table". This contradicts #139 §5 and is recorded in `deviations-militia.md`.

## Cleanup

- Killed process group 1209031, which held the listener on 3137. The port is now free.
- `git worktree remove --force /tmp/ep-ref-setup-correction` succeeded.
- No commits, no pushes and no GitHub writes. I did not touch any other worktree or server.
