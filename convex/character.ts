import { ConvexError, v, type Infer } from 'convex/values';
import { query } from './_generated/server';
import { campaignMutation as mutation } from './lib/campaignRuntime';
import { updateCanonicalCharacter } from './lib/canonicalCharacters';
import schema, { campaignValidator, characterValidator } from './schema';
import { getUserByTokenIdentifier, hasAccessToOrg } from './user';
import {
  listAccessibleCharacters,
  requireCampaignCharacterAccess,
  requireCharacterCampaignAccess,
} from './lib/characterAccess';
import {
  pruneWarningAcceptancesAndRecordChange,
  loadCharacterSheet,
  updateCharacterArchive,
} from './lib/characterSheet';
import { normalizeCharacterKind } from '../src/lib/character-kind';

const ownedGroupValidator = v.union(
  v.object({
    kind: v.literal('noCampaign'),
    characters: v.array(schema.doc('character')),
  }),
  v.object({
    kind: v.literal('campaign'),
    campaignId: v.id('campaign'),
    campaignName: v.string(),
    organizationId: v.string(),
    characters: v.array(schema.doc('character')),
  }),
);

export const listOwned = query({
  args: {},
  returns: v.array(ownedGroupValidator),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) return [];
    const owned = await ctx.db
      .query('character')
      .withIndex('by_ownerId', (q) => q.eq('ownerId', identity.tokenIdentifier))
      .take(4097);
    if (owned.length > 4096)
      throw new ConvexError('Too many Characters to load');
    const privateGroup: Infer<typeof ownedGroupValidator> = {
      kind: 'noCampaign',
      characters: [],
    };
    const campaignGroups = new Map<
      string,
      Extract<Infer<typeof ownedGroupValidator>, { kind: 'campaign' }>
    >();
    for (const character of owned) {
      if (!character.campaignId) {
        privateGroup.characters.push(character);
        continue;
      }
      const existing = campaignGroups.get(character.campaignId);
      if (existing) {
        existing.characters.push(character);
        continue;
      }
      const campaign = await ctx.db.get('campaign', character.campaignId);
      if (!campaign || !(await hasAccessToOrg(ctx, campaign.organizationId)))
        continue;
      campaignGroups.set(campaign._id, {
        kind: 'campaign',
        campaignId: campaign._id,
        campaignName: campaign.name,
        organizationId: campaign.organizationId,
        characters: [character],
      });
    }
    const groups = [...campaignGroups.values()].sort(
      (a, b) =>
        a.campaignName.localeCompare(b.campaignName) ||
        a.organizationId.localeCompare(b.organizationId) ||
        a.campaignId.localeCompare(b.campaignId),
    );
    return [privateGroup, ...groups];
  },
});

export const listCampaignCharacters = query({
  args: { campaignId: v.id('campaign'), organizationId: v.string() },
  returns: v.array(
    v.object({
      character: schema.doc('character'),
      ownerName: v.union(v.string(), v.null()),
      isOnRoster: v.boolean(),
    }),
  ),
  async handler(ctx, args) {
    const characters = await listAccessibleCharacters(ctx, {
      ...args,
      includeInactive: true,
    });
    if (characters.length === 0) return [];
    const ownerIds = new Set(
      characters.flatMap((character) =>
        character.ownerId ? [character.ownerId] : [],
      ),
    );
    const ownerNames = new Map(
      await Promise.all(
        [...ownerIds].map(
          async (ownerId) =>
            [
              ownerId,
              (await getUserByTokenIdentifier(ctx, ownerId))?.name ?? null,
            ] as const,
        ),
      ),
    );
    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .unique();
    const source = militia
      ? await ctx.db
          .query('canonicalMilitiaState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .unique()
      : null;
    const roster = new Set(
      source?.campaignId === args.campaignId
        ? source.snapshot.roster.people.map((person) => person.characterId)
        : [],
    );
    return characters.map((character) => ({
      character,
      ownerName: character.ownerId
        ? (ownerNames.get(character.ownerId) ?? null)
        : null,
      isOnRoster: roster.has(character._id),
    }));
  },
});

export const listByCampaign = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
    includeInactive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    return await listAccessibleCharacters(ctx, args);
  },
});

