'use client';
// PROTOTYPE (throwaway, #216) — sheet variant 3: the Attack Routine editor.
// A shadcn Sheet (a side panel from `md`, a bottom sheet on phone) that
// sets a routine's name, main weapon and how it is held, off-hand weapon
// and Power Attack. Every change applies at once through
// `store.updateRoutine`; there is no Save step.

import { useSyncExternalStore } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import {
  naturalHand,
  resolveRoutine,
  routineSetups,
  statBlockText,
  weaponsOf,
  type WeaponEntry,
} from '../attacks';
import { useBuilderStore, type AttackRoutine } from '../store';
import type { Character, ResolvedSheet } from '../types';
import { formatBonus } from '../ui-helpers';
import { ActiveToggle, PickField, TextField, chip } from './shared';

// ------------------------------------------------------------ breakpoint

// `md` (768px): a side panel from there, a bottom sheet below. Without
// `matchMedia` the answer is true (the side panel).
const md = '(min-width: 768px)';
function mediaQuery() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
    ? window.matchMedia(md)
    : null;
}
function subscribe(listener: () => void) {
  const query = mediaQuery();
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
}
function useIsMd() {
  return useSyncExternalStore(
    subscribe,
    () => mediaQuery()?.matches ?? true,
    () => true,
  );
}

// --------------------------------------------------------------- helpers

