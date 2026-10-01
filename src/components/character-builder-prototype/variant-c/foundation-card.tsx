'use client';
// PROTOTYPE (throwaway, #208) — Variant C "Foundation" card: who the
// character is before any level — race, base scores (point buy), traits,
// and the presentation (Militia-only or Full).

import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import {
  ABILITY_LABEL,
  ABILITY_SHORT,
  CLASSES,
  POINT_BUY_COST,
  RACES,
  catalogOfKind,
} from '../catalog';
import {
  baseScores,
  entryName,
  pointBuyCost,
  raceCatalog,
  useBuilderStore,
} from '../store';
import {
  ABILITIES,
  type AbilityKey,
  type Character,
  type ResolvedSheet,
} from '../types';
import { formatBonus, modOf } from '../ui-helpers';
import { Caption, Chip, Stepper, action } from './bits';

const NONE = '__none';

export function foundationSummary(character: Character) {
  const race = raceCatalog(character);
  const scores = baseScores(character);
  const traits = character.entries
    .filter((e) => e.kind === 'trait')
    .map((e) => entryName(character, e));
  return [
    race?.catalog.name ?? 'No race',
    ABILITIES.map((a) => `${ABILITY_SHORT[a]} ${scores[a]}`).join(' '),
    `${pointBuyCost(scores).total} pts`,
    traits.length ? traits.join(', ') : 'no traits',
  ].join(' · ');
}

export function FoundationCardBody({
  character,
  sheet,
  hasMilitia,
}: {
  character: Character;
  sheet: ResolvedSheet;
  hasMilitia: boolean;
}) {
  const store = useBuilderStore();
  const id = character.id;
  const race = raceCatalog(character);
  const scores = baseScores(character);
  const cost = pointBuyCost(scores);
  const budget = store.state.pointBuyBudget;
  const traits = character.entries.filter((e) => e.kind === 'trait');
  const allTraits = catalogOfKind('trait');

  return (
    <>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="block">
          <Caption>Name</Caption>
          <Input
            value={character.name}
            onChange={(e) => store.setName(id, e.target.value)}
            className={cn(action, 'font-sans')}
          />
        </label>
        <label className="block">
          <Caption>Kind</Caption>
          <Select
            value={character.kind}
            onValueChange={(v) =>
              store.updateCharacter(id, { kind: v as Character['kind'] })
            }
          >
            <SelectTrigger className={cn(action, 'w-28')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pc">PC</SelectItem>
              <SelectItem value="npc">NPC</SelectItem>
            </SelectContent>
          </Select>
        </label>
        {hasMilitia && (
          <label className="block">
            <Caption>Presentation</Caption>
            <Select
              value={character.sheetMode}
              onValueChange={(v) =>
                store.setSheetMode(id, v as Character['sheetMode'])
              }
            >
              <SelectTrigger className={cn(action, 'w-40')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Character</SelectItem>
                <SelectItem value="militiaOnly">Militia-only</SelectItem>
              </SelectContent>
            </Select>
          </label>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <Caption>Race</Caption>
          <Select
            value={race?.catalog.key ?? NONE}
            onValueChange={(v) => store.setRace(id, v === NONE ? null : v)}
          >
            <SelectTrigger className={cn(action, 'w-full')}>
              <SelectValue placeholder="Choose a race" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No race</SelectItem>
              {RACES.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.name}
                  <span className="text-muted-foreground ml-1 text-xs">
                    {r.summary}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {race?.detail.chooseAbility && (
          <label className="block">
            <Caption>{race.catalog.name} +2 to</Caption>
            <Select
              value={
                race.entry.state.kind === 'race'
                  ? (race.entry.state.abilityChoice ?? NONE)
                  : NONE
              }
              onValueChange={(v) =>
                store.setRace(id, race.catalog.key, {
                  abilityChoice: v === NONE ? null : (v as AbilityKey),
                })
              }
            >
              <SelectTrigger className={cn(action, 'w-full')}>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not chosen</SelectItem>
                {ABILITIES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ABILITY_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        {race && (
          <label className="block">
            <Caption>Favored class</Caption>
            <Select
              value={
                race.entry.state.kind === 'race'
                  ? (race.entry.state.favoredClass ?? NONE)
                  : NONE
              }
              onValueChange={(v) =>
                store.setRace(id, race.catalog.key, {
                  favoredClass: v === NONE ? null : v,
                })
              }
            >
              <SelectTrigger className={cn(action, 'w-full')}>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not chosen</SelectItem>
                {CLASSES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>
      {race && (
        <ul className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {race.detail.traitsText.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <Caption>Base scores · point buy</Caption>
          <span
            className={cn(
              'font-mono text-sm',
              cost.total !== budget && 'text-amber-300',
            )}
          >
            {cost.total} of {budget} points
          </span>
        </div>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {ABILITIES.map((a) => {
            const c = POINT_BUY_COST[scores[a]];
            const total = sheet.abilities[a].total;
            return (
              <div
                key={a}
                className="border-foreground/10 flex items-center gap-2 border p-1"
              >
                <span className="w-9 shrink-0 font-sans text-sm">
                  {ABILITY_SHORT[a]}
                </span>
                <Stepper
                  label={`${ABILITY_LABEL[a]} base score`}
                  value={scores[a]}
                  onChange={(v) => store.setBaseScore(id, a, v ?? 10)}
                />
                <span className="text-muted-foreground min-w-0 flex-1 font-mono text-xs">
                  {c === undefined ? 'off table' : `${c} pt`}
                  {total !== scores[a] && (
                    <>
                      {' '}
                      → <span className="text-foreground">{total}</span>
                    </>
                  )}{' '}
                  ({formatBonus(modOf(total))})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Caption className="mb-1">Traits</Caption>
        <div className="flex flex-wrap items-center gap-1">
          {traits.map((t) => (
            <Chip key={t.id} className="gap-1 pr-0.5">
              {entryName(character, t)}
              <button
                type="button"
                aria-label={`Remove ${entryName(character, t)}`}
                className="hover:text-destructive p-0.5"
                onClick={() => store.removeEntry(id, t.id)}
              >
                <X className="size-3" />
              </button>
            </Chip>
          ))}
          <Select
            value=""
            onValueChange={(v) => store.addEntry(id, v)}
          >
            <SelectTrigger
              className={cn(action, 'h-auto w-auto border-dashed')}
              aria-label="Add trait"
            >
              <SelectValue placeholder={traits.length ? '+ trait' : '+ add a trait'} />
            </SelectTrigger>
            <SelectContent>
              {allTraits.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.name}
                  <span className="text-muted-foreground ml-1 text-xs">
                    {t.summary}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="block">
        <Caption>Notes</Caption>
        <Input
          value={character.description}
          onChange={(e) =>
            store.updateCharacter(id, { description: e.target.value })
          }
          className={action}
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => {
          /* Everything on this card is already live; this just scrolls on. */
          document
            .getElementById('timeline-levels')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        Down to the levels ↓
      </Button>
    </>
  );
}
