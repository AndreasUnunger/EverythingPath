## How to run a pinned prototype

Each ticket's **Pinned area prototypes** section links a fixed commit, a route and the approved variant. The prototypes are a visual reference only and are never merged. Later amendments in the owning spec override prototype behaviour, and mock data is not a rules contract. Each area spec's **3. Prototypes** section lists screenshots and the known deviations. Most questions can be answered from those without running anything.

Every pinned commit is protected by a `prototype-approved/<name>` tag, so it keeps working even if its `prototype/*` branch is deleted.

| Prototype | Tag | Approved route |
| --- | --- | --- |
| Upkeep | `prototype-approved/upkeep` | `/prototype/upkeep?variant=A` |
| Activity | `prototype-approved/activity-slots` | `/prototype/activity-slots?variant=E` |
| Event | `prototype-approved/event` | `/prototype/event?variant=A` |
| Persistent | `prototype-approved/persistent` | `/prototype/persistent?variant=A` |
| Week layout | `prototype-approved/week-layout` | `/prototype/week-layout?variant=A` |
| Review & confirm | `prototype-approved/summary` | `/prototype/summary?variant=B` |
| Setup and corrections | `prototype-approved/setup-correction` | `/prototype/setup-correction?variant=B` (`&screen=militia` for corrections) |
| Characters & officers | `prototype-approved/characters-officers` | `/prototype/characters-officers?variant=B` |
| Finished weeks | `prototype-approved/finished-weeks` | `/prototype/finished-weeks?variant=A` |
| Campaign list/home | `prototype-approved/campaign-home` | `/prototype/campaign-home?variant=B` |
| Week shell (phone/desktop) | `prototype-approved/responsive-shell` | `/prototype/responsive-shell?variant=B`; one phase: `/prototype/responsive-shell/screen?variant=B&phase=<phase>` |
| Pages (phone/desktop) | `prototype-approved/responsive-pages` | `/prototype/responsive-pages?variant=C` (choose the page in the state panel, or `&page=<page>`) |
| Navigation | `prototype-approved/navigation` | `/prototype/navigation?variant=E` |

Run one in a throwaway worktree, never in your implementation checkout:

```bash
name=upkeep   # tag suffix from the table
git worktree add --detach "/tmp/ep-ref-$name" "prototype-approved/$name"
cd "/tmp/ep-ref-$name"
pnpm install --offline --frozen-lockfile --store-dir "$(cd <main checkout> && pnpm store path)"
#   real install: Turbopack rejects a symlinked node_modules; /tmp is a separate filesystem,
#   so without --store-dir pnpm uses an empty store there and the offline install fails.
#   If a package is missing from the store (seen for activity-slots), use --prefer-offline instead of --offline.
cp <main checkout>/.env <main checkout>/.env.local .   # without them pages fail on ConvexReactClient
pnpm exec next dev --turbopack -p <free port>   # check `ss -ltn`; avoid 3001, used by other previews
```

Open `http://localhost:<port><route>`. `/prototype/*` routes need no login. Some prototypes have a state panel for choosing scenarios; each ticket's **Focus** line says which choices show that slice. The `pnpm prototype` script in each branch has a hard-coded port, so pass `-p` directly as shown instead. When finished, stop the server and run `git worktree remove --force /tmp/ep-ref-$name`.