/** Weapon picker options; same-named weapons are numbered ("Kukri 1", "Kukri 2"). */
function weaponOptions(weapons: WeaponEntry[]) {
  const counts = new Map<string, number>();
  for (const w of weapons)
    counts.set(w.catalog.name, (counts.get(w.catalog.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return weapons.map((w) => {
    const n = (seen.get(w.catalog.name) ?? 0) + 1;
    seen.set(w.catalog.name, n);
    return {
      value: w.entry.id,
      label:
        (counts.get(w.catalog.name) ?? 0) > 1
          ? `${w.catalog.name} ${n}`
          : w.catalog.name,
    };
  });
}

const canPair = (w: WeaponEntry) =>
  w.weapon.handedness === 'light' || w.weapon.handedness === 'oneHanded';

const label =
  'text-muted-foreground font-mono text-[11px] tracking-wide uppercase';
const hint = 'text-muted-foreground text-xs';
const segment =
  'min-h-11 flex-1 px-2 font-mono text-sm md:min-h-9 hover:bg-foreground/10';

// ---------------------------------------------------------------- editor

export function RoutineEditor({
  character,
  sheet,
  routineId,
  onClose,
  onRemove,
}: {
  character: Character;
  sheet: ResolvedSheet;
  routineId: string;
  onClose: () => void;
  onRemove: () => void;
}) {
  const store = useBuilderStore();
  const isMd = useIsMd();
  const entry = character.entries.find((e) => e.id === routineId);
  const setup = routineSetups(character).find((s) => s.id === routineId);
  if (entry?.state.kind !== 'attackRoutine' || !setup) return null;
  const routine = entry.state;
  const weapons = weaponsOf(character);
  const options = weaponOptions(weapons);
  const main = weapons.find((w) => w.entry.id === routine.main.entryId);
  const mainPairs = main ? canPair(main) : false;
  const offIds = new Set(
    weapons
      .filter((w) => canPair(w) && w.entry.id !== routine.main.entryId)
      .map((w) => w.entry.id),
  );
  const offOptions = options.filter((o) => offIds.has(o.value));
  const hasPowerAttack = character.entries.some(
    (e) => e.active && e.catalogKey === 'feat.powerAttack',
  );
  const preview = resolveRoutine(character, sheet, setup);
  const patch = (p: Partial<AttackRoutine>) =>
    store.updateRoutine(character.id, routineId, p);

  const setMain = (entryId: string | null) => {
    const w = weapons.find((x) => x.entry.id === entryId);
    if (!w) return;
    patch({
      main: { entryId: w.entry.id, hand: naturalHand(w.weapon) },
      // The off hand needs a one-handed or light main weapon, and not the same one.
      ...(routine.off && (!canPair(w) || routine.off.entryId === w.entry.id)
        ? { off: undefined }
        : {}),
    });
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side={isMd ? 'right' : 'bottom'}
        aria-describedby={undefined}
        className={cn(
          'gap-0 overflow-y-auto',
          isMd ? 'w-full sm:max-w-md' : 'max-h-[85vh]',
        )}
      >
        <SheetHeader>
          <SheetTitle className="font-sans text-xl font-normal">
            Attack routine
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
          <label className="flex flex-col gap-0.5">
            <span className={label}>Name</span>
            <TextField
              ariaLabel="Routine name"
              value={routine.name}
              onChange={(v) => patch({ name: v })}
              className="w-full font-sans"
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={label}>Main weapon</span>
            <PickField
              ariaLabel="Main weapon"
              value={main ? routine.main.entryId : null}
              placeholder={
                main ? '—' : 'no longer on the sheet: choose a weapon'
              }
              options={options}
              onChange={setMain}
              className="w-full"
            />
            {!main && (
              <span className={cn(hint, 'text-amber-300')}>
                Its weapon is no longer under Gear, or is switched off.
              </span>
            )}
          </label>

          {main && !routine.off && mainPairs && (
            <div className="flex flex-col gap-0.5">
              <span className={label}>Held in</span>
              <div
                role="radiogroup"
                aria-label="Held in"
                className="border-foreground/40 flex border"
              >
                {(
                  [
                    ['twoHands', 'Two hands'],
                    ['oneHand', 'One hand'],
                  ] as const
                ).map(([hand, text]) => (
                  <button
                    key={hand}
                    type="button"
                    role="radio"
                    aria-checked={routine.main.hand === hand}
                    onClick={() =>
                      patch({ main: { entryId: routine.main.entryId, hand } })
                    }
                    className={cn(
                      segment,
                      routine.main.hand === hand
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {text}
                  </button>
                ))}
              </div>
              {main.weapon.handedness === 'light' && (
                <span className={hint}>
                  A light weapon in two hands still adds Strength once.
                </span>
              )}
            </div>
          )}
          {main?.weapon.handedness === 'twoHanded' && (
            <p className={hint}>{main.catalog.name} is two-handed.</p>
          )}
          {main?.weapon.handedness === 'ranged' && (
            <p className={hint}>{main.catalog.name} is a ranged weapon.</p>
          )}

          <label className="flex flex-col gap-0.5">
            <span className={label}>Off hand</span>
            <PickField
              ariaLabel="Off-hand weapon"
              value={routine.off?.entryId ?? null}
              placeholder="None"
              options={offOptions}
              onChange={(v) => patch({ off: v ? { entryId: v } : undefined })}
              className={cn('w-full', !mainPairs && 'opacity-50')}
            />
            <span className={hint}>
              {!mainPairs
                ? 'Two-weapon fighting needs a one-handed or light main weapon.'
                : offOptions.length === 0
                  ? 'No other one-handed or light weapon under Gear.'
                  : 'Two-weapon fighting: the main weapon becomes the primary hand.'}
            </span>
          </label>

          <div className="flex flex-col gap-0.5">
            <span className={label}>Options</span>
            <label className="flex min-h-11 items-center gap-2 md:min-h-9">
              <ActiveToggle
                active={routine.options.powerAttack}
                label="Power Attack"
                onChange={(v) => patch({ options: { powerAttack: v } })}
              />
              <span className="text-sm">Power Attack</span>
              {!hasPowerAttack && (
                <span className={cn(hint, 'text-amber-300')}>
                  the feat isn’t on the sheet
                </span>
              )}
            </label>
          </div>

          <div className="border-foreground/15 border-t pt-3">
            <p className={label}>As it attacks now</p>
            {preview.single ? (
              <>
                <p className="text-sm">
                  <span className="text-muted-foreground">Single attack </span>
                  <span className="font-mono">
                    {formatBonus(preview.single.bonus.total)} (
                    {preview.single.damage.text}/{preview.single.critical.text})
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Full attack </span>
                  <span className="font-mono">{statBlockText(preview)}</span>
                </p>
              </>
            ) : (
              <p className={cn(hint, 'text-amber-300')}>{preview.notes[0]}</p>
            )}
            {preview.penalties.map((p) => (
              <p key={p} className={hint}>
                {p}
              </p>
            ))}
            {preview.notes.length > 0 && preview.single && (
              <p className={cn(hint, 'text-amber-300')}>
                {preview.notes.join(' ')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onRemove}
              className={cn(
                chip,
                'hover:text-destructive hover:border-destructive min-h-11 md:min-h-9',
              )}
            >
              Remove routine
            </button>
            <Button
              variant="outline"
              className="min-h-11 rounded-none font-sans md:min-h-9"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
