# Pathfinder character sheet: catalog entries, sheet entries, non-stacking modifiers

## Context

We are starting a Pathfinder (1e) character creation / viewing / progression tool in this repo. First slice: base ability scores plus items, class features, spells and other effects that grant ability-score bonuses, entered manually. Only the six main stats for now.

The modelling problem: a stat's current value is the sum of bonuses from many sources, but bonuses of the same *type* (enhancement, morale, ...) do not stack, only the highest applies. Bonuses must stay attached to the thing that grants them so removing a spell or item removes its bonuses automatically, and we must be able to resolve the current total of any stat at any time.

The existing `character` and `spell` tables are not reused.

## Vocabulary

- **Catalog entry**: the definition of a thing that can be on a character sheet: an item, spell, feat, class feature, racial trait, level-up increase, the base scores, or a manual adjustment. Holds the rule facts (name, kind, kind-specific detail, modifiers). Has a scope: global, campaign or character.
- **Character sheet entry**: one instance of a catalog entry on one character. Holds per-character state only: active/equipped, notes, kind-specific state.
- **Modifier**: `{ target, bonusType, value }`. Lives only on catalog entries. A catalog entry may have none (a rope).
- **Modifier source**: not a table. The resolver's term for a character sheet entry whose catalog entry has modifiers.
- **Resolved stat**: a derived total with its breakdown. Never stored.

## Principles

1. **Stat totals are never stored.** They are derived from modifiers every time.
2. **Everything on the sheet is a character sheet entry.** Gear, spells, features, base scores, curses. Some grant modifiers, most gear does not. This is the model Foundry VTT converged on (Actor has Items of many types).
3. **Modifiers live on catalog entries, always.** No inline-modifier path on a sheet entry. A one-off item, a manual adjustment and the base scores are catalog entries scoped to one character.
4. **One catalog entry owns many modifiers.** A belt that grants Str, Dex and Con is one entry with three modifiers and one equipped toggle.
5. **Rule facts on the catalog entry, state on the sheet entry.** Weight, slot, prerequisites, modifiers are facts. Active, quantity, charges, notes are state.
6. **Kind-specific shape is a discriminated union, not separate tables.** `detail` on the catalog entry and `state` on the sheet entry are unions keyed by `kind`. Inventory is the sheet entries of kind `item`, not another table. "Equipped" is the item UI's word for `active`.
7. **No caches.** No "active effects" table. The sheet query walks the character's sheet entries and resolves. Convex reactivity keeps it live.
8. **Pools are not entries.** Spell slots, hit points, daily uses are character resources that entries draw from. Out of scope for this slice, noted so the union is not asked to hold them later.

## Tables

```ts
// Identity only. No stat fields.
pfCharacter: {
  campaignId: Id<'campaign'>,
  name: string,
  level: number,
}

// The only place modifiers are stored. Scope decides who can see and edit it.
pfCatalogEntry: {
  scope: 'global' | 'campaign' | 'character',
  campaignId?: Id<'campaign'>,        // set for campaign and character scope
  characterId?: Id<'pfCharacter'>,    // set for character scope
  name: string,
  modifiers: Modifier[],              // bounded, cap 12. Empty is fine.
  detail: CatalogEntryDetail,         // discriminated on `kind`
}
// indexes: by_scope, by_campaignId_and_scope, by_characterId

// One row per thing a character has. State only, no modifiers.
pfCharacterSheetEntry: {
  characterId: Id<'pfCharacter'>,
  campaignId: Id<'campaign'>,
  catalogEntryId: Id<'pfCatalogEntry'>,
  kind: EntryKind,                    // copied from the catalog entry at creation, immutable, so it can be indexed
  active: boolean,                    // equipped / spell running. Off drops its modifiers, keeps the row.
  notes?: string,
  state: SheetEntryState,             // discriminated on `kind`, matches catalog entry's kind
}
// indexes: by_characterId, by_characterId_and_kind, by_catalogEntryId
```

