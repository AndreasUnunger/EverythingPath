import type { Infer } from "convex/values";
import { type spellValidator } from "./schema";

export type Spell = Infer<typeof spellValidator>;
