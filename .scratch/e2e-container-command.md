# Isolated-preview E2E in the Playwright Ubuntu container

Verified 2026-09-27: preflight and a complete nightly run (`everythingpath-e2e-XxSqla`, all 19 tests executed) at `b83dadb`.
Native Arch WebKit crashes, so run the gate in `mcr.microsoft.com/playwright:v1.63.0-noble`
(the image version must match `@playwright/test` in `pnpm-lock.yaml`).

Why this layout:

- Repo is bind-mounted at its host path so the absolute `--resources`/`--secrets` paths work
  and `e2e-artifacts/` and the slot lock land in the real checkout.
- `node_modules` is shadowed by a host directory outside the repo, so the container gets its
  own Linux/Node 24 install and the host's `node_modules` is untouched. The runner copies
  `node_modules` into its temporary workspace, so it must be the container-built one.
- `--user 1000:1001` keeps artifacts owned by `andreas`.
- `HOME=/ephome` is a writable host directory. The runner forwards only `PATH`/`HOME`/`TMPDIR`
  (not `PLAYWRIGHT_BROWSERS_PATH`) to Playwright, so `$HOME/.cache/ms-playwright` must be a
  symlink to the image's `/ms-playwright`.
- pnpm comes from corepack, enabled into `/ephome/bin` (non-root cannot write `/usr/bin`).
- `--network host` lets Playwright reach the loopback `next start` server and Clerk/Convex.
- Docker passes no host env, and `env -u ...` additionally strips any Convex/Clerk selectors.
- The resources and secrets files are mounted read-only on top of the writable repo mount
  (`e2e/.private` itself must stay writable for the slot lock).
- Do not create/modify untracked, non-ignored repo files (e.g. `.scratch/`) while a run is
  preparing: they are part of the source fingerprint.

## One-time setup (per install; delete `$C` afterwards)

```bash
R=/home/andreas/repos/everythingpath/everythingpath
C=/home/andreas/.cache/ep-e2e-container
mkdir -p $C/home/bin $C/home/.cache $C/node_modules
ln -sfn /ms-playwright $C/home/.cache/ms-playwright

docker run --rm --init --network host --ipc host --user 1000:1001 \
  -e HOME=/ephome -e PATH=/ephome/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -e npm_config_store_dir=/ephome/pnpm-store \
  -v $R:$R -v $C/node_modules:$R/node_modules -v $C/home:/ephome \
  -w $R mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -c 'corepack enable --install-directory /ephome/bin && pnpm install --frozen-lockfile'
```

## Gate (run with `--preflight` first, then without)

```bash
R=/home/andreas/repos/everythingpath/everythingpath
C=/home/andreas/.cache/ep-e2e-container
docker run --rm --init --name ep-e2e-nightly --network host --ipc host --user 1000:1001 \
  -e HOME=/ephome -e PATH=/ephome/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -e npm_config_store_dir=/ephome/pnpm-store \
  -e E2E_TRUSTED_EXECUTION=true \
  -v $R:$R -v $C/node_modules:$R/node_modules -v $C/home:/ephome \
  -v $R/e2e/.private/resources.json:$R/e2e/.private/resources.json:ro \
  -v $R/e2e/.private/test-secrets.env:$R/e2e/.private/test-secrets.env:ro \
  -w $R mcr.microsoft.com/playwright:v1.63.0-noble \
  env -u CONVEX_DEPLOYMENT -u NEXT_PUBLIC_CONVEX_URL -u CONVEX_URL -u NEXT_PUBLIC_CONVEX_SITE_URL \
      -u CLERK_FRONTEND_API_URL -u CLERK_API_URL -u CI \
  pnpm test:e2e --resources $R/e2e/.private/resources.json \
    --secrets $R/e2e/.private/test-secrets.env --nightly   # add --preflight for the check
```

Evidence: `$R/e2e-artifacts/e2e-local-andreasununger-slot-0/<runId>/`.
If the container is killed, check `docker ps` for `ep-e2e-nightly` before removing
`$R/e2e/.private/e2e-local-andreasununger-slot-0.lock`.

Cleanup: `rm -rf /home/andreas/.cache/ep-e2e-container`.

Diagnosing a failed "preview deployment and web build" stage: Convex deploy typechecks with
`convex/tsconfig.json` (older lib target), which the root `pnpm typecheck` does not cover:

```bash
docker run --rm --user 1000:1001 -e HOME=/ephome -e PATH=/ephome/bin:/usr/bin:/bin \
  -v $R:$R -v $C/node_modules:$R/node_modules -v $C/home:/ephome -w $R \
  mcr.microsoft.com/playwright:v1.63.0-noble pnpm exec tsc -p convex/tsconfig.json --noEmit
```
