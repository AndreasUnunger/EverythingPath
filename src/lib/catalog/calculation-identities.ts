// The single source of truth for Catalog calculation identities. This module names the hash of
// catalogCalculationV1Files, so it must stay outside that closure. When a calculation file changes
// before first activation, run `pnpm catalog:pin`, then in one change:
// 1. set currentCalculationIdentity (and the independent literal in
//    tests/catalogRuntimeCompatibility.test.ts) to the printed identity;
// 2. move the old current identity to retainedPriorCalculationIdentity;
// 3. push the old prior identity onto the front of supersededCalculationIdentities.
// See docs/catalog-import/releases.md.
export const currentCalculationIdentity =
  'sha256:8886e8d9739739831604b4fda6f11ea3c3b7c4a38d6a0cfc5c1492448ed93b92';

// #318 retains the previous identity: the dispatcher accepts it alongside the current one.
export const retainedPriorCalculationIdentity =
  'sha256:becf4290fdf699293d79c24d577e75dddde57919ad7291d8ea7b0eaebdc73cfc';

// Earlier identities, newest first. The dispatcher rejects them.
export const supersededCalculationIdentities = [
  'sha256:c34f3f686fc800ec766394a7a8fb747d317da5de31e4d00def22c25c6542e5c6',
  'sha256:cbdc087920f8f8027046422551e15dbb0151488bffd07ddc9375bead9021e539',
  'sha256:a0a094c701ddeb6123a372b6106ae32d22969bdf4a256c1bfaf2320c34d48bf0',
  'sha256:404dc533a4f5212248f8c8aa720de4115d85196b171e802d6d2cceff56aa9982',
  'sha256:10de1531a3f695d0eb5a42a632047548ca7f1afd4c8b59e48d9804ec940dbc07',
  'sha256:7a6006e58cfc1d2ed3c438033e53b82ef1d70cc9569449ecb6d6f00d8cc3f366',
  'sha256:65b39be01f2e0a0ab0abc5cf9c626b4344ed2e40f60fb1b4418ae7b9d509e6fd',
] as const;
