'use client';
// PROTOTYPE (throwaway, #208) — Variant B: the Class Levels strip. Every
// level's class, hit points, favored class bonus, ability increase and
// ranks are edited in place; levels move and delete from anywhere. Hit
// points are a plain number the player types (the hit die is only a hint).

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  ABILITY_SHORT,
  CLASSES,
  classDetail,
  catalogForGroup,
} from '../catalog';
import { useProtoNav } from '../nav';
import {
  advanceChoices,
  spellcastingsOf,
  type AdvanceChoice,
} from '../spellcasting';
import {
  classLevelShortLabel,
  classLevels,
  entryName,
  favoredClass,
  featuresGainedAt,
  skillRankBudget,
  useBuilderStore,
} from '../store';
import type { AbilityKey, Character, FeatureGroup } from '../types';
import type { Warning } from '../warnings';
import {
  Block,
  FieldWarnings,
  NumField,
  PickField,
  TextField,
  chip,
  jumpTo,
  th,
  useSheetUi,
} from './shared';

const ABILITY_OPTIONS = (
  ['str', 'dex', 'con', 'int', 'wis', 'cha'] as AbilityKey[]
).map((a) => ({ value: a, label: `+1 ${ABILITY_SHORT[a]}` }));

const CLASS_OPTIONS = CLASSES.map((c) => ({ value: c.key, label: c.name }));

type FcbChoice = 'hp' | 'skill' | 'alt';

function useLevelRow(character: Character, levelId: string) {
  const level = classLevels(character).find((l) => l.id === levelId)!;
  const detail = classDetail(level.state.classKey);
  const favored = favoredClass(character);
  const gained = featuresGainedAt(character, levelId);
  const budget = skillRankBudget(character, levelId);
  return { level, detail, favored, gained, budget };
}

/** The hp cell: the number the player typed, with the hit die as a hint. */
function HpCell({
  character,
  levelId,
  todo,
}: {
  character: Character;
  levelId: string;
  todo: boolean;
}) {
  const store = useBuilderStore();
  const { level, detail } = useLevelRow(character, levelId);
  const hitDie = detail?.hitDie ?? null;
  return (
    <div className="flex flex-nowrap items-center gap-1">
      <NumField
        ariaLabel={`Hit points gained at level ${level.state.position}`}
        value={level.state.hpGained}
        onChange={(hp) =>
          store.updateClassLevel(character.id, levelId, { hpGained: hp })
        }
        todo={todo}
        width="w-14"
        placeholder={hitDie ? `d${hitDie}` : '—'}
      />
      {hitDie && (
        <span className="text-muted-foreground font-mono text-xs">
          d{hitDie}
        </span>
      )}
    </div>
  );
}

