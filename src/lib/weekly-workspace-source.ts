import { z } from 'zod';
import { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import { militiaSnapshotSchema } from './canonical-weekly-source';
export const workspaceSourceSchema = z.strictObject({
  key: draftKeySchema,
  sourceRevision: z.number().int().nonnegative(),
  snapshot: militiaSnapshotSchema,
  people: z.array(
    z.strictObject({ characterId: z.string(), name: z.string().nullable() }),
  ),
});
export type WorkspaceSource = z.infer<typeof workspaceSourceSchema>;
