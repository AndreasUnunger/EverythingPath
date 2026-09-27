# Verify: activity-slots

**Result:** boots and renders. `/prototype/activity-slots?variant=E` returns 200 with no Next error overlay, no page errors and no console errors. Date 2026-09-27, port 3132.

## Commands and timings

```sh
git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-activity-slots prototype-approved/activity-slots
# HEAD is now at eea4ac7 PROTOTYPE: cleaner + Modifier form and modifier list (Wayfinder #106)
cp /home/andreas/repos/everythingpath/everythingpath/{.env,.env.local} /tmp/ep-ref-activity-slots/
cd /tmp/ep-ref-activity-slots
pnpm install --offline --frozen-lockfile        # FAILED in 0.4 s (see below)
pnpm install --prefer-offline --frozen-lockfile # workaround, OK in 2 m 1 s (558 packages)
setsid pnpm exec next dev --turbopack -p 3132 > /tmp/ep-ref-activity-slots.log 2>&1 < /dev/null &
# Next.js 16.1.1 (Turbopack), "Ready in 663ms"
curl -s -o /dev/null -w '%{http_code} %{time_total}\n' 'http://localhost:3132/prototype/activity-slots?variant=E'
# 200 2.60 s (first compile 2.2 s)
```

## Errors and workaround

- `pnpm install --offline --frozen-lockfile` failed with `ERR_PNPM_NO_OFFLINE_TARBALL`. The tarball for `@clerk/nextjs@6.37.3` (the version this older snapshot locks) is not in the local pnpm store.
- **Workaround:** `pnpm install --prefer-offline --frozen-lockfile`, which fetched the missing packages from the registry. The lockfile was not changed, and nothing was committed.

## Rendering checks (Playwright, Chromium)

- The page renders into a `fixed inset-0 overflow-y-auto` portal, so a plain `fullPage` capture shows only the viewport. The script grows the viewport to the portal's `scrollHeight` before each capture.
- `nextjs-portal` is present, but its shadow root has no error dialog. The "N" in the bottom-left corner is the Next dev indicator, not an error badge.
- Interactions exercised:
  - **Add slot:** adds an empty Slot 6 with a ✕ remove button.
  - **Selecting a slot:** shows its details below the board.
  - **+ Modifier:** opens the modifier form.
  - **Empty slot:** tapping Slot 4 opens a picker sheet with the groups "A ready team can take these", "No team needed" and "No ready team (needs a Rules Exception)", holding 17 cards.
  - **Escape:** closes the picker without placing a card.
  - **Placing Broker Market in Slot 4:** works.
- **Phone 390×844 renders but is not a usable layout.** The prototype is tablet-only: the side panel covers the board and labels clip. That is expected for this prototype; phone and desktop come from `responsive-shell` variant B.

## Screenshots

- `activity-activity-slots-{phone,tablet,desktop}.png`: the default state.
- `159-focus.png`, `161-focus.png`, `162-focus.png`, `190-focus.png`: tablet 1180×820, fullPage.
- All files are under 150 KB.

## Cleanup

The dev server's process group was killed, port 3132 was confirmed free, and the worktree was removed with `git worktree remove --force /tmp/ep-ref-activity-slots`.
