# Verify: history-home group (finished-weeks, campaign-home)

Result: **both prototypes boot and render.** Each approved route returned 200 with no Next error overlay (checked in the `nextjs-portal` shadow root) and 0 console or page errors in Playwright. No prototype code was changed. The two prototypes ran one after the other. Date 2026-09-27.

| Prototype | Tag → commit | Port | Route |
| --- | --- | --- | --- |
| finished-weeks | `prototype-approved/finished-weeks` → `2e9904c` ("Finished weeks A: drop correction notes, keep Earlier entries paging"), matching #146/#184/#185/#197 | 3139 | `/prototype/finished-weeks?variant=A` |
| campaign-home | `prototype-approved/campaign-home` → `a9db8ac` ("Apply #118 review to variant B: …"), matching #147/#187/#189 | 3140 | `/prototype/campaign-home?variant=B` |

## Commands and timings

Both prototypes used the same steps with `<name>`/`<port>` substituted:

1. `git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-<name> prototype-approved/<name>` (under 1 s).
2. `cp` `.env` and `.env.local` from the main repo.
3. `pnpm install --offline --frozen-lockfile --store-dir /home/andreas/.local/share/pnpm/store/v10`. It took 1.4 s (finished-weeks) and 0.97 s (campaign-home), with no missing packages. The only notice was pnpm's usual "approve-builds" box. `node_modules` is a real directory.
4. `setsid pnpm exec next dev --turbopack -p <port> > /tmp/ep-ref-<name>.log 2>&1 < /dev/null &` printed "Ready in 657 ms" and "Ready in 654 ms" (Next 16.1.1).
5. `curl` on the approved route:
   - finished-weeks: 200 in 2.32 s on the first (compiling) request, then 200 in 0.04 s.
   - campaign-home: 200 in 2.18 s (compile 1816 ms), then 200 in 0.05 s.

No errors, so no workaround was needed beyond the `--store-dir` flag the brief already prescribes.

## Screenshots

The scripts were written in `/tmp` and run with `node` from a temporary copy inside each worktree (`.ep-ref-shots.mjs`, deleted before the worktree was removed).

- **Capture method.** Both prototypes portal into a `fixed inset-0 overflow-y-auto` div. Before each capture the script resized the viewport to that div's `scrollHeight`, then used `fullPage` and `scale: "css"`.
- **finished-weeks.** At 390 px the record `h1` has zero width, so Playwright calls it hidden. The script waits for `attached` instead of `visible`.
- **campaign-home.**
  - The PROTOTYPE STATE panel starts open, so the script collapses it.
  - The right pane scrolls inside its own `overflow-y-auto` section, so campaign-home PNGs are viewport height. `187-focus.png` shows the full edit form, and the pane content below it is cut off.
- **Overlays.** In every PNG the fixed variant switcher (bottom centre) and the collapsed state button (bottom right) sit over the bottom of the content. On finished-weeks they partly cover the read-only footer line.

Twelve PNGs, 23–273 KB each:

| File | Shows |
| --- | --- |
| `history-home-finished-weeks-{phone,tablet,desktop}.png` | default week 14 |
| `184-focus.png` | week 12, original entry, 3 entries expanded |
| `185-focus.png` | week 14, Show all 10 values |
| `history-home-campaign-home-{phone,tablet,desktop}.png` | default, Ironfang selected |
| `187-focus.png` | Edit header form |
| `187-focus-create.png` | New campaign form with "Enter a name." |
| `189-focus.png` | default Ironfang pane; the same view as the tablet overview |

- #197 has no screenshot (backend only).
- **Neither prototype is responsive.**
  - finished-weeks at 390 px: 336 px horizontal overflow, and the record is crushed to zero width.
  - campaign-home at 390 px: 24 px overflow, and the pane is about 30 px wide.
  - Take phone and desktop layout from responsive-pages C.
- **Behaviour checked while running** (details in the deviations files):
  - finished-weeks: earlier entries render the effective week's facts, Show all and the entries disclosure persist across week changes, the URL never changes and there are no `<time>` elements.
  - campaign-home: *Second Table* (2 finished weeks) has no **All finished weeks** link.

## Cleanup

- finished-weeks: killed process group 1212703 (listener PID 1212763 on 3139), then `git worktree remove --force /tmp/ep-ref-finished-weeks` succeeded. The campaign-home worktree was created only after this.
- campaign-home: killed process group 1219915 (listener PID 1219953 on 3140), then `git worktree remove --force /tmp/ep-ref-campaign-home` succeeded.
- `ss -ltn` afterwards shows no listener on 3139 or 3140.
- No commits, pushes or GitHub writes. The existing `~/repos/everythingpath/ep-finished-weeks` and `ep-campaign-home` worktrees and the servers on other ports were not touched.
