import {
  alignmentSchema,
  prerequisiteAtomSchema,
  prerequisiteSchema,
} from '../src/lib/character-sheet-prerequisite-schema';
import { armorCategories } from '../src/lib/character-sheet-armor-categories';
import { proficiencyCategories } from '../src/lib/character-sheet-proficiencies';
import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { defineSchema, defineTable } from 'convex/server';
import {
  draftStorageValidator,
  operationStorageValidator,
  recordStorageValidator,
} from './lib/canonicalStorageValidators';
import { v } from 'convex/values';
import {
  catalogReleaseManifestValidator,
  catalogReleaseRowValidator,
} from '../src/lib/catalog/release-validators';
import {
  abilityKeys,
  abilityTargets,
  bonusTypes,
  modifierConditionSchema,
  modifierTargets,
  catalogModifierTargets,
  creatureSizes,
} from '../src/lib/character-sheet';
import { conditionKeys } from '../src/lib/character-sheet-conditions';
import { classCastingSchema } from '../src/lib/character-sheet-casting-tables';
export const archetypeReplacementValidator = v.object({
  classLevel: v.number(),
  catalogEntryId: v.id('catalogEntry'),
  scope: v.optional(v.union(v.literal('whole'), v.literal('part'))),
});
export const archetypeFeatureChangeValidator = v.union(
  v.object({ featureIdentity: v.string(), scope: v.literal('whole') }),
  v.object({
    featureIdentity: v.string(),
    scope: v.literal('part'),
    part: v.string(),
  }),
);

export const spellValidator = v.object({
  name: v.string(),
  spellLevel: v.string(),
  school: v.string(),
  subschool: v.string(),
  descriptor: v.string(),
  castingTime: v.string(),
  components: v.string(),
  hasCostlyComponents: v.boolean(),
  range: v.string(),
  area: v.string(),
  effect: v.string(),
  targets: v.string(),
  duration: v.string(),
  dismissible: v.boolean(),
  shapeable: v.boolean(),
  savingThrow: v.string(),
  spellResistance: v.string(),
  description: v.string(),
  descriptionFormatted: v.string(),
  source: v.string(),
  fullText: v.string(),
  verbal: v.boolean(),
  somatic: v.boolean(),
  material: v.boolean(),
  requiresFocus: v.boolean(),
  requiresDivineFocus: v.boolean(),
  sorcerer: v.nullable(v.number()),
  wizard: v.nullable(v.number()),
  cleric: v.nullable(v.number()),
  druid: v.nullable(v.number()),
  ranger: v.nullable(v.number()),
  bard: v.nullable(v.number()),
  paladin: v.nullable(v.number()),
  alchemist: v.nullable(v.number()),
  summoner: v.nullable(v.number()),
  witch: v.nullable(v.number()),
  inquisitor: v.nullable(v.number()),
  oracle: v.nullable(v.number()),
  antipaladin: v.nullable(v.number()),
  magus: v.nullable(v.number()),
  adept: v.nullable(v.number()),
  deity: v.string(),
  SLALevel: v.nullable(v.number()),
  domain: v.string(),
  shortDescription: v.string(),
  acid: v.boolean(),
  air: v.boolean(),
  chaotic: v.boolean(),
  cold: v.boolean(),
  curse: v.boolean(),
  darkness: v.boolean(),
  death: v.boolean(),
  disease: v.boolean(),
  earth: v.boolean(),
  electricity: v.boolean(),
  emotion: v.boolean(),
  evil: v.boolean(),
  fear: v.boolean(),
  fire: v.boolean(),
  force: v.boolean(),
  good: v.boolean(),
  languageDependent: v.boolean(),
  lawful: v.boolean(),
  light: v.boolean(),
  mindAffecting: v.boolean(),
  pain: v.boolean(),
  poison: v.boolean(),
  shadow: v.boolean(),
  sonic: v.boolean(),
  water: v.boolean(),
  linkText: v.nullable(v.string()),
  id: v.number(),
  materialCosts: v.nullable(v.number()),
  bloodline: v.string(),
  patron: v.string(),
  mythicText: v.string(),
  augmented: v.string(),
  mythic: v.boolean(),
  bloodrager: v.nullable(v.number()),
  shaman: v.nullable(v.number()),
  psychic: v.nullable(v.number()),
  medium: v.nullable(v.number()),
  mesmerist: v.nullable(v.number()),
  occultist: v.nullable(v.number()),
  spiritualist: v.nullable(v.number()),
  skald: v.nullable(v.number()),
  investigator: v.nullable(v.number()),
  hunter: v.nullable(v.number()),
  ruse: v.boolean(),
  draconic: v.boolean(),
  meditative: v.boolean(),
  summonerUnchained: v.nullable(v.number()),
});

