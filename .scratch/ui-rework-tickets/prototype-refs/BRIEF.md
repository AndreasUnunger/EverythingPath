# Prototype reference brief (shared by all prototype agents)

Goal: help implementers of #148 tickets use the approved prototypes. Work ONLY locally. Do NOT write to GitHub (no gh edit/comment/create, no git push, no commits) and do NOT touch existing worktrees (~/repos/everythingpath/ep-*, upkeep-proto, event-proto, ~/.t3/worktrees/*) or servers on other ports.

Main repo: /home/andreas/repos/everythingpath/everythingpath. Each pinned prototype has a tag `prototype-approved/<name>`.

## 1. Boot and verify (does the pinned prototype still run?)
- `git -C /home/andreas/repos/everythingpath/everythingpath worktree add --detach /tmp/ep-ref-<name> prototype-approved/<name>`
- In the worktree: `pnpm install --offline --frozen-lockfile --store-dir /home/andreas/.local/share/pnpm/store/v10` (/tmp is tmpfs, so pnpm otherwise picks an empty store). If a package is missing from the store, use `--prefer-offline` instead of `--offline`. (no symlinked node_modules; Turbopack rejects them). Copy `.env` and `.env.local` from the main repo (without them pages 500 on ConvexReactClient).
- Start `pnpm exec next dev --turbopack -p <your port>` in the background (setsid, log to /tmp/ep-ref-<name>.log). Never use 3001 or 3011–3021. `/prototype/*` routes need no login.
- Verify the approved route returns 200 and renders with no Next error overlay. Record the exact commands, timings, errors and any workaround in `verify.md`. If it fails, diagnose briefly and try non-committed fixes in the worktree; report honestly. Do not change the prototype's code to "improve" it.

## 2. Screenshots
- Playwright: write the script in /tmp, `import { chromium } from "@playwright/test"`, and run it with `node` from inside the worktree so module resolution works (chromium is cached in ~/.cache/ms-playwright).
- Area overview: the approved variant at phone 390×844, tablet 1180×820 and desktop 1440×900, fullPage. Name them `<area>-<proto>-{phone,tablet,desktop}.png`.
- Per-ticket focus: see 3. Tablet 1180×820, fullPage; name `<ticket>-focus.png`. Keep PNGs under ~1.5 MB (use `scale: "css"`).
- Look at every PNG you produce (Read it) to confirm it shows what you claim.

## 3. Per-ticket focus
For each listed ticket, read its "What to build" and acceptance criteria (`gh issue view N`). Read the prototype's source (`src/app/prototype/<name>/…`) to find how to reach the state that shows that slice: query params, state-panel choices and clicks. Write one or two sentences, e.g. "Open `/prototype/event?variant=A`, choose *Rivalry* in the state panel, then expand the second occurrence; the per-target check rows are the reference." If the prototype has no surface for the slice (backend, compatibility or migration work), say so plainly and set the screenshot to null.

## 4. Deviations ("don't copy from the prototype")
From the owning spec (and the amendments it links), list concrete prototype behaviours or mock data that implementers must NOT copy. Each bullet names the prototype behaviour and cites the spec section (and amendment comment URL where relevant). Add anything you observe in the running prototype that contradicts the spec's acceptance. At most 10 bullets per area; no generic boilerplate.

## Output
Write to `/home/andreas/repos/everythingpath/everythingpath/.scratch/ui-rework-tickets/prototype-refs/<group>/`:
- the PNGs
- `focus.json`: `{"<ticket>": {"prototype": "<name>", "focus": "…", "screenshot": "<file>|null"}}`
- `deviations-<area>.md` (one per owning area)
- `verify.md`

## Cleanup
Stop your dev server (kill its process group), confirm the port is free, then `git -C /home/andreas/repos/everythingpath/everythingpath worktree remove --force /tmp/ep-ref-<name>`.

Reply with at most 120 words: whether each prototype booted, the number of screenshots, and anything notable.
