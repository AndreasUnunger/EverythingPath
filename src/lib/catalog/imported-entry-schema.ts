import {
  alignmentSchema,
  prerequisiteSchema,
} from '../character-sheet-prerequisite-schema.ts';
import { z } from 'zod';
import { abilitySchema, outputSchema } from './curation-output-schema.ts';

const progression = {
  hitDie: z.number(),
  bab: z.enum(['full', 'threeQuarters', 'half']),
  saves: z.object({
    fort: z.enum(['good', 'poor']),
    ref: z.enum(['good', 'poor']),
    will: z.enum(['good', 'poor']),
  }),
  classSkills: z.array(z.string()),
};
const companion = {
  abilities: z.record(z.string(), z.number()),
  size: z.string().optional(),
  creatureTypes: z.array(z.string()),
};
const companionFeature = { tag: z.string(), associations: z.array(z.string()) };

export const importedSpellDetailSchema = z.object({
  kind: z.literal('spell'),
  levels: z.record(z.string(), z.number()),
  grantedLevels: z.record(z.string(), z.record(z.string(), z.number())),
  school: z.string(),
  subschools: z.array(z.string()),
  descriptors: z.array(z.string()),
});

// These are the importer's release bodies. Prepared, character-scoped catalog
// entries use database IDs and a narrower detail contract instead.
export const importedDetailSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('race'),
    racialHitDice: z.number(),
    creatureTypes: z.array(z.string()),
    creatureSubtypes: z.array(z.string()),
  }),
  z.object({
    kind: z.literal('class'),
    ...progression,
    tag: z.string(),
    classKind: z.enum(['base', 'prestige', 'npc']),
    alignments: z.array(alignmentSchema).optional(),
    skillRanksPerLevel: z.number(),
    featuresByLevel: z.array(
      z.object({ classLevel: z.number(), externalKey: z.string() }),
    ),
    casting: z
      .object({
        ability: z.string().optional(),
        spellKind: z.string().optional(),
        casterLevelOffset: z.number().optional(),
        type: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal('creatureType'),
    ...progression,
    tag: z.string(),
    skillRanksPerHitDie: z.number(),
  }),
  z.object({ kind: z.literal('classFeature') }),
  z.object({ kind: z.literal('manual') }),
  z.object({
    kind: z.literal('feat'),
    featTypes: z.array(z.string()),
    repeatable: z.enum(['no', 'newChoice', 'yes', 'unreviewed']),
    additionalTraits: z.literal(true).optional(),
  }),
  z.object({ kind: z.literal('trait'), traitType: z.string() }),
  z.object({
    kind: z.literal('racialTrait'),
    races: z.array(z.string()),
    bonusSkillRanksPerLevel: z.number(),
  }),
  importedSpellDetailSchema,
  z.object({
    kind: z.literal('spellEffect'),
    defaultCasterLevel: z.number(),
    lastsOverOneDay: z.boolean(),
    spellKey: z.string().optional(),
  }),
  z.object({
    kind: z.literal('item'),
    consumable: z.boolean(),
    price: z.number(),
    weight: z.number(),
    weapon: z
      .object({
        baseTypes: z.array(z.string()),
        groups: z.array(z.string()),
        proficiency: z.string(),
        handedness: z.string(),
        dice: z.string().nullable(),
        damageTypes: z.array(z.string()),
        threat: z.number(),
        mult: z.number(),
        finesse: z.boolean(),
        thrown: z.boolean(),
        rangeIncrement: z.number().optional(),
      })
      .optional(),
    armor: z
      .object({
        slot: z.enum(['armor', 'shield']),
        category: z.string(),
        bonus: z.number(),
        maxDex: z.number().nullable(),
        armorCheckPenalty: z.number().nonnegative(),
        asf: z.number(),
      })
      .optional(),
    magic: z
      .object({
        enhancement: z.number().int().nonnegative(),
        masterwork: z.boolean(),
      })
      .optional(),
  }),
  abilitySchema.omit({ sourceKey: true }).extend({
    kind: z.literal('itemAbility'),
    appliesTo: z.string().nullable(),
  }),
  z.object({ kind: z.literal('companionFeature'), ...companionFeature }),
  z.object({ kind: z.literal('companion'), ...companion }),
  z.object({ kind: z.literal('familiar'), ...companion }),
  z.object({ kind: z.literal('eidolonForm'), ...companion }),
  z.object({ kind: z.literal('eidolonEvolution'), ...companionFeature }),
]);

export const importedCatalogEntrySchema = z.object({
  externalKey: z.string().min(1),
  upstreamKey: z.string().min(1),
  pack: z.string().min(1),
  name: z.string().min(1),
  detail: importedDetailSchema,
  description: z.string(),
  guidanceText: z.string().optional(),
  prerequisiteText: z.string().optional(),
  prerequisites: z.array(prerequisiteSchema).optional(),
  grantsSlots: z
    .array(z.object({ kind: z.enum(['feat', 'trait']), count: z.number() }))
    .optional(),
  sources: z.array(
    z.object({ book: z.string(), pages: z.string().optional() }),
  ),
  // Import mapping also retains spelled-out skill targets; they are release
  // bodies, before the character-scoped resolver assigns numeric leaf targets.
  modifiers: z.array(
    outputSchema.options[0].omit({ kind: true }).extend({
      target: z.string().min(1),
      bonusType: z.string().min(1),
    }),
  ),
  situationalNotes: z
    .array(outputSchema.options[1].omit({ kind: true }))
    .optional(),
  sourceKey: z.string().optional(),
  unsupported: z.array(
    z.object({
      field: z.string(),
      reason: z.string(),
      value: z.any().optional(),
    }),
  ),
});

export const reviewedRemapSchema = z.object({
  from: z.string().regex(/^(pf1|pf1-content)\/[A-Za-z0-9]+$/),
  to: z.string().regex(/^(pf1|pf1-content)\/[A-Za-z0-9]+$/),
  kind: z.string().min(1),
  reason: z.string().min(1),
  evidence: z.string().min(1),
  reviewedBy: z.string().min(1),
  reviewedOn: z.iso.date(),
});
export const appliedRemapSchema = reviewedRemapSchema.extend({
  applied: z.literal(true),
});