// B3: a browser still on a bundle from before #180 may submit officer_npc.
// The record stores PC or NPC. Narrow this with B3.
const submittedCharacterKindValidator = v.union(
  v.literal('pc'),
  v.literal('officer_npc'),
  v.literal('npc'),
);

export const createCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    character: v.object({
      campaignId: v.id('campaign'),
      name: characterValidator.fields.name,
      description: characterValidator.fields.description,
      kind: submittedCharacterKindValidator,
      level: characterValidator.fields.level,
      strength: characterValidator.fields.strength,
      dexterity: characterValidator.fields.dexterity,
      constitution: characterValidator.fields.constitution,
      wisdom: characterValidator.fields.wisdom,
      charisma: characterValidator.fields.charisma,
      intelligence: characterValidator.fields.intelligence,
    }),
  },
  async handler(ctx, args) {
    if (!args.character.name.trim()) {
      throw new ConvexError('Character name cannot be empty');
    }

    const { access } = await requireCharacterCampaignAccess(ctx, {
      campaignId: args.character.campaignId,
      organizationId: args.organizationId,
    });

    const characterId = await ctx.db.insert('character', {
      ...args.character,
      kind: normalizeCharacterKind(args.character.kind),
      ownerId: access.user.tokenIdentifier,
      isActive: true,
    });
    await updateCanonicalCharacter(ctx, characterId);
    return characterId;
  },
});

export const updateCharacter = mutation({
  args: {
    operationId: v.optional(v.string()),
    organizationId: campaignValidator.fields.organizationId,
    characterId: v.id('character'),
    patch: v.object({
      name: v.optional(characterValidator.fields.name),
      description: v.optional(characterValidator.fields.description),
      kind: v.optional(submittedCharacterKindValidator),
      level: v.optional(characterValidator.fields.level),
      strength: v.optional(characterValidator.fields.strength),
      dexterity: v.optional(characterValidator.fields.dexterity),
      constitution: v.optional(characterValidator.fields.constitution),
      wisdom: v.optional(characterValidator.fields.wisdom),
      charisma: v.optional(characterValidator.fields.charisma),
      intelligence: v.optional(characterValidator.fields.intelligence),
      isActive: v.optional(v.boolean()),
    }),
  },
  async handler(ctx, args) {
    if (args.patch.name !== undefined && !args.patch.name.trim()) {
      throw new ConvexError('Character name cannot be empty');
    }

    const character = await requireCampaignCharacterAccess(ctx, {
      characterId: args.characterId,
      organizationId: args.organizationId,
    });

    // A submitted kind is stored as PC or NPC; an unrelated edit leaves the
    // stored kind alone. Either way the roster mirror follows in this write.
    const { kind, ...patch } = args.patch;
    const changesSheetKind =
      character.sheetMode &&
      kind !== undefined &&
      normalizeCharacterKind(kind) !== character.kind;
    const sheet = changesSheetKind
      ? await loadCharacterSheet(ctx, {
          characterId: character._id,
          organizationId: args.organizationId,
        })
      : null;
    await ctx.db.patch('character', args.characterId, {
      ...patch,
      ...(kind && { kind: normalizeCharacterKind(kind) }),
    });
    if (sheet) {
      sheet.character = {
        ...sheet.character,
        ...patch,
        kind: normalizeCharacterKind(kind ?? character.kind),
      };
      await pruneWarningAcceptancesAndRecordChange(ctx, {
        sheet,
        operationId: args.operationId ?? crypto.randomUUID(),
      });
    }
    await updateCanonicalCharacter(ctx, args.characterId);
  },
});

export const archiveCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    characterId: v.id('character'),
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    await requireCampaignCharacterAccess(ctx, {
      characterId: args.characterId,
      organizationId: args.organizationId,
    });

    await updateCharacterArchive(ctx, args);
  },
});

export const deleteCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    characterId: v.id('character'),
  },
  async handler(ctx, args) {
    const character = await requireCampaignCharacterAccess(ctx, {
      characterId: args.characterId,
      organizationId: args.organizationId,
    });
    if (character.isActive)
      throw new ConvexError('Only archived characters can be hard deleted');

    throw new ConvexError(
      'Keep archived characters to preserve militia history.',
    );
  },
});
