import { readFileSync } from 'node:fs';
import { z } from 'zod';

/**
 * Counts the raw commitments in an earlier batch's whole-history manifest
 * (`preserved.json`). The manifests stay on disk until the #744 cleanup, but
 * no check reads their contents (#749). Reading one only where a test asks
 * keeps the 10 MB file out of every import of its fixture (#750, T-02).
 */
export function getPreservedRawCommitmentCount(manifestUrl: URL) {
  return z
    .object({ rawCommitments: z.array(z.unknown()) })
    .parse(JSON.parse(readFileSync(manifestUrl, 'utf8'))).rawCommitments.length;
}
