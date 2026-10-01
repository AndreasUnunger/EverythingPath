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
import type { AbilityKey, Character, SheetEntry } from '../types';
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
                  return (
                    <li key={e.id} className="flex items-center gap-2 py-0.5">
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
                    </li>
                  );
                })}
                {picks.map((f) =>
                  f.kind === 'choice' && f.picked.length === 0 ? (
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
  spell: 'spell',
  condition: 'condition',
  manual: 'manual',
  abilityDamage: 'damage',
  abilityDrain: 'drain',
};

export function GearBlock({ character }: { character: Character }) {
  const store = useBuilderStore();
  const [dmgAbility, setDmgAbility] = useState<AbilityKey | null>(null);
  const [dmgPoints, setDmgPoints] = useState<number | null>(null);
  const entries = character.entries.filter((e) =>
    [
      'item',
      'spell',
      'condition',
      'manual',
      'abilityDamage',
      'abilityDrain',
    ].includes(e.kind),
  );
  const options = (['item', 'spell', 'condition'] as const).flatMap((kind) =>
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
