# WebKit `access` failure: independent review (read-only)

## Timeline (artifacts, `report.html` in each run)

| time (09-27) | run | spec state | webkit-tablet access |
|---|---|---|---|
| 09-26 22:53 to 14:45 | 15 runs | `shell-navigation.ts` already did militia Back/Forward/reload (`git show 88a9f13^:e2e/support/shell-navigation.ts:53-57`) | passed, ~48 s |
| 17:08 | XxSqla | `f1eccb7` home flow: select, reload, Back (same order as today) | reached Week, timed out at 60 s |
| 17:29, 17:46 | C4MBwN, IKQBdO | `88a9f13`: concurrent landings, Back/Forward before reload | `page.reload: Too many redirects` at `shell-navigation.ts:57` (player on militia, outsider not yet in its loop) |
| 18:05 | xsix69 | `9a5ae92`: sequential, reload before Back | `campaign-home.ts:63` Back stayed on `/campaigns/<id>` |

So the reload-then-Back sequence passed once (XxSqla) and failed once; the militia reload passed ~15 times before failing twice. Both symptoms are intermittent and WebKit-only. Clerk was not bumped since the 09-14 fix (`git log --since=2026-09-13 -- package.json`).

## What the app does (rules out app-side navigation)

- Only server redirects: `src/app/page.tsx:4`, `canonical-*/page.tsx:13`, `militia/correct/page.tsx:12`. None can loop. `src/proxy.ts:3` is bare `clerkMiddleware()`; no `auth.protect()`.
- Default selection is pure state: `home-state.ts:105` picks `campaigns[0]`; no `router.replace`. The row is a plain `GuardedLink` (`campaign-home-view.tsx:64-67`). The only `router.push` on the home is after create (`use-campaign-home.ts:89`).
- `browser-history.ts` (from #149, not #187) can re-navigate only when `shouldBlock()` is true (`:129-134`), i.e. `committing || store.getPendingWork()` (`navigation-guard.tsx:96`). The list shell has no workspace provider, so `store` is null there. It never pushes.
- Conclusion: nothing in #187 pushes, replaces, or redirects around `/campaigns`.

## Hypotheses

**H1 (redirect loop, confidence ~75%): Clerk dev-instance handshake loop, environment-specific.**
Only Clerk can emit a 3xx chain here. The README documents this exact WebKit loop on 09-14 (`e2e/README.md:638-646`): `Domain=localhost` cookies rejected by WebKit, "fixed" by moving browsers to `127.0.0.1` while the server keeps `--hostname localhost` (`e2e/start-server.ts:14-15`, `e2e/run.ts:100-102`). Clerk's loop guard is a host-only cookie with `Max-Age=2` and stops at 3 (`@clerk/backend/dist/index.js:5537-5544`, `:5850-5860`); a chain of >20 redirects therefore means WebKit is dropping or not returning a cookie the middleware sets (`__clerk_redirect_count`, `__session`, or `__client_uat`), or the cookie expires mid-chain. Speculative trigger for why it is intermittent: the 60 s `__session` refresh boundary (contexts start from a minutes-old `storageState`, `fixtures.ts:210-216`, `auth.setup.ts:97-100`), or the `PrimaryDomainCrossOriginSync` forced handshake (`index.js:6008-6013`), which depends on the `Referer` WebKit attaches to reload/back loads and on `clerkUrl.origin` (`index.js:4567-4578`). Which one it is cannot be told without a network capture.

**H2 (Back, confidence ~50%): the same failed load, hidden.** After a reload, the `/campaigns` entry belongs to a destroyed document, so Back is a cross-document server load. Playwright's `goBack()` resolves on the first navigation event including same-document ones (`coreBundle.js:22536`, `:23657-23664` with `requiresNewDocument=false`); if a `replaceState` fires first, a subsequently aborted back load leaves the URL at `/campaigns/<id>` and no error surfaces. Alternative (~30%): a WebKit history quirk with reload of a `pushState` entry; nothing in the app can produce it. Reordering reload/Back in `9a5ae92` only swapped which symptom appears.

## App bug or harness bug?

Harness/environment, on the evidence: dev-instance handshake, loopback origin split, stale storage-state sessions, WebKit cookie rules. Production Safari uses HTTPS, a real domain, a production Clerk instance with no `__clerk_db_jwt`, and no hostname split, so H1 does not transfer. What I cannot tell without running: whether WebKit sends a `Referer` on reload/Back that Chromium omits, and whether any Set-Cookie in the chain carries an attribute WebKit rejects.

## Smallest diagnostic

On the WebKit player context only, one run: `browser.newContext({ recordHar: { path: <.private>/webkit-player.har, content: 'omit' } })`, plus a `page.on('response')` log of document responses printing status, `location`, and Clerk's `x-clerk-auth-status` / `x-clerk-auth-reason` headers (the reason names the handshake cause). Log `context.cookies()` names, domain, and expiry (never values) before each reload/Back, and the return value of `goBack()` (null vs response). Keep the HAR in `.private`; `artifacts.ts:58` only redacts the timeline. A unit test of the selection hook proves nothing: it has no navigation. The on-disk `webkit-probe` edit is heading this way.

## Recommendation

1. Run the diagnostic before touching ordering again.
2. If the reason is a cookie attribute or origin mismatch: fix the environment (one hostname for server and browser once the Next loopback rewrite bug allows, or a matching `-H 127.0.0.1`), not the app.
3. If it is the session-age boundary: mint role sessions closer to the WebKit projects, or gate the two history assertions with the existing project check (`access.spec.ts:36-40`) and leave Chromium/Firefox strict.
4. Do not: add `waitForTimeout`, raise the 15 s or 60 s limits, wrap `reload`/`goBack` in retries, loosen `toHaveURL(/\/campaigns$/)`, or reorder reload/Back a third time without evidence.
