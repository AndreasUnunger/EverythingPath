'use client';
// PROTOTYPE (throwaway, #208) — Variant B: the skills table. Totals tap
// for their breakdown; ranks are spent in place for the Class Level chosen
// in the header (the level being built, by default).

import { Minus, Plus } from 'lucide-react';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT, SKILLS } from '../catalog';
import {
  classLevelShortLabel,
  classLevels,
  skillRankBudget,
  useBuilderStore,
} from '../store';
import type { Character, ResolvedSheet, SkillKey } from '../types';
import { formatBonus } from '../ui-helpers';
import type { Warning } from '../warnings';
import {
  Block,
  FieldWarnings,
  PickField,
  StatButton,
  chip,
  th,
  useSheetUi,
} from './shared';

export function SkillsTable({
  character,
  sheet,
  warnings,
}: {
  character: Character;
  sheet: ResolvedSheet;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  const ui = useSheetUi();
  const levels = classLevels(character);
  const level =
    levels.find((l) => l.id === ui.ranksLevelId) ?? levels.at(-1) ?? null;
  const budget = level ? skillRankBudget(character, level.id) : null;
  const ranksHere = (key: SkillKey) => level?.state.skillRanks[key] ?? 0;
  const bump = (key: SkillKey, delta: number) => {
    if (!level) return;
    const next = Math.max(0, ranksHere(key) + delta);
    const skillRanks = { ...level.state.skillRanks, [key]: next };
    if (next === 0) delete skillRanks[key];
    store.updateClassLevel(character.id, level.id, { skillRanks });
  };
  const left = budget ? budget.total - budget.spent : 0;
  const todo = !!budget && left > 0 && ui.focusLevelId === level?.id;

  const header = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <label className="text-muted-foreground flex items-center gap-1.5">
        ranks for
        <PickField
          ariaLabel="Class Level whose ranks are being spent"
          value={level?.id ?? null}
          options={levels.map((l) => ({
            value: l.id,
            label: `${l.state.position} · ${classLevelShortLabel(character, l.id)}`,
          }))}
          onChange={(v) => ui.setRanksLevelId(v)}
          className="w-40"
        />
      </label>
      {budget ? (
        <span
          className={cn(
            'flex items-center gap-2 font-mono',
            todo && 'text-sky-300',
          )}
          title={budget.parts.map((p) => `${p.label} ${p.value}`).join(' · ')}
        >
          <span className="bg-foreground/10 relative h-2 w-24 overflow-hidden">
            <span
              className={cn(
                'absolute inset-y-0 left-0',
                left < 0 ? 'bg-amber-400' : 'bg-primary',
              )}
              style={{
                width: `${Math.min(100, (budget.spent / Math.max(1, budget.total)) * 100)}%`,
              }}
            />
          </span>
          {budget.spent}/{budget.total} spent
          {left > 0 && <span>· {left} left</span>}
          {left < 0 && <span className="text-amber-300">· {-left} over</span>}
        </span>
      ) : (
        level && (
          <span className="text-muted-foreground">
            Unspecified level: choose a class to get ranks
          </span>
        )
      )}
    </div>
  );

  return (
    <Block id="b-skills" title="Skills" aside={header}>
      <FieldWarnings
        warnings={warnings}
        where="skills"
        characterId={character.id}
        className="mb-1"
      />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-foreground/20 border-b">
            <th className={cn(th, 'px-1 md:px-2')}>Skill</th>
            <th className={cn(th, 'text-right')}>Total</th>
            <th className={th}>Ranks</th>
            <th className={cn(th, 'hidden lg:table-cell')}>Ability</th>
            <th className={cn(th, 'hidden md:table-cell')}>Class</th>
          </tr>
        </thead>
        <tbody>
          {SKILLS.map((info) => {
            const stat = sheet.skills[info.key];
            const here = ranksHere(info.key);
            return (
              <tr
                key={info.key}
                className={cn(
                  'border-foreground/10 border-b',
                  !stat.usable && 'text-muted-foreground',
                )}
              >
                <td className="px-1 py-0.5 md:px-2">
                  {info.name}
                  {info.trainedOnly && (
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {' '}
                      *
                    </span>
                  )}
                  <span className="text-muted-foreground ml-1 font-mono text-[11px] lg:hidden">
                    {ABILITY_SHORT[info.ability]}
                    {stat.classSkill ? ' · c' : ''}
                  </span>
                </td>
                <td className="px-1 py-0.5 text-right md:px-2">
                  <StatButton
                    path={`skills.${info.key}`}
                    sheet={sheet}
                    title={info.name}
                    signed
                    size="sm"
                  />
                </td>
                <td className="px-1 py-0.5 md:px-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-5 text-right font-mono">
                      {stat.ranks}
                    </span>
                    {level && (
                      <span
                        className={cn(
                          'inline-flex items-center border',
                          here > 0
                            ? 'border-primary/60'
                            : 'border-foreground/20',
                          todo && 'border-sky-400/60',
                        )}
                      >
                        <button
                          type="button"
                          aria-label={`Remove a rank in ${info.name}`}
                          onClick={() => bump(info.key, -1)}
                          className="hover:bg-foreground/10 flex size-7 items-center justify-center disabled:opacity-30"
                          disabled={here === 0}
                        >
                          <Minus className="size-3" />
                        </button>
                        <span
                          className={cn(
                            'w-5 text-center font-mono text-xs',
                            here > 0 ? 'text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {here > 0 ? `+${here}` : '·'}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add a rank in ${info.name}`}
                          onClick={() => bump(info.key, 1)}
                          className="hover:bg-foreground/10 flex size-7 items-center justify-center"
                        >
                          <Plus className="size-3" />
                        </button>
                      </span>
                    )}
                  </span>
                </td>
                <td className="hidden px-2 py-0.5 font-mono lg:table-cell">
                  {ABILITY_SHORT[info.ability]}{' '}
                  {formatBonus(sheet.abilityMods[info.ability].total)}
                </td>
                <td className="hidden px-2 py-0.5 md:table-cell">
                  {stat.classSkill && (
                    <span
                      className={cn(chip, 'border-primary/60 text-primary')}
                    >
                      class
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-muted-foreground mt-1 text-[11px]">
        * trained only · the stepper spends ranks for the level chosen above;
        the left number is the total across levels.
      </p>
    </Block>
  );
}
