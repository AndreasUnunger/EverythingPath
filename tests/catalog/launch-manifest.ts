import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchManifest } from '../../scripts/catalog/launch-inventory-schema';

function deepFreeze(value: unknown) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value))
    return;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
}

/**
 * Decodes a committed inventory document once and returns a factory for
 * independent manifests. Each manifest comes from the public parser, which
 * validates the decoded value and copies every object, so one case's edits
 * never reach another. The decoded value is frozen: editing it, or a copy that
 * kept one of its objects, throws instead of leaking into later cases.
 */
export function launchManifestCopies(document: unknown): () => LaunchManifest {
  const decoded = parseLaunchInventory(document);
  deepFreeze(decoded);
  return () => parseLaunchInventory(decoded);
}