Sheet entries exist separately from catalog entries because a character can own two of the same catalog entry (two potions) with independent active state.

```ts
type EntryKind  = 'base' | 'item' | 'spell' | 'classFeature' | 'race' | 'levelUp' | 'feat' | 'manual';
type AbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
type BonusType  = 'base' | 'enhancement' | 'inherent' | 'morale' | 'racial' | 'size' | 'alchemical'
                | 'insight' | 'luck' | 'sacred' | 'profane' | 'circumstance' | 'untyped';
type Modifier   = { target: AbilityKey; bonusType: BonusType; value: number };  // negative = penalty

// Slice 1: every variant is just its discriminator. Fields listed are where later facts go.
type CatalogEntryDetail =
  | { kind: 'item' }          // later: slot, weight, price
  | { kind: 'spell' }         // later: level, school, duration
  | { kind: 'feat' }
  | { kind: 'classFeature' }
  | { kind: 'race' }
  | { kind: 'levelUp' }
  | { kind: 'base' }
  | { kind: 'manual' };

type SheetEntryState =
  | { kind: 'item' }          // later: quantity, charges
  | { kind: 'spell' }         // later: rounds remaining, spellbook ref
  | { kind: 'feat' } | { kind: 'classFeature' } | { kind: 'race' }
  | { kind: 'levelUp' } | { kind: 'base' } | { kind: 'manual' };
```

### Base scores

Creating a character also inserts a character-scoped catalog entry of kind `base` with six `base`-typed modifiers at 10, plus its sheet entry, so a fresh sheet is never empty. Editing base scores edits that catalog entry. Invariant enforced in mutations: exactly one base sheet entry per character, cannot be removed or deactivated. `base` uses the `highest` stacking rule so a duplicate can never double-count.

Racial modifiers and level 4/8/12 increases are their own entries (`race`, `levelUp`) with `untyped` modifiers. They stack, and the sheet keeps the history.

### Scope tiers

- **Global**: shipped catalog, read-only for players.
- **Campaign**: homebrew entered once, usable by every character in the campaign, editable by anyone in the campaign. The catalog picker lists global + campaign.
- **Character**: one-off on a single character. Base scores, manual adjustments, homebrew tweaks. Only ever shown on its own sheet.

Adding a one-off item is one mutation that inserts the character-scoped catalog entry and its sheet entry together. "Save to catalog" rescopes a character entry to campaign. "Detach" clones a global or campaign catalog entry into a character-scoped one and repoints the sheet entry, so the tweak does not affect other characters.

Widening later means adding to `AbilityKey` (`ac`, `save.fort`, `skill.acrobatics`...), `BonusType` (`deflection`, `dodge`, `armor`...), and the union variants. Item slot limits are an equip-time warning counting active item entries per slot. Conditional modifiers get a `condition` field on the modifier. None of it changes the resolver.

## Resolver (`src/lib/pf-stat-resolver.ts`, pure)

```ts
type SourcedModifier = Modifier & { sheetEntryId: string; entryName: string };

collectModifiers(entries: pfCharacterSheetEntry[], catalog: Map<id, pfCatalogEntry>): SourcedModifier[]
  // active entries only; each contributes its catalog entry's modifiers, tagged with the sheet entry id

resolveStat(modifiers: SourcedModifier[]): {
  total: number,
  applied: SourcedModifier[],
  suppressed: Array<{ modifier: SourcedModifier; by: SourcedModifier }>,
}

resolveAbilityScores(modifiers: SourcedModifier[]): Record<AbilityKey, ResolvedStat & { modifier: number }>
  // modifier = floor((total - 10) / 2)
```

Stacking rules, a lookup table keyed by bonus type:

| Rule | Types | Behaviour |
|---|---|---|
| `stack` | `untyped`, `dodge` | all sum |
| `stackAcrossSources` | `circumstance` | sum, but one sheet entry contributes only its best |
| `highest` | `base` and everything else | best bonus of the type applies, and separately the worst penalty of the type applies |

