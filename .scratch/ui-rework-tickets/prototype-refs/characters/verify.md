# Verify: `characters-officers` prototype (2026-09-27)

Tag `prototype-approved/characters-officers` points at commit `c6f90fa` ("Character dialog says Hit Dice and drops its description"). That matches the pinned `c6f90faecb0109c39f202c89475962e2c0014b31` in #141 §3. The approved route is `/prototype/characters-officers?variant=B`, and the pin's "kind lives on the character record" is the state panel's default (`scenario.kindHome: 'record'`). The screenshot script also selects it explicitly. Port 3138.

**Result: it boots and renders.** Every load returned HTTP 200 with no Next error overlay: `nextjs-portal` contained no `[data-nextjs-dialog]`, only the dev-tools "N" badge. No page errors occurred.

## Commands and timings

1. `git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-characters-officers prototype-approved/characters-officers` finished in under 1 s.
2. `pnpm install --offline --frozen-lockfile --store-dir /home/andreas/.local/share/pnpm/store/v10` finished in 1.4 s. `node_modules` is a real directory, not a symlink.
3. Copied `.env` and `.env.local` from the main repo.
4. `setsid pnpm exec next dev --turbopack -p 3138 > /tmp/ep-ref-characters-officers.log 2>&1 < /dev/null &` started Next.js with Turbopack, which reported "Ready in 628ms".
5. `curl http://localhost:3138/prototype/characters-officers?variant=B` returned `200` in 2.36 s (compile 2.0 s, render 246 ms). The 18 later Playwright loads each took 28–61 ms. The server log contained no errors or warnings.

I needed no workaround beyond the `--store-dir` flag that the brief already prescribes, and I changed no prototype code.

## Screenshots

- The script is `/tmp/ep-ref-characters-officers-shots.mjs`, copied into the worktree root and run with `node`. It uses chromium from `~/.cache/ms-playwright` and `scale: "css"`.
- Like the other prototypes, this one portals into a `fixed inset-0 overflow-y-auto` overlay. Before each `fullPage` capture, the script grows the viewport height to the overlay's `scrollHeight`.
- At 390 px the variant switcher covers the PROTOTYPE STATE toggle, so the script toggles the panel with `dispatchEvent('click')`.
- Files (120–165 KB each, all opened and checked):
  - `characters-characters-officers-{phone,tablet,desktop}.png`
  - `180-focus.png`: the Edit dialog for Sera, showing NPC kind and the Hit Dice label.
  - `182-focus.png`: the board and table with *Show archived* ticked.
  - `183-focus.png`: *Correct officers* after removing Aria from Strategist, with the *Story change* chip and the Assign Spymaster sheet.
  - `196-focus.png`: *Correct officers* after removing Sera's Ambassador role, showing the limit-1 warning.
  - #179 and #181 have no surface, so they have no screenshot.

## Observations

- Console output held Clerk development-key warnings and Radix "Missing `Description`" warnings for the record dialog. The dialog's description was deliberately removed by the caption approval.
- After a Move to… onto an already-held role, React logged `Encountered two children with the same key … bren`. See deviations-characters.md.
- **Phone (390×844)** isn't responsive in this prototype: the overlay scrolls sideways by 343 px, and the 3×2 grid and table columns squeeze. **Desktop** is full width, not centered. The approved phone and desktop layouts come from `prototype/responsive-pages` variant C (#141 §3).
- The probes also confirmed four behaviours listed in `deviations-characters.md`:
  - A stale save overwrites the remote Spymaster change.
  - The roster-leave warning names no roles or teams.
  - The table isn't alphabetical.
  - An empty Hit Dice saves as "0 HD".

## Cleanup

- Killed the dev server's process group (pgid 1211078); port 3138 is free afterwards.
- Ran `git worktree remove --force /tmp/ep-ref-characters-officers`. The pre-existing `~/repos/everythingpath/ep-characters-officers` worktree was not touched.
