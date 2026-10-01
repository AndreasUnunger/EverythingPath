'use client';
// PROTOTYPE (throwaway, #208) — Variant C "Now" card: what the character
// carries and what is affecting them right now (gear, spells, conditions,
// ability damage). Not tied to any level, so it sits after the last one.

import { Sparkles, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT, catalogOfKind } from '../catalog';
import { entryName, isTemporary, useBuilderStore } from '../store';
import {
  ABILITIES,
  type AbilityKey,
  type Character,
  type SheetEntry,
} from '../types';
import { Caption, Chip, action } from './bits';

const NOW_KINDS = new Set<SheetEntry['kind']>([
  'item',
  'spell',
  'condition',
  'manual',
  'abilityDamage',
  'abilityDrain',
]);

export function nowEntries(character: Character) {
  return character.entries.filter((e) => NOW_KINDS.has(e.kind));
}

export function nowSummary(character: Character) {
  const entries = nowEntries(character);
  const on = entries.filter((e) => e.active).map((e) => entryName(character, e));
  const off = entries.filter((e) => !e.active).length;
  return [
    on.length ? on.join(', ') : 'nothing carried',
    off ? `${off} off` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Toggle({
  entry,
  character,
}: {
  entry: SheetEntry;
  character: Character;
}) {
  const store = useBuilderStore();
  const temporary = isTemporary(character, entry);
  const name = entryName(character, entry);
  return (
    <div
      className={cn(
        'border-foreground/10 flex min-h-11 items-center gap-2 border px-2 md:min-h-9',
        !entry.active && 'text-muted-foreground',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={entry.active}
        aria-label={`${name} ${entry.active ? 'on' : 'off'}`}
        onClick={() => store.toggleEntryActive(character.id, entry.id)}
        className={cn(
          'relative h-5 w-9 shrink-0 border',
          entry.active ? 'border-primary bg-primary/30' : 'border-foreground/40',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3.5 transition-[left]',
            entry.active ? 'bg-primary left-[1.1rem]' : 'bg-foreground/50 left-0.5',
          )}
        />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm">
        {name}
        {temporary && (
          <Sparkles
            aria-label="temporary"
            className="ml-1 inline size-3 text-violet-300"
          />
        )}
        {entry.notes && (
          <span className="text-muted-foreground ml-1 text-xs">
            {entry.notes}
          </span>
        )}
      </span>
      {entry.state.kind === 'item' && entry.state.quantity > 1 && (
        <Chip muted>×{entry.state.quantity}</Chip>
      )}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        className="hover:text-destructive p-1"
        onClick={() => store.removeEntry(character.id, entry.id)}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function NowCardBody({ character }: { character: Character }) {
  const store = useBuilderStore();
  const entries = nowEntries(character);
  const gear = entries.filter((e) => e.kind === 'item');
  const effects = entries.filter((e) => e.kind !== 'item');
  const add = (key: string) => store.addEntry(character.id, key);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Caption className="mb-1">Gear</Caption>
          <div className="space-y-1">
            {gear.map((e) => (
              <Toggle key={e.id} entry={e} character={character} />
            ))}
            <Select value="" onValueChange={add}>
              <SelectTrigger
                className={cn(action, 'w-full border-dashed')}
                aria-label="Add gear"
              >
                <SelectValue placeholder="+ gear" />
              </SelectTrigger>
              <SelectContent>
                {catalogOfKind('item').map((i) => (
                  <SelectItem key={i.key} value={i.key}>
                    {i.name}
                    <span className="text-muted-foreground ml-1 text-xs">
                      {i.summary}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Caption className="mb-1">Spells, conditions, damage</Caption>
          <div className="space-y-1">
            {effects.map((e) => (
              <Toggle key={e.id} entry={e} character={character} />
            ))}
            <div className="flex gap-1">
              <Select value="" onValueChange={add}>
                <SelectTrigger
                  className={cn(action, 'min-w-0 flex-1 border-dashed')}
                  aria-label="Add spell or condition"
                >
                  <SelectValue placeholder="+ spell or condition" />
                </SelectTrigger>
                <SelectContent>
                  {[...catalogOfKind('spell'), ...catalogOfKind('condition')].map(
                    (i) => (
                      <SelectItem key={i.key} value={i.key}>
                        {i.name}
                        <span className="text-muted-foreground ml-1 text-xs">
                          {i.summary}
                        </span>
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Select
                value=""
                onValueChange={(v) =>
                  store.addAbilityDamage(character.id, {
                    ability: v as AbilityKey,
                    points: 2,
                  })
                }
              >
                <SelectTrigger
                  className={cn(action, 'border-dashed')}
                  aria-label="Add ability damage"
                >
                  <SelectValue placeholder="+ damage" />
                </SelectTrigger>
                <SelectContent>
                  {ABILITIES.map((a) => (
                    <SelectItem key={a} value={a}>
                      2 {ABILITY_SHORT[a]} damage
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        <Sparkles aria-hidden className="mr-1 inline size-3 text-violet-300" />
        Temporary effects colour the numbers they touch and never change the
        militia’s facts.{' '}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() =>
            effects
              .filter((e) => e.active && isTemporary(character, e))
              .forEach((e) => store.toggleEntryActive(character.id, e.id, false))
          }
        >
          End all temporary effects
        </Button>
      </p>
    </>
  );
}
