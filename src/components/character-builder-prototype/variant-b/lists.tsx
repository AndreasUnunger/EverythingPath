'use client';
// PROTOTYPE (throwaway, #208) — Variant B: feats & traits, class features
// grouped by the Class Level that granted them, and gear / spells /
// conditions with their active toggles.

import { X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '~/lib/utils';
import { ABILITY_LABEL, catalogOfKind } from '../catalog';
import {
  classLevelShortLabel,
  classLevels,
  entryName,
  featSlots,
  featuresGainedAt,
  lookupCatalog,
  useBuilderStore,
} from '../store';
import {
  SCHOOL_LABEL,
  levelText,
  prefillCasterLevel,
  prefillSource,
} from '../spellcasting';
import {
  SCHOOLS,
  type AbilityKey,
  type Character,
  type SchoolKey,
  type SheetEntry,
} from '../types';
import type { Warning } from '../warnings';
import { groupOptions } from './levels-table';
import {
  ActiveToggle,
  Block,
  FieldWarnings,
  NumField,
  PickField,
  TextField,
  chip,
  todoRing,
  useSheetUi,
} from './shared';

function RemoveButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      onClick={onClick}
      className="text-muted-foreground hover:text-destructive flex size-7 shrink-0 items-center justify-center"
    >
      <X className="size-3.5" />
    </button>
  );
}

function levelOptions(character: Character) {
  return classLevels(character).map((l) => ({
    value: l.id,
    label: `${l.state.position} · ${classLevelShortLabel(character, l.id)}`,
  }));
}

// ------------------------------------------------------------------ feats

export function FeatsBlock({
  character,
  warnings,
}: {
  character: Character;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  const ui = useSheetUi();
  const slots = featSlots(character);
  const feats = character.entries.filter((e) => e.kind === 'feat');
  const traits = character.entries.filter((e) => e.kind === 'trait');
  const defaultLevel =
    ui.ranksLevelId ?? classLevels(character).at(-1)?.id ?? undefined;
  const open = slots.slots.length - slots.taken;
  const featOptions = catalogOfKind('feat').map((f) => ({
    value: f.key,
    label: f.summary ? `${f.name} — ${f.summary}` : f.name,
  }));
  const traitOptions = catalogOfKind('trait').map((t) => ({
    value: t.key,
    label: t.summary ? `${t.name} — ${t.summary}` : t.name,
  }));

  const row = (e: SheetEntry) => {
    const catalog = lookupCatalog(character, e.catalogKey);
    const choice =
      catalog?.detail.kind === 'feat' ? catalog.detail.choice : undefined;
    const value = 'choice' in e.state ? (e.state.choice ?? '') : '';
    return (
      <li key={e.id} id={`b-entry-${e.id}`} className="py-1">
        {/* Name left, picker and remove right; the name wraps if it must. */}
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 py-1 leading-tight">
            {catalog?.name ?? e.catalogKey}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {e.kind === 'feat' && (
              <PickField
                ariaLabel="Level gained"
                value={e.gainedAtClassLevel ?? null}
                options={levelOptions(character)}
                placeholder="level?"
                className="w-32 text-xs"
                onChange={(v) =>
                  store.updateEntry(character.id, e.id, {
                    gainedAtClassLevel: v,
                  })
                }
              />
            )}
            <RemoveButton
              label={catalog?.name ?? e.kind}
              onClick={() => store.removeEntry(character.id, e.id)}
            />
          </span>
        </div>
        {catalog?.summary && (
          <p className="text-muted-foreground text-xs">{catalog.summary}</p>
        )}
        {(!!choice || !!e.notes) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {choice && (
              <TextField
                ariaLabel={`${catalog?.name} ${choice}`}
                value={value}
                placeholder={choice}
                className="h-7 w-28 text-xs"
                onChange={(v) =>
                  store.updateEntry(character.id, e.id, { choice: v || null })
                }
              />
            )}
            {e.notes && (
              <span className="text-muted-foreground text-xs">{e.notes}</span>
            )}
          </div>
        )}
        <FieldWarnings
          warnings={warnings}
          where={`entry:${e.id}`}
          characterId={character.id}
          compact
        />
      </li>
    );
  };

  return (
    <Block
      id="b-feats"
      title="Feats & traits"
      aside={
        <span
          className={cn(
            'font-mono text-xs',
            open > 0 && 'text-sky-300',
            open < 0 && 'text-amber-300',
          )}
          title={slots.slots.map((s) => s.reason).join(' · ')}
        >
          {slots.taken}/{slots.slots.length} feat slots
          {open > 0 && ` · ${open} open`}
        </span>
      }
    >
      <FieldWarnings
        warnings={warnings}
        where="feats"
        characterId={character.id}
      />
      <ul className="divide-foreground/10 divide-y text-sm">
        {feats.map(row)}
      </ul>
      <PickField
        ariaLabel="Add a feat"
        value={null}
        options={featOptions}
        placeholder={open > 0 ? `+ Add feat (${open} open)` : '+ Add feat'}
        className={cn('mt-1 w-full text-xs', open > 0 && 'text-sky-300')}
        todo={open > 0}
        onChange={(key) =>
          key &&
          store.addEntry(character.id, key, {
            gainedAtClassLevel: defaultLevel,
          })
        }
      />
      <h3 className="text-muted-foreground mt-3 font-mono text-xs tracking-wide uppercase">
        Traits
      </h3>
      <ul className="divide-foreground/10 divide-y text-sm">
        {traits.map(row)}
      </ul>
      <PickField
        ariaLabel="Add a trait"
        value={null}
        options={traitOptions}
        placeholder="+ Add trait"
        className="mt-1 w-full text-xs"
        onChange={(key) => key && store.addEntry(character.id, key)}
      />
    </Block>
  );
}