// Stored record kinds (see src/lib/character-kind.ts).
export const characterKindValidator = v.union(
  v.literal('pc'),
  v.literal('npc'),
);

export const characterSheetModeValidator = v.union(
  v.literal('militiaOnly'),
  v.literal('full'),
);
export const characterValidator = v.object({
  name: v.string(),
  ownerId: v.optional(v.string()),
  ownerLastOperationId: v.optional(v.string()),
  campaignId: v.optional(v.id('campaign')),
  sheetDemo: v.optional(v.literal(true)),
  description: v.string(),
  kind: characterKindValidator,
  isActive: v.boolean(),
  sheetMode: v.optional(characterSheetModeValidator),
  sheetRevision: v.optional(v.number()),
  sheetLastOperationId: v.optional(v.string()),
  sheetUpdatedBy: v.optional(v.string()),
  level: v.number(),
  strength: v.number(),
  dexterity: v.number(),
  constitution: v.number(),
  wisdom: v.number(),
  charisma: v.number(),
  intelligence: v.number(),
});

const modifierConditionValidator = zodOutputToConvex(
  modifierConditionSchema,
).extend({
  situation: v.optional(
    v.union(
      v.string(),
      v.object({ local: v.string() }),
      v.object({ option: v.id('catalogEntry') }),
    ),
  ),
  whileActive: v.optional(v.id('catalogEntry')),
});
export const modifierValidator = v.object({
  target: v.union(...modifierTargets.map((target) => v.literal(target))),
  bonusType: v.union(...bonusTypes.map((type) => v.literal(type))),
  value: v.union(v.number(), v.object({ formula: v.string() })),
  condition: v.optional(modifierConditionValidator),
  stacksWithinEntry: v.optional(v.literal(true)),
});
export const catalogModifierValidator = modifierValidator
  .omit('target')
  .extend({
    target: v.union(
      ...catalogModifierTargets.map((target) => v.literal(target)),
    ),
  });
const baseModifierValidator = modifierValidator
  .pick('target', 'bonusType', 'value')
  .extend({
    target: v.union(
      ...Object.values(abilityTargets).map((target) => v.literal(target)),
    ),
    bonusType: v.literal('base'),
    value: v.number(),
  });
