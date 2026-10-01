'use client';
// PROTOTYPE (throwaway, #208) — Variant B: the "to do" checklist that drives
// a level-up or a new sheet without ordering or locking anything, and the
// compact issues drawer listing every advisory warning with a jump.

import { CircleCheck, Circle, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import {
  baseScores,
  classLevelShortLabel,
  classLevels,
  favoredClass,
  featSlots,
  featuresGainedAt,
  pointBuyCost,
  raceCatalog,
  skillRankBudget,
  useBuilderStore,
} from '../store';
import type { Character } from '../types';
import { SEVERITY_CLASS } from '../ui-helpers';
import type { Warning } from '../warnings';
import { levelTodos } from './levels-table';
import { jumpTo, type SheetMode } from './shared';

export type Todo = {
  id: string;
  label: string;
  target: string;
  /** A warning's one-click fix, offered as a button (never applied for you). */
  action?: Warning['action'];
};

/** The element a warning's `where` points at (table row, or its phone card). */
export function jumpWhere(where: string) {
  if (where.startsWith('classLevel:')) {
    const id = where.slice('classLevel:'.length);
    const row = document.getElementById(`b-level-${id}`);
    jumpTo(row && row.offsetParent !== null ? row.id : `b-level-${id}-card`);
    return;
  }
  if (where.startsWith('entry:')) {
    const id = `b-entry-${where.slice('entry:'.length)}`;
    if (document.getElementById(id)) return jumpTo(id);
    return jumpTo('b-feats');
  }
  const map: Record<string, string> = {
    abilities: 'b-abilities',
    race: 'b-identity',
    level: 'b-levels',
    skills: 'b-skills',
    feats: 'b-feats',
    features: 'b-features',
    sheet: 'b-identity',
  };
  jumpTo(map[where] ?? 'b-identity');
}

/** Open decisions, per level and for the sheet as a whole. */
export function openTodos(
  character: Character,
  mode: SheetMode,
  focusLevelId: string | null,
  pointBuyBudget: number,
  warnings: Warning[],
): Todo[] {
  const out: Todo[] = [];
  const levels = classLevels(character);
  const scope =
    mode === 'levelup' ? levels.filter((l) => l.id === focusLevelId) : levels;
  const whole = mode !== 'levelup';

  if (whole) {
    if (!character.name.trim() || character.name === 'New character')
      out.push({ id: 'name', label: 'Name', target: 'b-identity' });
    const race = raceCatalog(character);
    if (!race)
      out.push({ id: 'race', label: 'Choose race', target: 'b-identity' });
    else if (
      race.detail.chooseAbility &&
      race.entry.state.kind === 'race' &&
      !race.entry.state.abilityChoice
    )
      out.push({
        id: 'race-ability',
        label: `${race.catalog.name}: +2 to which ability?`,
        target: 'b-identity',
      });
    const cost = pointBuyCost(baseScores(character));
    if (cost.outOfRange.length > 0 || cost.total !== pointBuyBudget)
      out.push({
        id: 'pointbuy',
        label: `Spend point buy (${cost.total} of ${pointBuyBudget})`,
        target: 'b-abilities',
      });
    if (
      race &&
      !favoredClass(character) &&
      levels.some((l) => l.state.classKey)
    )
      out.push({ id: 'favored', label: 'Favored class', target: 'b-identity' });
  }

  for (const l of scope) {
    const t = levelTodos(character, l.id);
    const label = l.state.classKey
      ? `${classLevelShortLabel(character, l.id)} (level ${l.state.position})`
      : `level ${l.state.position}`;
    const target = `b-level-${l.id}`;
    if (t.cls)
      out.push({
        id: `${l.id}-cls`,
        label: `Choose class for ${label}`,
        target,
      });
    if (t.hp)
      out.push({ id: `${l.id}-hp`, label: `Hit points, ${label}`, target });
    if (t.fcb)
      out.push({
        id: `${l.id}-fcb`,
        label: `Favored class bonus, ${label}`,
        target,
      });
    if (t.inc)
      out.push({
        id: `${l.id}-inc`,
        label: `Ability score increase (level ${l.state.position})`,
        target,
      });
    if (t.ranks) {
      const b = skillRankBudget(character, l.id)!;
      out.push({
        id: `${l.id}-ranks`,
        label: `Spend ${b.total - b.spent} of ${b.total} skill ranks, ${label}`,
        target: 'b-skills',
      });
    }
    for (const pick of t.picks)
      out.push({
        id: `${l.id}-pick-${pick}`,
        label: `Pick a ${pick.toLowerCase()}, ${label}`,
        target: 'b-features',
      });
    const gained = featuresGainedAt(character, l.id);
    if (gained.generalFeat && !gained.gainedHere.some((e) => e.kind === 'feat'))
      out.push({
        id: `${l.id}-feat`,
        label: `Feat for level ${l.state.position}`,
        target: 'b-feats',
      });
  }

  if (whole) {
    const slots = featSlots(character);
    if (
      slots.taken < slots.slots.length &&
      !out.some((t) => t.id.endsWith('-feat'))
    )
      out.push({
        id: 'feats',
        label: `Feats (${slots.slots.length - slots.taken} open)`,
        target: 'b-feats',
      });
    if (!character.entries.some((e) => e.kind === 'trait'))
      out.push({ id: 'traits', label: 'Traits (optional)', target: 'b-feats' });
  }

  for (const w of warnings)
    if (w.action)
      out.push({
        id: `warn-${w.id}`,
        label: w.message,
        target: w.where === 'features' ? 'b-features' : 'b-feats',
        action: w.action,
      });

  return out;
}

/** Renders the open items plus the ones ticked off since the panel mounted. */
export function TodoPanel({
  title,
  todos,
  characterId,
  actions,
  className,
}: {
  title: string;
  todos: Todo[];
  characterId: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const store = useBuilderStore();
  const [seen, setSeen] = useState<Map<string, string>>(() => new Map());
  const openIds = new Set(todos.map((t) => t.id));
  const missing = todos.filter((t) => !seen.has(t.id));
  if (missing.length > 0)
    setSeen(
      (prev) =>
        new Map([...prev, ...missing.map((t) => [t.id, t.label] as const)]),
    );
  const done = [...seen].filter(([id]) => !openIds.has(id));
  return (
    <div
      className={cn(
        'border border-sky-400/50 bg-sky-400/5 p-2 text-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-sans">{title}</span>
        <span className="font-mono text-xs text-sky-300">
          {todos.length} to do
          {done.length > 0 && ` · ${done.length} done`}
        </span>
        <span className="ml-auto flex items-center gap-2">{actions}</span>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {todos.map((t) => (
          <li key={t.id} className="inline-flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => jumpTo(t.target)}
              className="hover:bg-foreground/10 inline-flex min-h-8 items-center gap-1.5 px-1 text-left text-sky-200"
            >
              <Circle className="size-3.5 shrink-0" />
              {t.label}
            </button>
            {t.action && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-sky-400/60 px-2 text-xs text-sky-200"
                onClick={() =>
                  store.addEntry(characterId, t.action!.catalogKey, {
                    gainedAtClassLevel: t.action!.gainedAtClassLevel,
                  })
                }
              >
                {t.action.label}
              </Button>
            )}
          </li>
        ))}
        {done.map(([id, label]) => (
          <li
            key={id}
            className="text-muted-foreground inline-flex min-h-8 items-center gap-1.5 px-1 line-through"
          >
            <CircleCheck className="size-3.5 shrink-0" />
            {label}
          </li>
        ))}
        {todos.length === 0 && (
          <li className="text-muted-foreground inline-flex min-h-8 items-center px-1">
            Nothing left to decide.
          </li>
        )}
      </ul>
    </div>
  );
}

/** "N issues" with the drawer listing them. */
export function IssuesButton({
  warnings,
  characterId,
}: {
  warnings: Warning[];
  characterId: string;
}) {
  const store = useBuilderStore();
  const [open, setOpen] = useState(false);
  const counts = {
    warning: warnings.filter((w) => w.severity === 'warning').length,
    prompt: warnings.filter((w) => w.severity === 'prompt').length,
    info: warnings.filter((w) => w.severity === 'info').length,
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          'min-h-11 gap-1.5 font-mono md:min-h-9',
          counts.warning > 0 && 'border-amber-500/60 text-amber-300',
          counts.warning === 0 &&
            counts.prompt > 0 &&
            'border-sky-400/60 text-sky-300',
        )}
      >
        {counts.warning > 0 && <TriangleAlert className="size-4" />}
        {warnings.length === 0 ? 'No issues' : `${warnings.length} issues`}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle className="font-sans">Issues</SheetTitle>
            <SheetDescription>
              Advisory only: every value stays as entered. Tap one to jump to
              its field.
            </SheetDescription>
          </SheetHeader>
          <ul className="divide-foreground/10 divide-y px-4 pb-4">
            {warnings.map((w) => (
              <li key={w.id} className="py-2">
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-start gap-2 text-left text-sm',
                    SEVERITY_CLASS[w.severity],
                  )}
                  onClick={() => {
                    setOpen(false);
                    window.setTimeout(() => jumpWhere(w.where), 350);
                  }}
                >
                  {w.severity === 'warning' ? (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>{w.message}</span>
                </button>
                {w.action && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 ml-6 h-7 text-xs"
                    onClick={() =>
                      store.addEntry(characterId, w.action!.catalogKey, {
                        gainedAtClassLevel: w.action!.gainedAtClassLevel,
                      })
                    }
                  >
                    {w.action.label}
                  </Button>
                )}
              </li>
            ))}
            {warnings.length === 0 && (
              <li className="text-muted-foreground py-2 text-sm">
                Nothing to flag.
              </li>
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