// --------------------------------------------------------------- features

/**
 * PROTOTYPE (#233): an arcane school's two opposition schools, edited on
 * its class feature row. The spells page only displays them.
 */
function OppositionSchools({
  character,
  entry,
  school,
  classKey,
  warnings,
}: {
  character: Character;
  entry: SheetEntry;
  school: SchoolKey;
  classKey: string | null;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  const chosen =
    entry.state.kind === 'classFeature'
      ? (entry.state.oppositionSchools ?? [])
      : [];
  const options = SCHOOLS.filter((s) => s !== 'universal').map((s) => ({
    value: s,
    label:
      s === school
        ? `${SCHOOL_LABEL[s]} (your specialist school)`
        : SCHOOL_LABEL[s],
  }));
  const set = (i: 0 | 1, v: SchoolKey | null) => {
    const next: (SchoolKey | undefined)[] = [chosen[0], chosen[1]];
    next[i] = v ?? undefined;
    store.setOppositionSchools(
      character.id,
      entry.id,
      next.filter((s): s is SchoolKey => Boolean(s)),
    );
  };
  return (
    <div className="mt-1 mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      {/* Phone: the label takes its own line and the two selects share the next. */}
      <span className="text-muted-foreground basis-full text-xs md:basis-auto">
        Opposition schools
      </span>
      {([0, 1] as const).map((i) => (
        <PickField<SchoolKey>
          key={i}
          ariaLabel={`Opposition school ${i + 1}`}
          value={chosen[i] ?? null}
          options={options}
          placeholder="—"
          className="min-w-0 flex-1 text-xs md:w-36 md:flex-none"
          todo={chosen[i] === undefined}
          onChange={(v) => set(i, v)}
        />
      ))}
      <FieldWarnings
        warnings={warnings}
        where={(w) =>
          w.where === `spellcasting:${classKey}` &&
          w.id.startsWith('opposition-')
        }
        characterId={character.id}
        className="basis-full"
        compact
      />
    </div>
  );
}

export function FeaturesBlock({
  character,
  warnings,
}: {
  character: Character;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  const levels = classLevels(character);
  const loose = character.entries.filter(
    (e) => e.kind === 'classFeature' && !e.gainedAtClassLevel,
  );
  return (
    <Block id="b-features" title="Class features">
      <FieldWarnings
        warnings={warnings}
        where="features"
        characterId={character.id}
        className="mb-2"
      />
      <div className="space-y-2 text-sm">
        {levels.map((l) => {
          const gained = featuresGainedAt(character, l.id);
          const features = gained.gainedHere.filter(
            (e) => e.kind === 'classFeature',
          );
          const picks = gained.features.filter((f) => f.kind === 'choice');
          if (features.length === 0 && picks.length === 0) return null;
          return (
            <div key={l.id} className="border-foreground/10 border-l-2 pl-2">
              <div className="text-muted-foreground font-mono text-xs">
                {classLevelShortLabel(character, l.id)} · level{' '}
                {l.state.position}
              </div>
              <ul>
                {features.map((e) => {
                  const catalog = lookupCatalog(character, e.catalogKey);
                  const school =
                    catalog?.detail.kind === 'classFeature'
                      ? catalog.detail.spellcasting?.school
                      : undefined;
                  return (
                    <li key={e.id} className="py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          {catalog?.name ?? e.catalogKey}
                          {catalog?.summary && (
                            <span className="text-muted-foreground text-xs">
                              {' '}
                              · {catalog.summary}
                            </span>
                          )}
                          {e.notes && (
                            <span className="text-muted-foreground text-xs">
                              {' '}
                              ({e.notes})
                            </span>
                          )}
                        </span>
                        <RemoveButton
                          label={catalog?.name ?? 'feature'}
                          onClick={() => store.removeEntry(character.id, e.id)}
                        />
                      </div>
                      {school && (
                        <OppositionSchools
                          character={character}
                          entry={e}
                          school={school}
                          classKey={l.state.classKey}
                          warnings={warnings}
                        />
                      )}
                    </li>
                  );
                })}
                {picks.map((f) =>
                  f.kind === 'choice' &&
                  f.picked.length < (f.grant.count ?? 1) ? (
                    <li key={f.grant.choose} className="py-0.5">
                      <PickField
                        ariaLabel={`Pick a ${f.grant.label}`}
                        value={null}
                        options={groupOptions(f.grant.choose)}
                        placeholder={`Pick: ${f.grant.label.toLowerCase()}…`}
                        className="w-full text-xs text-sky-300"
                        todo
                        onChange={(key) =>
                          key &&
                          store.addEntry(character.id, key, {
                            gainedAtClassLevel: l.id,
                          })
                        }
                      />
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          );
        })}
        {loose.length > 0 && (
          <div className="border-foreground/10 border-l-2 pl-2">
            <div className="text-muted-foreground font-mono text-xs">
              Not tied to a level
            </div>
            <ul>
              {loose.map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-0.5">
                  <span className="flex-1">{entryName(character, e)}</span>
                  <RemoveButton
                    label={entryName(character, e)}
                    onClick={() => store.removeEntry(character.id, e.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        {levels.every((l) => !l.state.classKey) && (
          <p className="text-muted-foreground text-xs">
            Choose classes in the Class Levels table; their features appear here
            by level.
          </p>
        )}
      </div>
    </Block>
  );
}

// ------------------------------------------------------------------- gear

const KIND_LABEL: Record<string, string> = {
  item: 'gear',
  spellEffect: 'spell',
  condition: 'condition',
  manual: 'manual',
  abilityDamage: 'damage',
  abilityDrain: 'drain',
};

/** PROTOTYPE (#233): why a Spell Effect's caster level reads what it does. */
function casterLevelTitle(character: Character, entry: SheetEntry) {
  const detail = lookupCatalog(character, entry.catalogKey)?.detail;
  const spell =
    detail?.kind === 'spellEffect'
      ? lookupCatalog(character, detail.spellKey)
      : undefined;
  const src =
    spell?.detail.kind === 'spell' ? prefillSource(spell.detail) : null;
  if (!src) return "Caster level. Change it to the caster's.";
  return `Caster level. Pre-filled ${src.casterLevel}: the lowest that can cast it (${src.className} ${src.classLevel}, ${levelText(src.spellLevel)} spells). Change it to the caster's.`;
}

/**
 * PROTOTYPE (#233): a Spell Effect's caster level. The field may be empty
 * while typing; every valid number (1+) is written at once, and leaving it
 * empty restores the pre-fill.
 */
function CasterLevelField({
  value,
  prefill,
  onChange,
}: {
  value: number;
  prefill: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(value);
  // Follow the store when it changes from elsewhere (a reset, a pre-fill).
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      aria-label="Caster level"
      value={draft ?? ''}
      onChange={(e) => {
        const next = e.target.value === '' ? null : Number(e.target.value);
        setDraft(next);
        if (next !== null && Number.isFinite(next) && next >= 1)
          onChange(Math.floor(next));
      }}
      onBlur={() => {
        if (draft !== null && draft >= 1) return;
        setDraft(prefill);
        onChange(prefill);
      }}
      className={cn(
        'bg-field border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 [appearance:textfield] border px-1 text-center font-mono text-base outline-none focus-visible:ring-[3px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        'h-7 w-10 text-xs',
        draft === null && todoRing,
      )}
    />
  );
}

export function GearBlock({ character }: { character: Character }) {
  const store = useBuilderStore();
  const [dmgAbility, setDmgAbility] = useState<AbilityKey | null>(null);
  const [dmgPoints, setDmgPoints] = useState<number | null>(null);
  const entries = character.entries.filter((e) =>
    [
      'item',
      'spellEffect',
      'condition',
      'manual',
      'abilityDamage',
      'abilityDrain',
    ].includes(e.kind),
  );
  const options = (['item', 'spellEffect', 'condition'] as const).flatMap(
    (kind) =>
      catalogOfKind(kind).map((c) => ({
        value: c.key,
        label: `${KIND_LABEL[kind]}: ${c.name}${c.summary ? ` — ${c.summary}` : ''}`,
      })),
  );
  return (
    <Block id="b-gear" title="Gear, spells & conditions">
      <ul className="divide-foreground/10 divide-y text-sm">
        {entries.map((e) => {
          const catalog = lookupCatalog(character, e.catalogKey);
          return (
            <li
              key={e.id}
              id={`b-entry-${e.id}`}
              className={cn(
                'flex items-center gap-2 py-1',
                !e.active && 'text-muted-foreground',
              )}
            >
              <ActiveToggle
                active={e.active}
                label={entryName(character, e)}
                onChange={(v) => store.toggleEntryActive(character.id, e.id, v)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {entryName(character, e)}
                </span>
                {(catalog?.summary ?? e.notes) && (
                  <span className="text-muted-foreground block truncate text-xs">
                    {catalog?.summary}
                    {catalog?.summary && e.notes ? ' · ' : ''}
                    {e.notes}
                  </span>
                )}
              </span>
              <span className={cn(chip, 'hidden lg:inline-flex')}>
                {KIND_LABEL[e.kind]}
              </span>
              {e.state.kind === 'item' && (
                <NumField
                  ariaLabel="Quantity"
                  value={e.state.quantity}
                  width="w-10"
                  className="h-7 text-xs"
                  onChange={(v) =>
                    store.updateEntry(character.id, e.id, { quantity: v ?? 1 })
                  }
                />
              )}
              {e.state.kind === 'spellEffect' && (
                <span
                  className="flex shrink-0 items-center gap-1"
                  title={casterLevelTitle(character, e)}
                >
                  <span className="text-muted-foreground font-mono text-xs">
                    CL
                  </span>
                  <CasterLevelField
                    value={e.state.casterLevel}
                    prefill={catalog ? prefillCasterLevel(catalog) : 1}
                    onChange={(v) =>
                      store.setSpellEffectCasterLevel(character.id, e.id, v)
                    }
                  />
                </span>
              )}
              <RemoveButton
                label={entryName(character, e)}
                onClick={() => store.removeEntry(character.id, e.id)}
              />
            </li>
          );
        })}
      </ul>
      <PickField
        ariaLabel="Add gear, a spell or a condition"
        value={null}
        options={options}
        placeholder="+ Add gear, spell or condition"
        className="mt-1 w-full text-xs"
        onChange={(key) => key && store.addEntry(character.id, key)}
      />
      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
        <span className="text-muted-foreground">Ability damage</span>
        <PickField
          ariaLabel="Damaged ability"
          value={dmgAbility}
          options={(Object.keys(ABILITY_LABEL) as AbilityKey[]).map((a) => ({
            value: a,
            label: ABILITY_LABEL[a],
          }))}
          placeholder="ability"
          className="w-28"
          onChange={setDmgAbility}
        />
        <NumField
          ariaLabel="Points of ability damage"
          value={dmgPoints}
          placeholder="pts"
          width="w-12"
          onChange={setDmgPoints}
        />
        <button
          type="button"
          className={cn(chip, 'hover:bg-foreground/10 h-8')}
          onClick={() => {
            if (!dmgAbility || !dmgPoints) return;
            store.addAbilityDamage(character.id, {
              ability: dmgAbility,
              points: dmgPoints,
            });
            setDmgPoints(null);
          }}
        >
          add
        </button>
      </div>
    </Block>
  );
}