function FcbCell({
  character,
  levelId,
  todo,
}: {
  character: Character;
  levelId: string;
  todo: boolean;
}) {
  const store = useBuilderStore();
  const { level, detail, favored } = useLevelRow(character, levelId);
  const fcb = level.state.favoredClassBonus;
  const expected = !!level.state.classKey && level.state.classKey === favored;
  const options: { value: FcbChoice; label: string }[] = [
    { value: 'hp', label: '+1 hp' },
    { value: 'skill', label: '+1 skill rank' },
    { value: 'alt', label: 'Other…' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1">
      <PickField
        ariaLabel={`Favored class bonus at level ${level.state.position}`}
        value={fcb?.choice ?? null}
        placeholder={expected ? 'choose' : '—'}
        options={options}
        todo={todo}
        className={cn('w-[7.5rem]', !expected && !fcb && 'opacity-60')}
        onChange={(v) =>
          store.updateClassLevel(character.id, levelId, {
            favoredClassBonus:
              v === null
                ? null
                : v === 'alt'
                  ? { choice: 'alt', note: detail?.favoredClassAlt ?? '' }
                  : { choice: v },
          })
        }
      />
      {fcb?.choice === 'alt' && (
        <TextField
          ariaLabel="Alternative favored class bonus"
          value={fcb.note}
          placeholder="e.g. +1 round of rage"
          className="w-36 text-xs"
          onChange={(note) =>
            store.updateClassLevel(character.id, levelId, {
              favoredClassBonus: { choice: 'alt', note },
            })
          }
        />
      )}
    </div>
  );
}

function RanksCell({
  character,
  levelId,
  todo,
}: {
  character: Character;
  levelId: string;
  todo: boolean;
}) {
  const ui = useSheetUi();
  const { budget } = useLevelRow(character, levelId);
  if (!budget) return <span className="text-muted-foreground">—</span>;
  const left = budget.total - budget.spent;
  return (
    <button
      type="button"
      onClick={() => {
        ui.setRanksLevelId(levelId);
        jumpTo('b-skills');
      }}
      title="Spend this level's ranks in the skills table"
      className={cn(
        'hover:bg-foreground/10 inline-flex min-h-8 items-center gap-1.5 border border-dotted px-1.5 font-mono',
        ui.ranksLevelId === levelId
          ? 'border-primary text-primary'
          : 'border-foreground/40',
        todo && 'ring-2 ring-sky-400/80',
      )}
    >
      {budget.spent}/{budget.total}
      {left !== 0 && (
        <span
          className={cn(
            'text-xs',
            left > 0 ? 'text-sky-300' : 'text-amber-300',
          )}
        >
          {left > 0 ? `${left} left` : `${-left} over`}
        </span>
      )}
    </button>
  );
}

const ADVANCE_LABEL: Record<AdvanceChoice['kind'], string> = {
  any: 'advance',
  arcane: 'arcane',
  divine: 'divine',
};

/**
 * PROTOTYPE (#233): a prestige Class Level's "+1 level of existing
 * spellcasting class" advances, one select each. Null for other levels.
 */
function AdvancesCell({
  character,
  levelId,
  className,
}: {
  character: Character;
  levelId: string;
  className?: string;
}) {
  const store = useBuilderStore();
  const choices = advanceChoices(character, levelId);
  if (choices.length === 0) return null;
  const spellKindOf = (classKey: string) =>
    spellcastingsOf(character).find((s) => s.classKey === classKey)?.casting
      .spellKind;
  const hint = (choice: AdvanceChoice, classKey: string) => {
    const kind = spellKindOf(classKey);
    if (choice.kind !== 'any' && kind && kind !== choice.kind)
      return ` — not ${choice.kind}`;
    return ' — taken later';
  };
  return (
    <div
      className={cn('space-y-1', className)}
      title="Each advance adds a level to that class's spellcasting: caster level, spells per day and spells known."
    >
      {choices.map((c) => (
        <div key={c.index} className="flex items-center gap-1.5">
          <span className="text-muted-foreground w-[3.75rem] shrink-0 font-mono text-xs">
            {ADVANCE_LABEL[c.kind]} →
          </span>
          <PickField
            ariaLabel={`${ADVANCE_LABEL[c.kind]} spellcasting advance`}
            value={c.value}
            placeholder="choose"
            todo={c.value === null}
            options={c.options.map((o) => ({
              value: o.classKey,
              label: o.matches ? o.name : `${o.name}${hint(c, o.classKey)}`,
            }))}
            className="w-32"
            onChange={(v) =>
              store.setCastingAdvance(character.id, levelId, c.index, v)
            }
          />
        </div>
      ))}
    </div>
  );
}

function GainedCell({
  character,
  levelId,
}: {
  character: Character;
  levelId: string;
}) {
  const { gained } = useLevelRow(character, levelId);
  const picksOpen = gained.features.filter(
    (f) => f.kind === 'choice' && f.picked.length < (f.grant.count ?? 1),
  );
  const featOpen =
    gained.generalFeat && !gained.gainedHere.some((e) => e.kind === 'feat');
  return (
    <div className="flex flex-wrap gap-1">
      {gained.gainedHere.map((e) => (
        <span
          key={e.id}
          className={cn(chip, e.kind === 'feat' && 'border-primary/60')}
        >
          {entryName(character, e)}
        </span>
      ))}
      {picksOpen.map((f) => (
        <button
          key={f.kind === 'choice' ? f.grant.choose : ''}
          type="button"
          onClick={() => jumpTo('b-features')}
          className={cn(
            chip,
            'border-sky-400/70 text-sky-300 hover:bg-sky-400/10',
          )}
        >
          pick: {f.kind === 'choice' ? f.grant.label.toLowerCase() : ''}
        </button>
      ))}
      {featOpen && (
        <button
          type="button"
          onClick={() => jumpTo('b-feats')}
          className={cn(
            chip,
            'border-sky-400/70 text-sky-300 hover:bg-sky-400/10',
          )}
        >
          pick: feat
        </button>
      )}
    </div>
  );
}

function LevelActions({
  character,
  levelId,
  confirming,
  setConfirming,
}: {
  character: Character;
  levelId: string;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
}) {
  const store = useBuilderStore();
  const levels = classLevels(character);
  const level = levels.find((l) => l.id === levelId)!;
  const pos = level.state.position;
  const label = classLevelShortLabel(character, levelId);
  if (confirming)
    return (
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span>
          Delete {label} (level {pos})
          {level.state.classKey ? ' and what it granted?' : '?'}
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="h-7"
          onClick={() => {
            store.removeClassLevel(character.id, levelId);
            setConfirming(false);
          }}
        >
          Delete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          onClick={() => setConfirming(false)}
        >
          Keep
        </Button>
      </div>
    );
  return (
    <div className="flex items-center">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Move up"
        disabled={pos === 1}
        onClick={() => store.moveClassLevel(character.id, levelId, pos - 1)}
      >
        <ArrowUp />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Move down"
        disabled={pos === levels.length}
        onClick={() => store.moveClassLevel(character.id, levelId, pos + 1)}
      >
        <ArrowDown />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Delete level"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/** What the level still needs — drives the highlight rings. */
export function levelTodos(character: Character, levelId: string) {
  const level = classLevels(character).find((l) => l.id === levelId);
  if (!level)
    return {
      cls: false,
      hp: false,
      fcb: false,
      inc: false,
      ranks: false,
      picks: [] as string[],
    };
  const favored = favoredClass(character);
  const budget = skillRankBudget(character, levelId);
  const gained = featuresGainedAt(character, levelId);
  const has = !!level.state.classKey;
  return {
    cls: !has,
    hp: has && level.state.hpGained === null,
    fcb:
      has &&
      level.state.classKey === favored &&
      level.state.favoredClassBonus === null,
    inc: gained.abilityIncreaseDue && level.state.abilityIncrease === null,
    ranks: !!budget && budget.spent < budget.total,
    picks: gained.features.flatMap((f) =>
      f.kind === 'choice' && f.picked.length < (f.grant.count ?? 1)
        ? [f.grant.label]
        : [],
    ),
  };
}

export function LevelsTable({
  character,
  warnings,
}: {
  character: Character;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  const nav = useProtoNav();
  const ui = useSheetUi();
  const levels = classLevels(character);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [bulk, setBulk] = useState<string | null>(null);
  const unspecified = levels.filter((l) => !l.state.classKey);
  const lastClass = levels.at(-1)?.state.classKey ?? null;
  const [nextClass, setNextClass] = useState<string | null>(lastClass);
  const nextPos = levels.length + 1;

  const rows = levels.map((l) => ({ l, todo: levelTodos(character, l.id) }));

  // A just-added level (`&level=`, from Level up here or `?page=levelup`):
  // scroll to it and spend its ranks in the skills table.
  const levelParam = nav.param('level');
  const levelParamExists = levels.some((l) => l.id === levelParam);
  const { setRanksLevelId } = ui;
  useEffect(() => {
    if (!levelParam || !levelParamExists) return;
    setRanksLevelId(levelParam);
    const row = document.getElementById(`b-level-${levelParam}`);
    jumpTo(
      row && row.offsetParent !== null ? row.id : `b-level-${levelParam}-card`,
    );
  }, [levelParam, levelParamExists, setRanksLevelId]);

  const classCell = (
    levelId: string,
    classKey: string | null,
    todo: boolean,
  ) => (
    <PickField
      ariaLabel="Class"
      value={classKey}
      placeholder="Unspecified"
      options={CLASS_OPTIONS}
      todo={todo}
      className="w-32"
      onChange={(v) =>
        store.updateClassLevel(character.id, levelId, { classKey: v })
      }
    />
  );
  const incCell = (
    levelId: string,
    value: AbilityKey | null,
    due: boolean,
    todo: boolean,
  ) => (
    <PickField
      ariaLabel="Ability score increase"
      value={value}
      placeholder={due ? 'choose' : '—'}
      options={ABILITY_OPTIONS}
      todo={todo}
      className={cn('w-24', !due && !value && 'opacity-60')}
      onChange={(v) =>
        store.updateClassLevel(character.id, levelId, { abilityIncrease: v })
      }
    />
  );

  const addLevel = () => {
    const id = store.addClassLevel(character.id, nextClass);
    nav.set({ level: id });
  };

  const header = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {unspecified.length > 1 && (
        <label className="text-muted-foreground flex items-center gap-1.5">
          set all {unspecified.length} unspecified to
          <PickField
            ariaLabel="Class for every unspecified level"
            value={bulk}
            options={CLASS_OPTIONS}
            placeholder="class…"
            className="w-28"
            onChange={(v) => {
              setBulk(v);
              if (!v) return;
              for (const l of unspecified)
                store.updateClassLevel(character.id, l.id, { classKey: v });
              setBulk(null);
            }}
          />
        </label>
      )}
    </div>
  );

  return (
    <Block
      id="b-levels"
      title="Class levels"
      aside={unspecified.length > 1 ? header : undefined}
    >
      {/* Tablet / desktop table */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-foreground/20 border-b">
              <th className={cn(th, 'w-8')}>#</th>
              <th className={th}>Class</th>
              <th className={th}>hp</th>
              <th className={th}>Favored</th>
              <th className={th}>Ability</th>
              <th className={th}>Ranks</th>
              <th className={th}>Gained</th>
              <th className={cn(th, 'w-28')} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ l, todo }) => (
              <tr
                key={l.id}
                id={`b-level-${l.id}`}
                className={cn(
                  'border-foreground/10 scroll-mt-24 border-b align-top',
                )}
              >
                <td className="px-2 py-1.5 font-mono text-base">
                  {l.state.position}
                </td>
                <td className="px-2 py-1.5">
                  {classCell(l.id, l.state.classKey, todo.cls)}
                  {l.state.classKey && (
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {classLevelShortLabel(character, l.id)}
                    </div>
                  )}
                  <AdvancesCell
                    character={character}
                    levelId={l.id}
                    className="mt-1"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <HpCell character={character} levelId={l.id} todo={todo.hp} />
                </td>
                <td className="px-2 py-1.5">
                  <FcbCell
                    character={character}
                    levelId={l.id}
                    todo={todo.fcb}
                  />
                </td>
                <td className="px-2 py-1.5">
                  {incCell(
                    l.id,
                    l.state.abilityIncrease,
                    l.state.position % 4 === 0,
                    todo.inc,
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <RanksCell
                    character={character}
                    levelId={l.id}
                    todo={todo.ranks}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <GainedCell character={character} levelId={l.id} />
                  <FieldWarnings
                    warnings={warnings}
                    where={`classLevel:${l.id}`}
                    characterId={character.id}
                    className="mt-1"
                    compact
                  />
                </td>
                <td className="px-1 py-1">
                  <LevelActions
                    character={character}
                    levelId={l.id}
                    confirming={confirming === l.id}
                    setConfirming={(v) => setConfirming(v ? l.id : null)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <div className="space-y-2 md:hidden">
        {rows.map(({ l, todo }) => (
          <div
            key={l.id}
            id={`b-level-${l.id}-card`}
            className={cn('border-foreground/20 border p-2 text-sm')}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg">{l.state.position}</span>
              {classCell(l.id, l.state.classKey, todo.cls)}
              <span className="ml-auto">
                <LevelActions
                  character={character}
                  levelId={l.id}
                  confirming={confirming === l.id}
                  setConfirming={(v) => setConfirming(v ? l.id : null)}
                />
              </span>
            </div>
            <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
              {advanceChoices(character, l.id).length > 0 && (
                <>
                  <span className="text-muted-foreground self-start pt-2">
                    advances
                  </span>
                  <AdvancesCell character={character} levelId={l.id} />
                </>
              )}
              <span className="text-muted-foreground">hp</span>
              <HpCell character={character} levelId={l.id} todo={todo.hp} />
              <span className="text-muted-foreground">favored</span>
              <FcbCell character={character} levelId={l.id} todo={todo.fcb} />
              <span className="text-muted-foreground">ability</span>
              {incCell(
                l.id,
                l.state.abilityIncrease,
                l.state.position % 4 === 0,
                todo.inc,
              )}
              <span className="text-muted-foreground">ranks</span>
              <RanksCell
                character={character}
                levelId={l.id}
                todo={todo.ranks}
              />
              <span className="text-muted-foreground">gained</span>
              <GainedCell character={character} levelId={l.id} />
            </div>
            <FieldWarnings
              warnings={warnings}
              where={`classLevel:${l.id}`}
              characterId={character.id}
              className="mt-1"
              compact
            />
          </div>
        ))}
      </div>

      {
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Level {nextPos} as</span>
          <PickField
            ariaLabel="Class for the next level"
            value={nextClass}
            placeholder="Unspecified"
            options={CLASS_OPTIONS}
            className="w-32"
            onChange={setNextClass}
          />
          <Button size="sm" variant="outline" onClick={addLevel}>
            Level up
          </Button>
        </div>
      }
    </Block>
  );
}

/** Options for a pick group, used by the features block. */
export function groupOptions(group: FeatureGroup) {
  return catalogForGroup(group).map((e) => ({
    value: e.key,
    label: e.summary ? `${e.name} — ${e.summary}` : e.name,
  }));
}
