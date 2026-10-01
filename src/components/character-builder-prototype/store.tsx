'use client';
// PROTOTYPE (throwaway, #208) — the in-memory store: React context +
// useReducer, seeded with the mock campaigns. No Convex, no Clerk. Every
// action is non-blocking: rules checks surface through useWarnings().

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { CAMPAIGN_CATALOG_BY_KEY, CATALOG, CATALOG_BY_KEY } from './catalog';
import {
  ME,
  ORGS,
  SEED_CAMPAIGNS,
  SEED_CHARACTERS,
  baseCatalogEntry,
  baseSheetEntry,
  classLevelEntry,
} from './mock-characters';
import { resolveSheet } from './resolve';
import {
  baseScores,
  classLevelLabel,
  classLevels,
  grantsAt,
  levelsRemovedBy,
  lookupCatalog,
  raceSheetEntry,
  skillRankBudgetWithInt,
} from './sheet';
import {
  ABILITIES,
  type AbilityKey,
  type Campaign,
  type CatalogEntry,
  type Character,
  type ClassLevelState,
  type Modifier,
  type OfficerRole,
  type SheetEntry,
} from './types';
import { advisoryWarnings, type Warning } from './warnings';

/**
 * What just happened to one Character's membership or presentation
 * (left a campaign, joined one, built out), for a confirmation note in the
 * page body. One at a time; the next membership change replaces it.
 */
export type Notice = {
  characterId: string;
  kind: 'left' | 'added' | 'moved' | 'builtOut';
  title: string;
  lines: string[];
};

export type BuilderState = {
  campaigns: Campaign[];
  characters: Character[];
  pointBuyBudget: number;
  notice: Notice | null;
};

const initialState = (): BuilderState => ({
  campaigns: structuredClone(SEED_CAMPAIGNS),
  characters: structuredClone(SEED_CHARACTERS),
  pointBuyBudget: 20,
  notice: null,
});

type Action =
  | { kind: 'apply'; fn: (s: BuilderState) => BuilderState }
  | { kind: 'reset' };

function reduce(state: BuilderState, action: Action): BuilderState {
  return action.kind === 'reset' ? initialState() : action.fn(state);
}

const CHOICELESS = new Set([
  'item',
  'race',
  'classLevel',
  'abilityDamage',
  'abilityDrain',
]);