export const grantKeyValidator = v.object({
  source: v.string(),
  classLevel: v.optional(v.number()),
  entry: v.string(),
});
export const companionKindValidator = v.union(
  v.literal('animalCompanion'),
  v.literal('familiar'),
  v.literal('cohort'),
  v.literal('eidolon'),
  v.literal('unchainedEidolon'),
);
export const companionSourceValidator = v.object({
  key: v.string(),
  label: v.string(),
  enabled: v.boolean(),
  sheetEntryId: v.optional(v.id('characterSheetEntry')),
  grantKey: v.optional(grantKeyValidator),
});
export const companionStatusValidator = v.union(
  v.literal('active'),
  v.literal('interrupted'),
  v.literal('replaced'),
);
export const selectionReferenceValidator = v.union(
  v.object({ kind: v.literal('grant'), grantKey: grantKeyValidator }),
  v.object({ kind: v.literal('entry'), entryId: v.id('characterSheetEntry') }),
);
export const selectionSourceValidator = v.union(
  v.object({
    kind: v.literal('classPrompt'),
    source: v.string(),
    classLevel: v.number(),
    list: v.string(),
  }),
  v.object({
    kind: v.literal('slot'),
    grantedBy: selectionReferenceValidator,
    slotIndex: v.optional(v.number()),
  }),
  v.object({
    kind: v.literal('prompt'),
    source: selectionReferenceValidator,
    list: v.string(),
    classLevel: v.optional(v.number()),
  }),
);
const recordedCatalogEntryFields = {
  grantKey: v.optional(grantKeyValidator),
  kept: v.optional(v.literal(true)),
  catalogOverride: v.optional(v.literal(true)),
  notes: v.optional(v.string()),
  gainedAtClassLevel: v.optional(v.id('characterSheetEntry')),
  choiceOrder: v.optional(v.number()),
  selectionSource: v.optional(selectionSourceValidator),
  selectionSlot: v.optional(v.object({ id: v.string(), position: v.number() })),
};
const picksByLevelValidator = v.array(
  v.object({
    classLevel: v.number(),
    list: v.string(),
    count: v.number(),
  }),
);
export const selectionKindValidator = v.union(
  v.literal('race'),
  v.literal('racialTrait'),
  v.literal('archetype'),
  v.literal('classFeature'),
  v.literal('feat'),
  v.literal('trait'),
);
export const manualProficiencyValidator = v.union(
  v.object({
    category: v.union(
      ...proficiencyCategories.map((category) => v.literal(category)),
    ),
  }),
  v.object({ baseType: v.string(), asMartial: v.optional(v.literal(true)) }),
  v.object({ group: v.string() }),
);
export const proficiencyGrantValidator = v.union(
  ...manualProficiencyValidator.members,
  v.object({ choice: v.literal(true) }),
);
export const proficiencyPrerequisiteValidator = v.object({
  kind: v.literal('proficiency'),
  proficiency: proficiencyGrantValidator,
});
export const abilityValidator = v.union(
  ...abilityKeys.map((ability) => v.literal(ability)),
);
export const alignmentValidator = zodOutputToConvex(alignmentSchema);
export const prerequisiteAtomValidator = zodOutputToConvex(
  prerequisiteAtomSchema,
);
export const prerequisiteValidator = zodOutputToConvex(prerequisiteSchema);
const catalogEntryFields = v.object({
  scope: v.union(
    v.literal('global'),
    v.literal('campaign'),
    v.literal('character'),
  ),
  characterId: v.optional(v.id('character')),
  campaignId: v.optional(v.id('campaign')),
  copiedFrom: v.optional(v.id('catalogEntry')),
  copiedFromFingerprint: v.optional(v.string()),
  campaignPreference: v.optional(v.literal(true)),
  racialStatisticsCopy: v.optional(v.literal(true)),
  countsAsRaces: v.optional(
    v.union(v.array(v.string()), v.object({ oneOf: v.array(v.string()) })),
  ),
  proficiencies: v.optional(v.array(proficiencyGrantValidator)),
  proficiencyPrerequisites: v.optional(
    v.array(proficiencyPrerequisiteValidator),
  ),
  browseOnly: v.optional(v.literal(true)),
  importedSpell: v.optional(v.literal(true)),
  prerequisites: v.optional(v.array(prerequisiteValidator)),
  description: v.optional(v.string()),
  guidanceText: v.optional(v.string()),
  prerequisiteText: v.optional(v.string()),
  grants: v.optional(
    v.array(v.object({ catalogEntryId: v.id('catalogEntry') })),
  ),
  grantsSlots: v.optional(
    v.array(
      v.object({
        kind: v.union(v.literal('feat'), v.literal('trait')),
        count: v.number(),
        featTypes: v.optional(v.array(v.string())),
        feats: v.optional(v.array(v.id('catalogEntry'))),
        ignoresPrerequisites: v.optional(v.boolean()),
      }),
    ),
  ),
  name: v.string(),
  ruleIdentity: v.string(),
  sourceKey: v.optional(v.string()),
  stacksWithItself: v.boolean(),
  sources: v.array(
    v.object({ book: v.string(), pages: v.optional(v.string()) }),
  ),
});
export const conditionKeyValidator = v.union(
  ...conditionKeys.map((key) => v.literal(key)),
);
export const sheetEntryDetailValidator = v.union(
  v.object({
    kind: v.literal('spellEffect'),
    lastsOverOneDay: v.boolean(),
    defaultCasterLevel: v.number(),
  }),
  v.object({
    kind: v.literal('condition'),
    conditionKey: v.optional(conditionKeyValidator),
  }),
  v.object({
    kind: v.literal('item'),
    consumable: v.boolean(),
    material: v.optional(v.string()),
    weapon: v.optional(
      v.object({
        baseType: v.string(),
        proficiency: v.union(
          v.literal('simple'),
          v.literal('martial'),
          v.literal('exotic'),
          v.literal('always'),
        ),
        groups: v.optional(v.array(v.string())),
        handedness: v.optional(
          v.union(
            v.literal('light'),
            v.literal('oneHanded'),
            v.literal('twoHanded'),
          ),
        ),
        attackType: v.optional(
          v.union(v.literal('melee'), v.literal('ranged')),
        ),
        dice: v.optional(v.string()),
        damageTypes: v.optional(v.array(v.string())),
        threat: v.optional(v.number()),
        mult: v.optional(v.number()),
        thrown: v.optional(v.boolean()),
        rangeIncrement: v.optional(v.number()),
        thrownRangeIncrement: v.optional(v.number()),
        strengthDamage: v.optional(
          v.union(
            v.literal('melee'),
            v.literal('thrown'),
            v.literal('bow'),
            v.literal('compositeBow'),
            v.literal('crossbow'),
            v.literal('sling'),
          ),
        ),
        strengthRating: v.optional(v.number()),
      }),
    ),
    armor: v.optional(
      v.object({
        slot: v.union(v.literal('armor'), v.literal('shield')),
        armorCheckPenalty: v.number(),
        category: v.optional(
          v.union(...armorCategories.map((category) => v.literal(category))),
        ),
        bonus: v.optional(v.number()),
        maxDex: v.optional(v.union(v.number(), v.null())),
        asf: v.optional(v.number()),
      }),
    ),
  }),
  v.object({
    kind: v.literal('spell'),
    levels: v.optional(v.record(v.string(), v.number())),
    school: v.optional(v.string()),
    description: v.optional(v.string()),
  }),
);
export const castingValidator = zodOutputToConvex(classCastingSchema);
export const abilityChangeKindValidator = v.union(
  v.literal('abilityDamage'),
  v.literal('abilityDrain'),
);
export const racialProgressionValidator = v.object({
  creatureType: v.string(),
  hitDie: v.number(),
  bab: v.union(
    v.literal('full'),
    v.literal('threeQuarters'),
    v.literal('half'),
  ),
  saves: v.object({
    fort: v.union(v.literal('good'), v.literal('poor')),
    ref: v.union(v.literal('good'), v.literal('poor')),
    will: v.union(v.literal('good'), v.literal('poor')),
  }),
  skillRanksPerHitDie: v.number(),
  classSkills: v.array(v.string()),
});
export const catalogEntryValidator = v.union(
  catalogEntryFields.extend({
    modifiers: v.array(catalogModifierValidator),
    detail: v.union(
      v.object({
        kind: v.literal('race'),
        racialTraits: v.array(v.id('catalogEntry')),
        allowedAlternateRaces: v.optional(v.array(v.string())),
        size: v.optional(
          v.union(...creatureSizes.map((size) => v.literal(size))),
        ),
        creatureTypes: v.optional(v.array(v.string())),
        creatureSubtypes: v.optional(v.array(v.string())),
        racialHitDice: v.optional(v.number()),
        racialProgression: v.optional(racialProgressionValidator),
      }),
      v.object({
        kind: v.literal('racialTrait'),
        raceEntryIds: v.array(v.id('catalogEntry')),
        replaces: v.array(v.id('catalogEntry')),
        favoredClassCount: v.optional(v.literal(2)),
        bonusSkillRanksPerLevel: v.optional(v.number()),
        unresolvedReplacements: v.optional(v.array(v.string())),
        subrace: v.optional(v.string()),
      }),
      v.object({
        kind: v.literal('archetype'),
        classSkillsAdded: v.optional(v.array(v.string())),
        classSkillsRemoved: v.optional(v.array(v.string())),
        skillRanksPerLevel: v.optional(v.number()),
        featureChanges: v.optional(v.array(archetypeFeatureChangeValidator)),
        classEntryIds: v.array(v.id('catalogEntry')),
        replaces: v.array(archetypeReplacementValidator),
        adds: v.array(
          v.object({
            classLevel: v.number(),
            catalogEntryId: v.id('catalogEntry'),
          }),
        ),
        picksByLevel: v.optional(picksByLevelValidator),
      }),
      v.object({
        kind: v.literal('classFeature'),
        parentFeature: v.optional(v.string()),
        part: v.optional(v.string()),
        duplicateUpgrade: v.optional(v.id('catalogEntry')),
        picksByLevel: v.optional(picksByLevelValidator),
      }),
      v.object({
        kind: v.literal('feat'),
        additionalTraits: v.optional(v.literal(true)),
        featTypes: v.optional(v.array(v.string())),
        repeatable: v.optional(
          v.union(
            v.literal('no'),
            v.literal('newChoice'),
            v.literal('yes'),
            v.literal('unreviewed'),
          ),
        ),
      }),
      v.object({ kind: v.literal('trait'), traitType: v.optional(v.string()) }),
    ),
  }),
  // Prepared sheets created before advancement held class names only.
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: v.object({ kind: v.literal('class') }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: v.object({
      kind: v.literal('class'),
      counterpartOf: v.optional(v.id('catalogEntry')),
      classKind: v.union(
        v.literal('base'),
        v.literal('prestige'),
        v.literal('npc'),
      ),
      alignments: v.optional(v.array(alignmentValidator)),
      hitDie: v.number(),
      bab: v.union(
        v.literal('full'),
        v.literal('threeQuarters'),
        v.literal('half'),
      ),
      saves: v.object({
        fort: v.union(v.literal('good'), v.literal('poor')),
        ref: v.union(v.literal('good'), v.literal('poor')),
        will: v.union(v.literal('good'), v.literal('poor')),
      }),
      skillRanksPerLevel: v.number(),
      casting: v.optional(castingValidator),
      classSkills: v.array(v.string()),
      featuresByLevel: v.array(
        v.object({
          classLevel: v.number(),
          catalogEntryId: v.id('catalogEntry'),
        }),
      ),
      picksByLevel: v.array(
        v.object({
          classLevel: v.number(),
          list: v.string(),
          count: v.number(),
        }),
      ),
    }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(baseModifierValidator),
    detail: v.object({ kind: v.literal('base') }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: v.object({ kind: v.literal('manual') }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: sheetEntryDetailValidator,
  }),
);
export const creationSettingsValidator = v.object({
  abilityMethod: v.union(
    v.object({ kind: v.literal('pointBuy'), budget: v.number() }),
    v.object({ kind: v.literal('rolled'), budget: v.optional(v.number()) }),
  ),
  traitCount: v.number(),
  campaignTraitRequired: v.boolean(),
});
export const favoredClassBonusValidator = v.union(
  v.null(),
  v.object({ choice: v.literal('hp') }),
  v.object({ choice: v.literal('skill') }),
  v.object({ choice: v.literal('alt'), note: v.string() }),
);
export const attackRoutineHandsValidator = v.union(
  v.literal('one'),
  v.literal('two'),
);
export const attackRoutineModeValidator = v.union(
  v.literal('melee'),
  v.literal('ranged'),
  v.literal('thrown'),
);
export const characterSheetEntryValidator = v.union(
  v.object({
    characterId: v.id('character'),
    kind: v.literal('attackRoutine'),
    active: v.boolean(),
    state: v.object({
      kind: v.literal('attackRoutine'),
      name: v.string(),
      weaponEntryId: v.id('characterSheetEntry'),
      hands: attackRoutineHandsValidator,
      mode: attackRoutineModeValidator,
      revision: v.optional(v.number()),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('race'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('race'),
      choice: v.optional(v.union(v.string(), v.null())),
      racialHpGained: v.optional(v.union(v.number(), v.null())),
      racialSkillRanks: v.optional(v.record(v.string(), v.number())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('racialTrait'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('racialTrait'),
      choice: v.optional(v.union(v.string(), v.null())),
      replaces: v.optional(v.array(v.id('catalogEntry'))),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('archetype'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('archetype'),
      classEntryId: v.optional(v.id('catalogEntry')),
      replaces: v.optional(v.array(archetypeReplacementValidator)),
      choice: v.optional(v.union(v.string(), v.null())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('classFeature'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('classFeature'),
      choice: v.optional(v.union(v.string(), v.null())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('feat'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('feat'),
      choice: v.optional(v.union(v.string(), v.null())),
      slot: v.optional(
        v.union(
          v.literal('general'),
          v.object({
            grantedBy: selectionReferenceValidator,
            slotIndex: v.optional(v.number()),
          }),
        ),
      ),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('trait'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('trait'),
      choice: v.optional(v.union(v.string(), v.null())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('abilityDamage'),
    active: v.boolean(),
    state: v.object({
      kind: v.literal('abilityDamage'),
      ability: abilityValidator,
      points: v.number(),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('abilityDrain'),
    active: v.boolean(),
    state: v.object({
      kind: v.literal('abilityDrain'),
      ability: abilityValidator,
      points: v.number(),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('spellEffect'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('spellEffect'),
      casterLevel: v.number(),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('condition'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({ kind: v.literal('condition') }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('item'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('item'),
      masterwork: v.optional(v.boolean()),
      enhancement: v.optional(v.number()),
      material: v.optional(v.union(v.string(), v.null())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('spell'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('spell'),
      castingClassId: v.optional(v.id('catalogEntry')),
      level: v.optional(v.union(v.number(), v.null())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('manual'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('manual'),
      choice: v.optional(v.union(v.string(), v.null())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('base'),
    active: v.literal(true),
    catalogEntryId: v.id('catalogEntry'),
    state: v.object({
      kind: v.literal('base'),
      ...creationSettingsValidator.partial().fields,
      alignment: v.optional(alignmentValidator),
      deity: v.optional(v.string()),
      favoredClassIds: v.optional(v.array(v.id('catalogEntry'))),
      proficiencies: v.optional(
        v.object({
          added: v.array(manualProficiencyValidator),
          removed: v.array(manualProficiencyValidator),
        }),
      ),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('classLevel'),
    active: v.literal(true),
    state: v.object({
      kind: v.literal('classLevel'),
      classEntryId: v.union(v.id('catalogEntry'), v.null()),
      favoredClassBonus: v.optional(favoredClassBonusValidator),
      skillRanks: v.optional(v.record(v.string(), v.number())),
      proficiencyChoice: v.optional(v.union(v.string(), v.null())),
      abilityIncrease: v.optional(
        v.union(v.null(), ...abilityKeys.map((ability) => v.literal(ability))),
      ),
      position: v.number(),
      hpGained: v.union(v.number(), v.null()),
    }),
  }),
);

export const campaignValidator = v.object({
  name: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  description: v.string(),
  inGameDate: v.optional(v.string()),
  e2eFixture: v.optional(
    v.object({
      namespace: v.string(),
      version: v.number(),
      workerKey: v.string(),
      caseKey: v.string(),
      campaignKey: v.string(),
    }),
  ),
});

export const militiaValidator = v.object({
  campaignId: v.id('campaign'),
  name: v.string(),
});

export const roles = v.union(v.literal('admin'), v.literal('member'));

export const backfillPhaseValidator = v.union(
  v.literal('characters'),
  v.literal('candidates'),
  v.literal('sources'),
  v.literal('relationships'),
  v.literal('sheetEntries'),
  v.literal('catalogEntries'),
  v.literal('warnings'),
  v.literal('spells'),
  v.literal('drafts'),
  v.literal('done'),
);
export const backfillCompletionValidator = v.object({
  runId: v.id('initialMigrationRun'),
  epoch: v.number(),
  captureId: v.string(),
  validationId: v.string(),
  schemaIdentity: v.string(),
  calculationIdentity: v.string(),
  catalogManifest: v.string(),
});
const backfillProgressFields = {
  captureId: v.string(),
  schemaIdentity: v.string(),
  calculationIdentity: v.string(),
  catalogManifest: v.string(),
  frontendBuild: v.string(),
  validatedCharacters: v.number(),
  validatedCandidates: v.number(),
  cursor: v.union(v.string(), v.null()),
  isInventoryDone: v.boolean(),
  captured: v.number(),
  nextBatch: v.number(),
  nextValidationBatch: v.number(),
  validationPhase: backfillPhaseValidator,
  validationCursor: v.union(v.string(), v.null()),
  errors: v.number(),
  validationRows: v.record(v.string(), v.number()),
  censusPhase: backfillPhaseValidator,
  censusCursor: v.union(v.string(), v.null()),
  censusRows: v.record(v.string(), v.number()),
  isCensusDone: v.boolean(),
  driverGeneration: v.number(),
  driver: v.union(
    v.null(),
    v.object({
      id: v.string(),
      validationId: v.string(),
      generation: v.number(),
      nextTick: v.number(),
      isRunning: v.boolean(),
      startedAt: v.number(),
      batches: v.number(),
      workDurationMs: v.number(),
      workSampleCount: v.number(),
      lastBatchStartedAt: v.union(v.number(), v.null()),
      stoppedBecause: v.union(
        v.null(),
        v.literal('operator'),
        v.literal('budget'),
        v.literal('finished'),
      ),
    }),
  ),
};
// Initial preparation tables have never been deployed; no stored-state migration.
export const backfillStateValidator = v.union(
  v.object({
    ...backfillProgressFields,
    stage: v.literal('building'),
    validationId: v.null(),
    completion: v.null(),
  }),
  v.object({
    ...backfillProgressFields,
    stage: v.literal('validating'),
    validationId: v.string(),
    completion: v.null(),
  }),
  v.object({
    ...backfillProgressFields,
    stage: v.literal('failed'),
    validationId: v.string(),
    completion: v.null(),
  }),
  v.object({
    ...backfillProgressFields,
    stage: v.literal('complete'),
    validationId: v.string(),
    completion: backfillCompletionValidator,
  }),
);

export default defineSchema({
  catalogRelease: defineTable({
    releaseNumber: v.number(),
    state: v.union(v.literal('preparing'), v.literal('prepared')),
    baseReleaseNumber: v.union(v.number(), v.null()),
    manifest: catalogReleaseManifestValidator,
    nextBatchIndex: v.number(),
    batchCount: v.number(),
    stagedRows: v.number(),
    reportCategories: v.array(v.string()),
    legalKeys: v.array(v.string()),
  }).index('by_releaseNumber', ['releaseNumber']),
  catalogReleaseRow: defineTable(
    v.union(
      ...catalogReleaseRowValidator.members.map((row) =>
        row.extend({
          releaseId: v.id('catalogRelease'),
          batchIndex: v.number(),
        }),
      ),
    ),
  ).index('by_releaseId_and_kind_and_key', ['releaseId', 'kind', 'key']),
  // Selected only by the later atomic catalog/facts activation command.
  catalogReleaseControl: defineTable({
    key: v.literal('global'),
    releaseNumber: v.number(),
    schemaIdentity: v.string(),
    calculationIdentity: v.string(),
  }).index('by_key', ['key']),
  initialMigrationControl: defineTable({
    key: v.literal('character-sheet'),
    epoch: v.number(),
    closed: v.boolean(),
    authority: v.union(v.literal('legacy'), v.literal('sheet')),
    runId: v.id('initialMigrationRun'),
    acceptWebhooksAfter: v.optional(v.number()),
  }).index('by_key', ['key']),
  initialMigrationRun: defineTable({
    operationId: v.string(),
    epoch: v.number(),
    state: v.union(
      v.literal('maintenance'),
      v.literal('aborted'),
      v.literal('activated'),
    ),
    frontendBuild: v.string(),
    catalogManifest: v.string(),
    startedAt: v.number(),
    deadline: v.number(),
    abortedAt: v.optional(v.number()),
    backfill: v.optional(backfillStateValidator),
  }).index('by_operationId', ['operationId']),
  // Private preparation rows never participate in active sheet or facts reads.
  initialMigrationCandidate: defineTable({
    runId: v.id('initialMigrationRun'),
    epoch: v.number(),
    captureId: v.string(),
    characterId: v.id('character'),
    characterHash: v.string(),
    input: v.union(v.string(), v.null()),
    sheetMode: characterSheetModeValidator,
    isInitialized: v.boolean(),
    error: v.union(v.string(), v.null()),
  }).index('by_runId_and_characterId', ['runId', 'characterId']),
  initialMigrationReport: defineTable({
    runId: v.id('initialMigrationRun'),
    captureId: v.string(),
    validationId: v.string(),
    scope: v.string(),
    message: v.string(),
  }).index('by_runId_and_validationId', ['runId', 'validationId']),
  canonicalSourceCorrection: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    expectedRevision: v.number(),
    revision: v.number(),
    reason: v.string(),
    actor: v.string(),
    createdAt: v.number(),
  }).index('by_militiaId', ['militiaId']),
  campaignCutover: defineTable({
    key: v.literal('weekly-draft'),
    status: v.union(v.literal('paused'), v.literal('canonical')),
    operationId: v.string(),
    oldRelease: v.string(),
    newRelease: v.string(),
    campaignIds: v.array(v.id('campaign')),
    pausedAt: v.number(),
    reopenedAt: v.optional(v.number()),
    backup: v.optional(
      v.object({
        sha256: v.string(),
        location: v.string(),
        verifiedRestoreDeployment: v.string(),
        retainUntil: v.number(),
      }),
    ),
  }).index('by_key', ['key']),
  canonicalMilitiaState: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    revision: v.number(),
    snapshot: zodOutputToConvex(militiaSnapshotSchema),
  }).index('by_militiaId', ['militiaId']),
  canonicalCampaignInitialization: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    initializationId: v.string(),
    setupNotes: v.optional(v.string()),
    draftId: v.string(),
    sourceToken: v.string(),
  }).index('by_militiaId', ['militiaId']),
  canonicalResolutionRecord: defineTable(recordStorageValidator)
    .index('by_recordId', ['recordId'])
    .index('by_sourceDraftId', ['record.source.draftId'])
    .index('by_campaignId_and_week_and_sequence', [
      'campaignId',
      'week',
      'sequence',
    ])
    .index('by_militiaId', ['militiaId']),
  canonicalDraftTarget: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    draftId: v.string(),
    target: v.string(),
    revision: v.number(),
    subtreeRevision: v.number(),
  })
    .index('by_draftId_and_target', ['draftId', 'target'])
    .index('by_draftId_and_revision', ['draftId', 'revision'])
    .index('by_militiaId', ['militiaId']),
  canonicalDraftOperation: defineTable(operationStorageValidator)
    .index('by_draftId_and_operationId', ['draftId', 'operationId'])
    .index('by_draftId_and_acceptedRevision', ['draftId', 'acceptedRevision'])
    .index('by_militiaId', ['militiaId']),
  canonicalWeeklyDraft: defineTable(draftStorageValidator)
    .index('by_draftId', ['draftId'])
    .index('by_campaignId_and_status', ['campaignId', 'status'])
    .index('by_militiaId', ['militiaId']),
  e2eFixtureIdentity: defineTable({
    namespace: v.string(),
    workerKey: v.string(),
    userId: v.id('user'),
  })
    .index('by_namespace_and_workerKey', ['namespace', 'workerKey'])
    .index('by_userId', ['userId']),
  catalogEntry: defineTable(catalogEntryValidator)
    .index('by_characterId', ['characterId'])
    .index('by_scope', ['scope'])
    .index('by_campaignId_and_scope', ['campaignId', 'scope'])
    .index('by_campaignId_and_scope_and_copiedFrom_and_campaignPreference', [
      'campaignId',
      'scope',
      'copiedFrom',
      'campaignPreference',
    ])
    .index('by_characterId_and_browseOnly', ['characterId', 'browseOnly'])
    .index('by_characterId_and_ruleIdentity', ['characterId', 'ruleIdentity']),
  spellCatalogIndex: defineTable({
    characterId: v.id('character'),
    ruleIdentity: v.optional(v.string()),
    levels: v.optional(v.record(v.string(), v.number())),
    catalogEntryId: v.id('catalogEntry'),
    castingClassId: v.id('catalogEntry'),
    level: v.union(v.number(), v.null()),
    school: v.string(),
    name: v.string(),
    available: v.boolean(),
    recorded: v.optional(v.boolean()),
  })
    .index('by_catalogEntryId', ['catalogEntryId'])
    .index('by_characterId_and_catalogEntryId', [
      'characterId',
      'catalogEntryId',
    ])
    .index('by_characterId_and_ruleIdentity', ['characterId', 'ruleIdentity'])
    .index('by_characterId_and_castingClassId_and_available_and_name', [
      'characterId',
      'castingClassId',
      'available',
      'name',
    ])
    // Convex caps index names at 64 characters, so these drop the `_and_` joiners.
    .index('by_characterId_castingClassId_available_level_name', [
      'characterId',
      'castingClassId',
      'available',
      'level',
      'name',
    ])
    .index('by_characterId_castingClassId_available_school_name', [
      'characterId',
      'castingClassId',
      'available',
      'school',
      'name',
    ])
    .index('by_characterId_castingClassId_available_level_school_name', [
      'characterId',
      'castingClassId',
      'available',
      'level',
      'school',
      'name',
    ])
    .index('by_characterId_and_castingClassId_and_name', [
      'characterId',
      'castingClassId',
      'name',
    ])
    .index('by_characterId_and_castingClassId_and_level_and_name', [
      'characterId',
      'castingClassId',
      'level',
      'name',
    ])
    .index('by_characterId_and_castingClassId_and_school_and_name', [
      'characterId',
      'castingClassId',
      'school',
      'name',
    ])
    .index('by_characterId_and_castingClassId_and_level_and_school_and_name', [
      'characterId',
      'castingClassId',
      'level',
      'school',
      'name',
    ])
    .searchIndex('search_name', {
      searchField: 'name',
      filterFields: [
        'characterId',
        'castingClassId',
        'available',
        'level',
        'school',
      ],
    }),
  spellCatalogSummary: defineTable(
    v.union(
      v.object({
        characterId: v.id('character'),
        castingClassId: v.id('catalogEntry'),
        kind: v.literal('level'),
        value: v.union(v.number(), v.null()),
        count: v.number(),
        availableCount: v.number(),
        unrecordedCount: v.number(),
      }),
      v.object({
        characterId: v.id('character'),
        castingClassId: v.id('catalogEntry'),
        kind: v.literal('school'),
        value: v.string(),
        count: v.number(),
        availableCount: v.number(),
        unrecordedCount: v.number(),
      }),
    ),
  ).index('by_characterId_and_castingClassId_and_kind_and_value', [
    'characterId',
    'castingClassId',
    'kind',
    'value',
  ]),
  acceptedWarning: defineTable({
    characterId: v.id('character'),
    check: v.string(),
    subject: v.string(),
    fingerprint: v.string(),
    acceptedBy: v.string(),
    acceptedAt: v.number(),
  }).index('by_characterId', ['characterId']),
  characterSheetEntry: defineTable(characterSheetEntryValidator)
    .index('by_characterId', ['characterId'])
    .index('by_characterId_and_kind_and_active', [
      'characterId',
      'kind',
      'active',
    ]),
  character: defineTable(characterValidator)
    .index('by_campaignId', ['campaignId'])
    .index('by_ownerId', ['ownerId']),
  companionRelationship: defineTable({
    associatedCharacterId: v.id('character'),
    companionCharacterId: v.id('character'),
    kind: companionKindValidator,
    sources: v.array(companionSourceValidator),
    status: companionStatusValidator,
    manuallyInterrupted: v.boolean(),
    activatedAt: v.number(),
    lastOperationId: v.string(),
  })
    .index('by_associatedCharacterId', ['associatedCharacterId'])
    .index('by_companionCharacterId', ['companionCharacterId']),
  campaign: defineTable(campaignValidator)
    .index('by_organization', ['organizationId'])
    .index('by_e2eFixture_namespace_and_workerKey_and_caseKey', [
      'e2eFixture.namespace',
      'e2eFixture.workerKey',
      'e2eFixture.caseKey',
    ]),
  militia: defineTable(militiaValidator).index('by_campaign', ['campaignId']),
  spell: defineTable(spellValidator).index('by_name', ['name']),
  characterSpell: defineTable(
    v.object({
      characterId: v.id('character'),
      spellId: v.id('spell'),
    }),
  )
    .index('characterId', ['characterId'])
    .index('spellId_characterId', ['spellId', 'characterId']),
  user: defineTable({
    tokenIdentifier: v.string(),
    characterSheetDemo: v.optional(v.literal(true)),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    webhookUpdatedAt: v.optional(v.number()),
    orgIds: v.array(
      v.object({
        orgId: v.string(),
        role: roles,
        webhookUpdatedAt: v.optional(v.number()),
      }),
    ),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),
  organizationMembership: defineTable({
    userId: v.id('user'),
    organizationId: v.string(),
  })
    .index('by_organizationId_and_userId', ['organizationId', 'userId'])
    .index('by_userId_and_organizationId', ['userId', 'organizationId']),
});