Plus the same-source rule: two modifiers of the same type and target from the same sheet entry never stack. `suppressed` is what the sheet shows on hover ("+2 enhancement overridden by +4 from Belt of Giant Strength").

## Implementation steps

1. **Types + zod** in `src/lib/pf-sheet.ts`: `ABILITY_KEYS`, `BONUS_TYPES`, `ENTRY_KINDS`, `CATALOG_SCOPES`, `STACKING_RULES`, `modifierSchema`, `modifiersSchema` (max 12), `catalogEntrySchema` (scope/id consistency refined, `detail.kind` discriminated union), `characterSheetEntrySchema` (`state.kind` must equal `kind`).
2. **Resolver** in `src/lib/pf-stat-resolver.ts` + `pf-stat-resolver.test.ts`. Cases: same-type picks highest; untyped stacks; penalties take the worst per type; same-entry untyped does not stack; inactive entry ignored; entry with no modifiers contributes nothing; two sheet entries of one catalog entry count as two sources; suppressed names the winner; base alone returns base; no modifiers returns 0.
3. **Convex schema**: add the three tables to `convex/schema.ts` following its conventions (`<name>Validator` exports, `v.id` keys, `by_<field>` indexes). Use `zodOutputToConvex` from `convex-helpers/server/zod4` so the zod schema is the single definition.
4. **Convex functions** `convex/pfCharacter.ts`, `convex/pfCharacterSheetEntry.ts`, `convex/pfCatalogEntry.ts`:
   - `createCharacter` (also inserts the base catalog entry and its sheet entry), `updateCharacter`, `listByCampaign`.
   - `addFromCatalog(catalogEntryId)`, `addOneOff(catalog entry fields)` (inserts a character-scoped catalog entry plus sheet entry in one mutation), `setActive`, `updateNotes`, `remove` (refuses the base entry; also deletes a character-scoped catalog entry when its last sheet entry goes), `updateBaseScores`.
   - `listCatalog(campaignId)` = global + campaign scope, `createCatalogEntry` (campaign scope), `updateCatalogEntry` (campaign or own-character scope only), `saveToCatalog` (character to campaign), `detach` (clone to character scope and repoint).
   - `getSheet(characterId)` returns character, its sheet entries, and the referenced catalog entries. Resolution runs client-side with the pure resolver.
   - Scope every read/write by campaign and org, following `assertCampaignAccess` in `convex/character.ts:14-30`.
5. **UI** in `src/components/pf-sheet/`, thin page at `src/app/campaigns/[campaignId]/sheet/[characterId]/page.tsx`: six resolved stats with breakdown popover, base score inputs, sheet entry list with add / edit / active toggle / remove, add-from-catalog picker, create-campaign-entry form. shadcn/ui, `react-hook-form` + zod, rules in `src/lib`, orchestration in a `use-pf-sheet.ts` hook.
6. Add `Catalog Entry`, `Character Sheet Entry`, `Modifier`, `Bonus Type`, `Modifier Source`, `Resolved Stat` to the `CONTEXT.md` glossary.

## Verification

- `pnpm test src/lib/pf-stat-resolver.test.ts` covers the stacking matrix.
- `convex/pfCharacterSheetEntry.integration.test.ts` (convex-test, edge-runtime): removing a sheet entry drops its bonuses from `getSheet`; `setActive(false)` does the same without deleting; the base entry cannot be removed; editing a campaign catalog entry changes every character referencing it; a character-scoped catalog entry never appears in another character's sheet or in the catalog picker; a campaign cannot read another campaign's catalog entries.
- Manual: character with base Str 14; add "Belt of Giant Strength +4" (enhancement) and "Bull's Strength +2" (enhancement) -> Str 18, spell shown as suppressed; deactivate the belt -> Str 16; add a `levelUp` +1 -> Str 17; add a rope with no modifiers and confirm nothing changes; save the belt to the campaign catalog and add it to a second character.
- `pnpm -s typecheck`, `pnpm -s lint`.
