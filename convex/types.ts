import type { Infer } from "convex/values";
import { spellValidator } from "./schema";

export type Spell = Infer<typeof spellValidator>;