let seq = 0;
/** Ids for new rows; generated outside the reducer so it stays pure. */
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`;

// ------------------------------------------------------------ pure updates

const mapCharacter = (
  s: BuilderState,
  id: string,
  fn: (c: Character) => Character,
): BuilderState => ({
  ...s,
  characters: s.characters.map((c) => (c.id === id ? fn(c) : c)),
});

/** Renumbers Class Levels 1…n in their current order. */
function renumber(c: Character, order?: string[]): Character {
  const levels = classLevels(c);
  const ids = order ?? levels.map((l) => l.id);
  return {
    ...c,
    entries: c.entries.map((e) =>
      e.state.kind === 'classLevel'
        ? { ...e, state: { ...e.state, position: ids.indexOf(e.id) + 1 } }
        : e,
    ),
  };
}

function setBase(c: Character, scores: Record<AbilityKey, number>): Character {
  const fresh = baseCatalogEntry(c.id, scores);
  const has = c.ownCatalog.some((e) => e.detail.kind === 'base');
  return {
    ...c,
    ownCatalog: has
      ? c.ownCatalog.map((e) =>
          e.detail.kind === 'base' ? { ...e, modifiers: fresh.modifiers } : e,
        )
      : [...c.ownCatalog, fresh],
    entries: c.entries.some((e) => e.kind === 'base')
      ? c.entries
      : [baseSheetEntry(c.id), ...c.entries],
  };
}

function catalogEntryToSheet(
  catalog: CatalogEntry,
  id: string,
  opts: AddEntryOptions = {},
): SheetEntry | null {
  const kind = catalog.detail.kind;
  if (kind === 'class' || kind === 'base') return null;
  return {
    id,
    kind,
    catalogKey: catalog.key,
    active: opts.active ?? true,
    gainedAtClassLevel: opts.gainedAtClassLevel,
    notes: opts.notes,
    state:
      kind === 'item'
        ? { kind: 'item', quantity: opts.quantity ?? 1 }
        : kind === 'race'
          ? { kind: 'race', abilityChoice: null, favoredClass: null }
          : { kind, choice: opts.choice ?? null },
  };
}

/** Adds the fixed class features a level grants that aren't on the sheet for it yet. */
function addFixedFeatures(
  c: Character,
  levelId: string,
  idPrefix: string,
): Character {
  const added: SheetEntry[] = [];
  grantsAt(c, levelId).forEach((grant, i) => {
    if (!('catalogKey' in grant)) return;
    if (
      c.entries.some(
        (e) =>
          e.gainedAtClassLevel === levelId && e.catalogKey === grant.catalogKey,
      )
    )
      return;
    const catalog = lookupCatalog(c, grant.catalogKey);
    const entry =
      catalog &&
      catalogEntryToSheet(catalog, `${idPrefix}-f${i}`, {
        gainedAtClassLevel: levelId,
      });
    if (entry) added.push(entry);
  });
  return { ...c, entries: [...c.entries, ...added] };
}

/** Removes features a level got automatically from its class (used when its class changes). */
function removeFixedFeatures(c: Character, levelId: string): Character {
  const fixed = new Set(
    grantsAt(c, levelId).flatMap((g) =>
      'catalogKey' in g ? [g.catalogKey] : [],
    ),
  );
  return {
    ...c,
    entries: c.entries.filter(
      (e) =>
        !(
          e.gainedAtClassLevel === levelId &&
          e.catalogKey &&
          fixed.has(e.catalogKey)
        ),
    ),
  };
}

function removeLevels(
  c: Character,
  levelIds: string[],
  keepGained: boolean,
): Character {
  const gone = new Set(levelIds);
  const entries = c.entries.flatMap((e) => {
    if (gone.has(e.id)) return [];
    if (e.gainedAtClassLevel && gone.has(e.gainedAtClassLevel))
      return keepGained ? [{ ...e, gainedAtClassLevel: undefined }] : [];
    return [e];
  });
  return renumber({ ...c, entries });
}

/**
 * What leaving its campaign would do to a Character, without doing it:
 * the roster place it loses, the campaign homebrew detached into its own
 * copies, and whether it stops being Militia-only.
 */
export function leaveConsequences(state: BuilderState, characterId: string) {
  const character = state.characters.find((c) => c.id === characterId);
  const campaign = state.campaigns.find(
    (cp) => cp.id === character?.campaignId,
  );
  if (!character || !campaign) return null;
  const roster =
    campaign.militia?.roster.find((p) => p.characterId === characterId) ?? null;
  const detached = character.entries.flatMap((e) => {
    if (!e.catalogKey) return [];
    if (character.ownCatalog.some((own) => own.key === e.catalogKey)) return [];
    const homebrew = CAMPAIGN_CATALOG_BY_KEY[e.catalogKey];
    return homebrew ? [homebrew.name] : [];
  });
  return {
    campaign,
    roster,
    detached,
    becomesFull: character.sheetMode === 'militiaOnly',
  };
}

export type LeaveConsequences = NonNullable<
  ReturnType<typeof leaveConsequences>
>;

/** The note lines describing a leave, in plain product language. */
function leaveLines(cons: LeaveConsequences): string[] {
  const lines: string[] = [];
  if (cons.roster)
    lines.push(
      `Taken off the ${cons.campaign.name} militia roster${
        cons.roster.roles.length
          ? `; no longer ${cons.roster.roles.join(' and ')}`
          : ''
      }. Finished weeks keep it as it was.`,
    );
  for (const name of cons.detached)
    lines.push(
      `${name} was ${cons.campaign.name} homebrew; the sheet now keeps its own copy, so nothing on it changes.`,
    );
  if (cons.becomesFull)
    lines.push(
      'It is now a Full Character: Militia-only needs a campaign with a militia.',
    );
  return lines;
}

/** Takes a Character out of its campaign (roster, homebrew, presentation). Pure. */
function applyLeave(s: BuilderState, characterId: string): BuilderState {
  const cons = leaveConsequences(s, characterId);
  if (!cons) return s;
  return {
    ...s,
    campaigns: s.campaigns.map((cp) =>
      cp.id === cons.campaign.id && cp.militia
        ? {
            ...cp,
            militia: {
              ...cp.militia,
              roster: cp.militia.roster.filter(
                (p) => p.characterId !== characterId,
              ),
            },
          }
        : cp,
    ),
    characters: s.characters.map((c) => {
      if (c.id !== characterId) return c;
      const copies: CatalogEntry[] = [];
      const entries = c.entries.map((e) => {
        const homebrew =
          e.catalogKey && !c.ownCatalog.some((own) => own.key === e.catalogKey)
            ? CAMPAIGN_CATALOG_BY_KEY[e.catalogKey]
            : undefined;
        if (!homebrew) return e;
        const key = `copy.${c.id}.${homebrew.key}`;
        if (!copies.some((x) => x.key === key))
          copies.push({
            ...structuredClone(homebrew),
            key,
            scope: 'character',
            characterId: c.id,
            campaignId: undefined,
            copiedFrom: homebrew.key,
          });
        return { ...e, catalogKey: key };
      });
      return {
        ...c,
        campaignId: undefined,
        sheetMode: 'full',
        ownCatalog: [...c.ownCatalog, ...copies],
        entries,
      };
    }),
  };
}

// ------------------------------------------------------------------ types

export type ClassLevelChoices = Partial<
  Omit<ClassLevelState, 'kind' | 'classKey' | 'position'>
> & {
  /** 1-based; default appends at the end. */
  position?: number;
  /** Add the class's fixed features for this level (default true). */
  autoFeatures?: boolean;
};

export type AddEntryOptions = {
  gainedAtClassLevel?: string;
  active?: boolean;
  choice?: string | null;
  notes?: string;
  quantity?: number;
};

export type NewCharacter = {
  /** Absent = in no campaign (the Characters area). */
  campaignId?: string;
  name?: string;
  kind?: 'pc' | 'npc';
  /** Militia-only is kept only in a campaign with a militia; otherwise Full. */
  sheetMode?: 'militiaOnly' | 'full';
  description?: string;
  baseScores?: Partial<Record<AbilityKey, number>>;
  /** Unspecified Class Levels to start with (default 1, per the data model). */
  startingLevel?: number;
  raceKey?: string;
  /** Put the Character on the campaign's militia roster (if it has one). */
  onRoster?: boolean;
  roles?: OfficerRole[];
};

// ------------------------------------------------------------------ store

function makeActions(dispatch: (a: Action) => void, state: BuilderState) {
  const apply = (fn: (s: BuilderState) => BuilderState) =>
    dispatch({ kind: 'apply', fn });
  const edit = (id: string, fn: (c: Character) => Character) =>
    apply((s) => mapCharacter(s, id, fn));
  const current = (id: string) => state.characters.find((c) => c.id === id);

  return {
    /**
     * New Character owned by me, with one Unspecified Class Level and base
     * scores (default all 10). No `campaignId` = in no campaign. Returns its id.
     */
    createCharacter: (partial: NewCharacter = {}): string => {
      const id = newId('char');
      apply((s) => {
        const campaignId = partial.campaignId;
        const hasMilitia = Boolean(
          s.campaigns.find((cp) => cp.id === campaignId)?.militia,
        );
        const scores = {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10,
          ...partial.baseScores,
        };
        const level = partial.startingLevel ?? 1;
        const race = partial.raceKey
          ? CATALOG_BY_KEY[partial.raceKey]
          : undefined;
        const raceEntry = race && catalogEntryToSheet(race, `${id}-race`);
        const character: Character = {
          id,
          ownerId: ME,
          campaignId,
          name: partial.name ?? 'New character',
          kind: partial.kind ?? 'pc',
          isActive: true,
          description: partial.description ?? '',
          sheetMode:
            partial.sheetMode === 'militiaOnly' && hasMilitia
              ? 'militiaOnly'
              : 'full',
          ownCatalog: [baseCatalogEntry(id, scores)],
          entries: [
            baseSheetEntry(id),
            ...(raceEntry ? [raceEntry] : []),
            ...Array.from({ length: level }, (_, i) =>
              classLevelEntry(`${id}-l${i + 1}`, i + 1, null),
            ),
          ],
        };
        return {
          ...s,
          characters: [...s.characters, character],
          campaigns: partial.onRoster
            ? s.campaigns.map((cp) =>
                cp.id === campaignId && cp.militia
                  ? {
                      ...cp,
                      militia: {
                        ...cp.militia,
                        roster: [
                          ...cp.militia.roster,
                          {
                            characterId: id,
                            roles: partial.roles ?? [],
                            hitDiceOverride: null,
                          },
                        ],
                      },
                    }
                  : cp,
              )
            : s.campaigns,
        };
      });
      return id;
    },

    /**
     * One way: a Militia-only Character becomes Full for good. Every entry is
     * kept; there is no way back. No-op for a Full Character.
     */
    buildOut: (id: string) => {
      apply((s) => {
        const c = s.characters.find((x) => x.id === id);
        if (!c || c.sheetMode === 'full') return s;
        return {
          ...mapCharacter(s, id, (ch) => ({ ...ch, sheetMode: 'full' })),
          notice: {
            characterId: id,
            kind: 'builtOut',
            title: `${c.name} is now a Full Character`,
            lines: [
              'Its level and six scores are kept, and the militia reads the same numbers.',
              'It is edited on its sheet from now on; Characters & officers shows level and scores read-only.',
            ],
          },
        };
      });
    },

    /**
     * Moves a Character into a campaign. One that is in another campaign
     * leaves it first (roster, homebrew, presentation). Joining never puts it
     * on the militia roster. Sets the notice.
     */
    addToCampaign: (id: string, campaignId: string) => {
      apply((s) => {
        const c = s.characters.find((x) => x.id === id);
        const target = s.campaigns.find((cp) => cp.id === campaignId);
        if (!c || !target || c.campaignId === campaignId) return s;
        const cons = leaveConsequences(s, id);
        const left = applyLeave(s, id);
        const lines = [
          `Everyone in ${target.name} can see and edit ${c.name} now.`,
          ...(target.militia
            ? [
                'Not on the militia roster yet: add it on Characters & officers.',
              ]
            : []),
          ...(cons ? leaveLines(cons) : []),
        ];
        return {
          ...mapCharacter(left, id, (ch) => ({ ...ch, campaignId })),
          notice: {
            characterId: id,
            kind: cons ? 'moved' : 'added',
            title: cons
              ? `Moved from ${cons.campaign.name} to ${target.name}`
              : `Added to ${target.name}`,
            lines,
          },
        };
      });
    },

    /**
     * Takes a Character out of its campaign, back to no campaign: off the
     * militia roster and its roles, campaign homebrew detached into its own
     * copies, Militia-only becomes Full. Confirm first with
     * `leaveConsequences(state, id)`. Sets the notice.
     */
    leaveCampaign: (id: string) => {
      apply((s) => {
        const c = s.characters.find((x) => x.id === id);
        const cons = leaveConsequences(s, id);
        if (!c || !cons) return s;
        return {
          ...applyLeave(s, id),
          notice: {
            characterId: id,
            kind: 'left',
            title: `${c.name} left ${cons.campaign.name}`,
            lines: [
              ...leaveLines(cons),
              c.ownerId === ME
                ? 'It is in no campaign now: only you can see and edit it.'
                : 'It is in no campaign now: only its owner can see and edit it.',
            ],
          },
        };
      });
    },

    dismissNotice: () => {
      apply((s) => ({ ...s, notice: null }));
    },

    setName: (id: string, name: string) => {
      edit(id, (c) => ({ ...c, name }));
    },

    /** Name, PC/NPC kind, active state, notes (`description`). */
    updateCharacter: (
      id: string,
      patch: Partial<
        Pick<Character, 'name' | 'kind' | 'isActive' | 'description'>
      >,
    ) => {
      edit(id, (c) => ({ ...c, ...patch }));
    },

    /** Replaces the race (null removes it). Choices: the +2 ability (human, half-orc) and favored class. */
    setRace: (
      id: string,
      raceKey: string | null,
      choices: {
        abilityChoice?: AbilityKey | null;
        favoredClass?: string | null;
      } = {},
    ) => {
      edit(id, (c) => {
        const old = raceSheetEntry(c);
        const rest = c.entries.filter((e) => e.kind !== 'race');
        const catalog = raceKey ? lookupCatalog(c, raceKey) : undefined;
        if (!catalog) return { ...c, entries: rest };
        const prev = old?.state.kind === 'race' ? old.state : null;
        const entry: SheetEntry = {
          id: old?.id ?? `${id}-race`,
          kind: 'race',
          catalogKey: catalog.key,
          active: true,
          state: {
            kind: 'race',
            abilityChoice:
              choices.abilityChoice !== undefined
                ? choices.abilityChoice
                : (prev?.abilityChoice ?? null),
            favoredClass:
              choices.favoredClass !== undefined
                ? choices.favoredClass
                : (prev?.favoredClass ?? null),
          },
        };
        return { ...c, entries: [...rest, entry] };
      });
    },

    setBaseScore: (id: string, ability: AbilityKey, value: number) => {
      edit(id, (c) => setBase(c, { ...baseScores(c), [ability]: value }));
    },

    setBaseScores: (id: string, scores: Record<AbilityKey, number>) => {
      edit(id, (c) => setBase(c, scores));
    },

    /** Militia-only in-place edit: changes the base score by the difference so the permanent total equals `total`. */
    setMilitiaScore: (id: string, ability: AbilityKey, total: number) => {
      edit(id, (c) => {
        const now = resolveSheet(c, { permanentOnly: true }).abilities[ability]
          .total;
        const base = baseScores(c);
        return setBase(c, {
          ...base,
          [ability]: base[ability] + (total - now),
        });
      });
    },

    /**
     * Militia-only level edit. Raising appends Unspecified Class Levels;
     * lowering removes Class Levels from the end (and what they granted).
     * Returns the labels of real levels removed — call
     * `levelsRemovedBy(character, level)` first to confirm with the user.
     */
    setMilitiaLevel: (id: string, level: number): string[] => {
      const c = current(id);
      if (!c) return [];
      const removed = levelsRemovedBy(c, level);
      const prefix = newId('lvl');
      edit(id, (ch) => {
        const levels = classLevels(ch);
        if (level >= levels.length)
          return {
            ...ch,
            entries: [
              ...ch.entries,
              ...Array.from({ length: level - levels.length }, (_, i) =>
                classLevelEntry(`${prefix}-${i}`, levels.length + i + 1, null),
              ),
            ],
          };
        return removeLevels(
          ch,
          levels.filter((l) => l.state.position > level).map((l) => l.id),
          false,
        );
      });
      return removed;
    },

    /**
     * Adds a Class Level (null class = Unspecified) at the end or at
     * `choices.position`. `hpGained` starts empty (null) unless given: the
     * player types the number. Adds the class's fixed features for that
     * level unless `autoFeatures: false`. Returns the new level's id.
     */
    addClassLevel: (
      id: string,
      classKey: string | null,
      choices: ClassLevelChoices = {},
    ): string => {
      const levelId = newId('lvl');
      apply((s) =>
        mapCharacter(s, id, (c) => {
          const levels = classLevels(c);
          const position = Math.min(
            Math.max(choices.position ?? levels.length + 1, 1),
            levels.length + 1,
          );
          const entry = classLevelEntry(levelId, position, classKey, choices);
          const order = levels.map((l) => l.id);
          order.splice(position - 1, 0, levelId);
          const next = renumber(
            { ...c, entries: [...c.entries, entry] },
            order,
          );
          return choices.autoFeatures === false
            ? next
            : addFixedFeatures(next, levelId, levelId);
        }),
      );
      return levelId;
    },

    /**
     * Edits any field of a Class Level. Changing its class swaps the fixed
     * features it granted automatically; `hpGained` is never touched unless
     * patched.
     */
    updateClassLevel: (
      id: string,
      levelId: string,
      patch: Partial<Omit<ClassLevelState, 'kind' | 'position'>>,
    ) => {
      const prefix = newId('feat');
      edit(id, (c) => {
        const before = classLevels(c).find((l) => l.id === levelId);
        if (!before) return c;
        const classChanged =
          patch.classKey !== undefined &&
          patch.classKey !== before.state.classKey;
        let next = classChanged ? removeFixedFeatures(c, levelId) : c;
        next = {
          ...next,
          entries: next.entries.map((e) =>
            e.id === levelId && e.state.kind === 'classLevel'
              ? { ...e, state: { ...e.state, ...patch } }
              : e,
          ),
        };
        if (classChanged) next = addFixedFeatures(next, levelId, prefix);
        return next;
      });
    },

    /** Moves a Class Level to `toPosition` (1-based); the others close up. Features stay attached. */
    moveClassLevel: (id: string, levelId: string, toPosition: number) => {
      edit(id, (c) => {
        const order = classLevels(c)
          .map((l) => l.id)
          .filter((x) => x !== levelId);
        order.splice(
          Math.min(Math.max(toPosition, 1), order.length + 1) - 1,
          0,
          levelId,
        );
        return renumber(c, order);
      });
    },

    /** Deletes a Class Level from anywhere; later positions close up. Entries gained at it go too unless keepGained. */
    removeClassLevel: (
      id: string,
      levelId: string,
      opts: { keepGained?: boolean } = {},
    ) => {
      edit(id, (c) => removeLevels(c, [levelId], opts.keepGained ?? false));
    },

    /** Adds a catalog-backed entry (feat, trait, item, spell, condition, class feature…). Returns its id. */
    addEntry: (
      id: string,
      catalogKey: string,
      opts: AddEntryOptions = {},
    ): string => {
      const entryId = newId('entry');
      edit(id, (c) => {
        const catalog = lookupCatalog(c, catalogKey);
        const entry = catalog && catalogEntryToSheet(catalog, entryId, opts);
        return entry ? { ...c, entries: [...c.entries, entry] } : c;
      });
      return entryId;
    },

    /** Removes any entry except the base scores. Removing a Class Level here is removeClassLevel. */
    removeEntry: (id: string, entryId: string) => {
      edit(id, (c) => {
        const entry = c.entries.find((e) => e.id === entryId);
        if (!entry || entry.kind === 'base') return c;
        if (entry.kind === 'classLevel')
          return removeLevels(c, [entryId], false);
        return { ...c, entries: c.entries.filter((e) => e.id !== entryId) };
      });
    },

    /** Off drops its Modifiers and keeps the row. The base scores can't be switched off. */
    toggleEntryActive: (id: string, entryId: string, active?: boolean) => {
      edit(id, (c) => ({
        ...c,
        entries: c.entries.map((e) =>
          e.id === entryId && e.kind !== 'base'
            ? { ...e, active: active ?? !e.active }
            : e,
        ),
      }));
    },

    /** Notes, choice (feats), quantity (items), gainedAtClassLevel. */
    updateEntry: (
      id: string,
      entryId: string,
      patch: {
        notes?: string;
        choice?: string | null;
        quantity?: number;
        gainedAtClassLevel?: string | null;
      },
    ) => {
      edit(id, (c) => ({
        ...c,
        entries: c.entries.map((e) => {
          if (e.id !== entryId) return e;
          let state = e.state;
          if (patch.choice !== undefined && !CHOICELESS.has(state.kind))
            state = { ...state, choice: patch.choice } as SheetEntry['state'];
          if (patch.quantity !== undefined && state.kind === 'item')
            state = { ...state, quantity: patch.quantity };
          return {
            ...e,
            state,
            notes: patch.notes ?? e.notes,
            gainedAtClassLevel:
              patch.gainedAtClassLevel === undefined
                ? e.gainedAtClassLevel
                : (patch.gainedAtClassLevel ?? undefined),
          };
        }),
      }));
    },

    /** A one-off: a character-scoped Catalog Entry plus its sheet entry, in one step. Returns the sheet entry id. */
    addOneOff: (
      id: string,
      oneOff: {
        name: string;
        modifiers: Modifier[];
        kind?: 'manual' | 'item' | 'condition' | 'spell';
        temporary?: boolean;
        notes?: string;
      },
    ): string => {
      const entryId = newId('oneoff');
      const key = `oneoff.${entryId}`;
      edit(id, (c) => {
        const kind = oneOff.kind ?? 'manual';
        const detail: CatalogEntry['detail'] =
          kind === 'item'
            ? { kind: 'item', consumable: oneOff.temporary ?? false }
            : kind === 'spell'
              ? { kind: 'spell', lastsOverOneDay: !(oneOff.temporary ?? true) }
              : { kind };
        const catalog: CatalogEntry = {
          key,
          scope: 'character',
          characterId: id,
          name: oneOff.name,
          stacksWithItself: false,
          modifiers: oneOff.modifiers,
          detail,
        };
        const entry = catalogEntryToSheet(catalog, entryId, {
          notes: oneOff.notes,
        })!;
        return {
          ...c,
          ownCatalog: [...c.ownCatalog, catalog],
          entries: [...c.entries, entry],
        };
      });
      return entryId;
    },

    /** Ability damage (temporary, lowers the modifier) or drain (permanent, lowers the score). */
    addAbilityDamage: (
      id: string,
      damage: { ability: AbilityKey; points: number; drain?: boolean },
    ): string => {
      const entryId = newId('dmg');
      const kind = damage.drain ? 'abilityDrain' : 'abilityDamage';
      edit(id, (c) => ({
        ...c,
        entries: [
          ...c.entries,
          {
            id: entryId,
            kind,
            active: true,
            state: { kind, ability: damage.ability, points: damage.points },
          },
        ],
      }));
      return entryId;
    },

    setPointBuyBudget: (points: number) => {
      apply((s) => ({ ...s, pointBuyBudget: points }));
    },

    /** Adds to / removes from the campaign's militia roster (no-op without a militia). */
    setOnRoster: (
      characterId: string,
      onRoster: boolean,
      roles: OfficerRole[] = [],
    ) => {
      apply((s) => {
        const c = s.characters.find((x) => x.id === characterId);
        return {
          ...s,
          campaigns: s.campaigns.map((cp) => {
            if (cp.id !== c?.campaignId || !cp.militia) return cp;
            const rest = cp.militia.roster.filter(
              (p) => p.characterId !== characterId,
            );
            return {
              ...cp,
              militia: {
                ...cp.militia,
                roster: onRoster
                  ? [...rest, { characterId, roles, hitDiceOverride: null }]
                  : rest,
              },
            };
          }),
        };
      });
    },

    /** Replaces a roster person's officer roles (no-op when not on the roster). */
    setRoles: (characterId: string, roles: OfficerRole[]) => {
      apply((s) => ({
        ...s,
        campaigns: s.campaigns.map((cp) =>
          cp.militia
            ? {
                ...cp,
                militia: {
                  ...cp.militia,
                  roster: cp.militia.roster.map((p) =>
                    p.characterId === characterId ? { ...p, roles } : p,
                  ),
                },
              }
            : cp,
        ),
      }));
    },

    /** The militia's own Hit Dice ruling for a roster person (null = computed). */
    setHitDiceOverride: (characterId: string, hitDice: number | null) => {
      apply((s) => ({
        ...s,
        campaigns: s.campaigns.map((cp) =>
          cp.militia
            ? {
                ...cp,
                militia: {
                  ...cp.militia,
                  roster: cp.militia.roster.map((p) =>
                    p.characterId === characterId
                      ? { ...p, hitDiceOverride: hitDice }
                      : p,
                  ),
                },
              }
            : cp,
        ),
      }));
    },

    resetPrototype: () => {
      dispatch({ kind: 'reset' });
    },
  };
}

export type BuilderActions = ReturnType<typeof makeActions>;

/** A store without React, for scripts and tests: `const s = createMemoryStore(); s.actions.addClassLevel(…); s.state`. */
export function createMemoryStore() {
  let state = initialState();
  const dispatch = (action: Action) => {
    state = reduce(state, action);
  };
  return {
    get state() {
      return state;
    },
    get actions() {
      return makeActions(dispatch, state);
    },
  };
}

export type BuilderStore = BuilderActions & {
  state: BuilderState;
  /** The global catalog (character-scoped entries are on `Character.ownCatalog`). */
  catalog: CatalogEntry[];
};

const StoreContext = createContext<BuilderStore | null>(null);

export function PrototypeStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const value = useMemo<BuilderStore>(
    () => ({
      ...makeActions(dispatch, state),
      state,
      catalog: CATALOG,
    }),
    [state],
  );
  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useBuilderStore(): BuilderStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useBuilderStore needs <PrototypeStoreProvider>');
  return store;
}

// --------------------------------------------------------------- selectors

export function useCharacter(
  id: string | null | undefined,
): Character | undefined {
  const { state } = useBuilderStore();
  return state.characters.find((c) => c.id === id);
}

export function useCampaign(
  id: string | null | undefined,
): Campaign | undefined {
  const { state } = useBuilderStore();
  return state.campaigns.find((c) => c.id === id);
}

/** The active organization's campaigns (one organization in this prototype). */
export function useCampaigns(orgId = ORGS[0]!.id): Campaign[] {
  const { state } = useBuilderStore();
  return useMemo(
    () => state.campaigns.filter((c) => c.orgId === orgId),
    [state, orgId],
  );
}

/**
 * The Characters area: every Character I own, grouped "No campaign" first,
 * then one group per campaign (empty groups included, so the page can say
 * "None").
 */
export function useMyCharacters() {
  const { state } = useBuilderStore();
  return useMemo(() => {
    const mine = state.characters.filter((c) => c.ownerId === ME);
    return [
      {
        key: 'none',
        campaign: null as Campaign | null,
        characters: mine.filter((c) => !c.campaignId),
      },
      ...state.campaigns.map((campaign) => ({
        key: campaign.id,
        campaign: campaign as Campaign | null,
        characters: mine.filter((c) => c.campaignId === campaign.id),
      })),
    ];
  }, [state]);
}

/** The roster place of a Character in its campaign's militia, or null. */
export function useRosterPerson(id: string | null | undefined) {
  const { state } = useBuilderStore();
  const character = state.characters.find((c) => c.id === id);
  const campaign = state.campaigns.find(
    (cp) => cp.id === character?.campaignId,
  );
  return campaign?.militia?.roster.find((p) => p.characterId === id) ?? null;
}

/** The confirmation note for this Character, if the last membership change was its. */
export function useNotice(id: string | null | undefined): Notice | null {
  const { state } = useBuilderStore();
  return state.notice && state.notice.characterId === id ? state.notice : null;
}

/** Only the owner can take a Character out of its campaign (data model, "Leaving"). */
export function canLeave(character: Character) {
  return Boolean(character.campaignId) && character.ownerId === ME;
}

/** Militia-only is possible only in a campaign with a militia. */
export function isMilitiaOnly(character: Character) {
  return character.sheetMode === 'militiaOnly';
}

/** A campaign's Characters with their roster facts (null roster = not on it, or no militia). */
export function useCampaignCharacters(campaignId: string | null | undefined) {
  const { state } = useBuilderStore();
  return useMemo(() => {
    const campaign = state.campaigns.find((c) => c.id === campaignId);
    return state.characters
      .filter((c) => c.campaignId === campaignId)
      .map((character) => ({
        character,
        roster:
          campaign?.militia?.roster.find(
            (p) => p.characterId === character.id,
          ) ?? null,
      }));
  }, [state, campaignId]);
}

/** The full derived sheet (every active entry), memoised per Character object. */
export function useResolved(id: string | null | undefined) {
  const character = useCharacter(id);
  return useMemo(
    () => (character ? resolveSheet(character) : null),
    [character],
  );
}

export function useWarnings(id: string | null | undefined): Warning[] {
  const character = useCharacter(id);
  const { state } = useBuilderStore();
  return useMemo(
    () =>
      character
        ? advisoryWarnings(character, { pointBuyBudget: state.pointBuyBudget })
        : [],
    [character, state.pointBuyBudget],
  );
}

/** Skill ranks a Class Level allows, from the Character's permanent Int. */
export function skillRankBudget(character: Character, levelId: string) {
  const int = resolveSheet(character, { permanentOnly: true }).abilities.int
    .total;
  return skillRankBudgetWithInt(character, levelId, int);
}

export { ABILITIES, classLevelLabel };
export { ME, ORGS, USERS, userName } from './mock-characters';
export {
  baseScores,
  classLevelShortLabel,
  classLevels,
  className,
  characterLevel,
  entryName,
  favoredClass,
  featSlots,
  featuresGainedAt,
  hitDice,
  isTemporary,
  levelInClass,
  levelLine,
  levelsRemovedBy,
  lookupCatalog,
  pointBuyCost,
  raceCatalog,
} from './sheet';
