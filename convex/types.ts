import type { Infer } from 'convex/values';
import { type spellValidator } from './schema';
import type { MutationCtx, QueryCtx } from './_generated/server';

export type Spell = Infer<typeof spellValidator>;
export type ReadCtx = QueryCtx | MutationCtx;
