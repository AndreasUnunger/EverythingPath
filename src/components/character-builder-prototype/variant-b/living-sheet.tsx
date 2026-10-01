'use client';
// PROTOTYPE (throwaway, #208) — Variant B: the one living sheet. Identity,
// abilities, defenses, offense, skills, feats, features, gear and the Class
// Levels strip, all edited in place. Creating, building out and levelling
// up are the same sheet in a different highlighted state. The page above
// it shows the name, status and membership once; the sheet opens with its
// vitals strip (sticky under the shell's bar from tablet width).

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '~/lib/utils';
import { ABILITY_LABEL, ABILITY_SHORT, CLASSES, RACES } from '../catalog';
import {
  ABILITIES,
  baseScores,
  classLevels,
  pointBuyCost,
  raceCatalog,
  useBuilderStore,
} from '../store';
import type { AbilityKey, Character, ResolvedSheet } from '../types';
import type { Warning } from '../warnings';
import { LevelsTable } from './levels-table';
import { FeatsBlock, FeaturesBlock, GearBlock } from './lists';
import {
  Block,
  BreakdownPopover,
  FieldWarnings,
  NumField,
  PickField,
  SheetUiContext,
  StatButton,
  TextField,
  chip,
  type OpenBreakdown,
  type SheetMode,
  type StatPath,
} from './shared';
import { SkillsTable } from './skills-table';

// ---------------------------------------------------------------- identity

function IdentityBlock({
  character,
  warnings,
  mode,
}: {
  character: Character;
  warnings: Warning[];
  mode: SheetMode;
}) {
  const store = useBuilderStore();
  const race = raceCatalog(character);
  const hasClass = classLevels(character).some((l) => l.state.classKey);
  const favored =
    race?.entry.state.kind === 'race' ? race.entry.state.favoredClass : null;
  const fresh = mode === 'create';
  const label =
    'text-muted-foreground font-mono text-[11px] tracking-wide uppercase';
  return (
    <Block id="b-identity" title="Character">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4 lg:grid-cols-8">
        <label className="col-span-2 flex flex-col gap-0.5">
          <span className={label}>Name</span>
          <TextField
            ariaLabel="Name"
            value={character.name}
            todo={fresh && character.name === 'New character'}
            onChange={(v) => store.setName(character.id, v)}
            className="w-full font-sans text-lg"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={label}>Kind</span>
          <PickField
            ariaLabel="PC or NPC"
            className="w-full"
            value={character.kind}
            options={[
              { value: 'pc', label: 'PC' },
              { value: 'npc', label: 'NPC' },
            ]}
            onChange={(v) =>
              v && store.updateCharacter(character.id, { kind: v })
            }
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={label}>Race</span>
          <PickField
            ariaLabel="Race"
            className="w-full"
            value={race?.catalog.key ?? null}
            placeholder="choose"
            todo={!race && mode !== 'sheet'}
            options={RACES.map((r) => ({ value: r.key, label: r.name }))}
            onChange={(v) => store.setRace(character.id, v)}
          />
        </label>
        {race?.detail.chooseAbility && (
          <label className="flex flex-col gap-0.5">
            <span className={label}>{race.catalog.name} +2</span>
            <PickField
              ariaLabel="Racial +2 ability"
              className="w-full"
              value={
                race.entry.state.kind === 'race'
                  ? race.entry.state.abilityChoice
                  : null
              }
              placeholder="ability"
              todo={
                race.entry.state.kind === 'race' &&
                !race.entry.state.abilityChoice
              }
              options={ABILITIES.map((a) => ({
                value: a,
                label: ABILITY_LABEL[a],
              }))}
              onChange={(v) =>
                store.setRace(character.id, race.catalog.key, {
                  abilityChoice: v,
                })
              }
            />
          </label>
        )}
        <label className="flex flex-col gap-0.5">
          <span className={label}>Favored class</span>
          <PickField
            ariaLabel="Favored class"
            className="w-full"
            value={favored}
            placeholder={race ? 'choose' : 'race first'}
            todo={!!race && !favored && hasClass && mode !== 'sheet'}
            options={CLASSES.map((c) => ({ value: c.key, label: c.name }))}
            onChange={(v) =>
              race &&
              store.setRace(character.id, race.catalog.key, { favoredClass: v })
            }
          />
        </label>
        <label className="col-span-2 flex flex-col gap-0.5 md:col-span-4 lg:col-span-3">
          <span className={label}>Notes</span>
          <TextField
            ariaLabel="Notes"
            value={character.description}
            placeholder="A line about them"
            onChange={(v) =>
              store.updateCharacter(character.id, { description: v })
            }
            className="w-full text-sm"
          />
        </label>
      </div>
      {race && (
        <p className="text-muted-foreground mt-1.5 text-xs">
          {race.catalog.name}: {race.detail.traitsText.join(' · ')}
        </p>
      )}
      <FieldWarnings
        warnings={warnings}
        where={(w) =>
          w.where === 'race' || w.where === 'sheet' || w.where === 'level'
        }
        characterId={character.id}
        className="mt-1.5"
      />
    </Block>
  );
}

// --------------------------------------------------------------- abilities

function AbilitiesBlock({
  character,
  sheet,
  warnings,
}: {
  character: Character;
  sheet: ResolvedSheet;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  const base = baseScores(character);
  const cost = pointBuyCost(base);
  const budget = store.state.pointBuyBudget;
  const differs = ABILITIES.some(
    (a) => sheet.militia.scores[a] !== sheet.abilities[a].total,
  );
  return (
    <Block
      id="b-abilities"
      title="Ability scores"
      aside={
        <span
          className={cn(
            'font-mono text-xs',
            cost.outOfRange.length > 0 || cost.total !== budget
              ? 'text-amber-300'
              : 'text-muted-foreground',
          )}
          title="Point buy, from the base scores"
        >
          point buy {cost.total}/{budget}
          {cost.outOfRange.length > 0 && ' · out of 7–18'}
        </span>
      }
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            <th className="py-0.5 text-left font-normal" />
            <th className="py-0.5 text-center font-normal">Base</th>
            <th className="py-0.5 text-right font-normal">Total</th>
            <th className="py-0.5 text-right font-normal">Mod</th>
          </tr>
        </thead>
        <tbody>
          {ABILITIES.map((a: AbilityKey) => (
            <tr key={a} className="border-foreground/10 border-b">
              <td className="py-0.5 pr-2 font-mono text-base">
                {ABILITY_SHORT[a]}
                <span className="text-muted-foreground hidden text-xs xl:inline">
                  {' '}
                  {ABILITY_LABEL[a]}
                </span>
              </td>
              <td className="py-0.5 text-center">
                <NumField
                  ariaLabel={`${ABILITY_LABEL[a]} base score`}
                  value={base[a]}
                  onChange={(v) => store.setBaseScore(character.id, a, v ?? 10)}
                />
              </td>
              <td className="py-0.5 text-right">
                <StatButton
                  path={`abilities.${a}`}
                  sheet={sheet}
                  title={ABILITY_LABEL[a]}
                />
              </td>
              <td className="py-0.5 text-right">
                <StatButton
                  path={`abilityMods.${a}`}
                  sheet={sheet}
                  title={`${ABILITY_LABEL[a]} modifier`}
                  signed
                  size="sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {differs && (
        <p className="text-muted-foreground mt-1 text-xs">
          Militia sees permanent scores only:{' '}
          {ABILITIES.map(
            (a) => `${ABILITY_SHORT[a]} ${sheet.militia.scores[a]}`,
          ).join(', ')}
        </p>
      )}
      <FieldWarnings
        warnings={warnings}
        where="abilities"
        characterId={character.id}
        className="mt-1"
      />
    </Block>
  );
}

// ------------------------------------------------------ defenses / offense

function Figure({
  path,
  sheet,
  title,
  short,
  signed,
  size = 'md',
  className,
}: {
  path: StatPath;
  sheet: ResolvedSheet;
  title: string;
  short?: string;
  signed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start', className)}>
      <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
        {short ?? title}
      </span>
      <StatButton
        path={path}
        sheet={sheet}
        title={title}
        signed={signed}
        size={size}
      />
    </div>
  );
}

/**
 * One line of a defense or offense card: a plain-text label, optional
 * secondary numbers, and the main number right-aligned in a fixed column so
 * the figures line up down the card. Body font, not the pixel one.
 */
function StatRow({
  label,
  title,
  path,
  sheet,
  signed,
  also,
}: {
  label: string;
  title: string;
  path: StatPath;
  sheet: ResolvedSheet;
  signed?: boolean;
  /** Secondary numbers shown between the label and the main one. */
  also?: { label: string; title: string; path: StatPath; signed?: boolean }[];
}) {
  return (
    <li className="flex items-center gap-3 py-1">
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-0.5">
        <span className="text-sm">{label}</span>
        {also && (
          <span className="text-muted-foreground flex flex-wrap items-baseline gap-x-3 text-xs">
            {also.map((a) => (
              <span key={a.path} className="inline-flex items-baseline gap-1">
                {a.label}
                <StatButton
                  path={a.path}
                  sheet={sheet}
                  title={a.title}
                  signed={a.signed}
                  className="text-foreground min-h-6 font-sans text-sm"
                />
              </span>
            ))}
          </span>
        )}
      </span>
      <StatButton
        path={path}
        sheet={sheet}
        title={title}
        signed={signed}
        className="min-w-12 justify-end font-sans text-xl"
      />
    </li>
  );
}

/** Rows grouped by a divider: HP and AC, the saves, CMD. */
function StatGroups({
  groups,
}: {
  groups: { key: string; rows: ReactNode }[];
}) {
  return (
    <div className="divide-foreground/20 divide-y">
      {groups.map((g) => (
        <ul
          key={g.key}
          className="divide-foreground/10 divide-y py-1 first:pt-0 last:pb-0"
        >
          {g.rows}
        </ul>
      ))}
    </div>
  );
}

function DefensesBlock({ sheet }: { sheet: ResolvedSheet }) {
  return (
    <Block id="b-defenses" title="Defenses">
      <StatGroups
        groups={[
          {
            key: 'hp-ac',
            rows: (
              <>
                <StatRow
                  label="Hit points"
                  title="Hit points"
                  path="hp"
                  sheet={sheet}
                />
                <StatRow
                  label="Armor Class"
                  title="Armor Class"
                  path="ac"
                  sheet={sheet}
                  also={[
                    { label: 'Touch', title: 'Touch AC', path: 'touchAc' },
                    {
                      label: 'Flat-footed',
                      title: 'Flat-footed AC',
                      path: 'flatFootedAc',
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'saves',
            rows: (
              <>
                <StatRow
                  label="Fortitude"
                  title="Fortitude save"
                  path="saves.fort"
                  sheet={sheet}
                  signed
                />
                <StatRow
                  label="Reflex"
                  title="Reflex save"
                  path="saves.ref"
                  sheet={sheet}
                  signed
                />
                <StatRow
                  label="Will"
                  title="Will save"
                  path="saves.will"
                  sheet={sheet}
                  signed
                />
              </>
            ),
          },
          {
            key: 'cmd',
            rows: (
              <StatRow
                label="CMD"
                title="Combat Maneuver Defense"
                path="cmd"
                sheet={sheet}
                also={[
                  {
                    label: 'Flat-footed',
                    title: 'Flat-footed CMD',
                    path: 'flatFootedCmd',
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </Block>
  );
}

function OffenseBlock({ sheet }: { sheet: ResolvedSheet }) {
  return (
    <Block id="b-offense" title="Offense">
      <StatGroups
        groups={[
          {
            key: 'attacks',
            rows: (
              <>
                <StatRow
                  label="Base attack"
                  title="Base attack bonus"
                  path="bab"
                  sheet={sheet}
                  signed
                />
                <StatRow
                  label="Melee"
                  title="Melee attack"
                  path="attackMelee"
                  sheet={sheet}
                  signed
                />
                <StatRow
                  label="Ranged"
                  title="Ranged attack"
                  path="attackRanged"
                  sheet={sheet}
                  signed
                />
              </>
            ),
          },
          {
            key: 'cmb',
            rows: (
              <StatRow
                label="CMB"
                title="Combat Maneuver Bonus"
                path="cmb"
                sheet={sheet}
                signed
              />
            ),
          },
          {
            key: 'init',
            rows: (
              <StatRow
                label="Initiative"
                title="Initiative"
                path="init"
                sheet={sheet}
                signed
              />
            ),
          },
        ]}
      />
    </Block>
  );
}

// ------------------------------------------------------------- the sheet

/** Always-visible derived numbers in the vitals strip. */
const VITALS: {
  path: StatPath;
  title: string;
  short: string;
  signed?: boolean;
  /** Not worth the phone header's height. */
  phoneHidden?: boolean;
}[] = [
  { path: 'hp', title: 'Hit points', short: 'HP' },
  { path: 'ac', title: 'Armor Class', short: 'AC' },
  { path: 'touchAc', title: 'Touch AC', short: 'touch', phoneHidden: true },
  {
    path: 'flatFootedAc',
    title: 'Flat-footed AC',
    short: 'FF',
    phoneHidden: true,
  },
  { path: 'saves.fort', title: 'Fortitude save', short: 'Fort', signed: true },
  { path: 'saves.ref', title: 'Reflex save', short: 'Ref', signed: true },
  { path: 'saves.will', title: 'Will save', short: 'Will', signed: true },
  { path: 'bab', title: 'Base attack bonus', short: 'BAB', signed: true },
  { path: 'init', title: 'Initiative', short: 'Init', signed: true },
  {
    path: 'cmb',
    title: 'Combat Maneuver Bonus',
    short: 'CMB',
    signed: true,
    phoneHidden: true,
  },
  {
    path: 'cmd',
    title: 'Combat Maneuver Defense',
    short: 'CMD',
    phoneHidden: true,
  },
];

export function LivingSheet({
  character,
  sheet,
  warnings,
  mode,
  focusLevelId = null,
  baseline = null,
  dismissDeltas = () => undefined,
  banner,
}: {
  character: Character;
  sheet: ResolvedSheet;
  warnings: Warning[];
  mode: SheetMode;
  focusLevelId?: string | null;
  baseline?: ResolvedSheet | null;
  dismissDeltas?: () => void;
  /** Mode banner: the to-do checklist, the buildout note. */
  banner?: ReactNode;
}) {
  const [open, setOpen] = useState<OpenBreakdown | null>(null);
  const [ranksLevelId, setRanksLevelId] = useState<string | null>(focusLevelId);
  useEffect(() => {
    if (focusLevelId) setRanksLevelId(focusLevelId);
  }, [focusLevelId]);

  const changedCount = baseline
    ? (
        [
          'hp',
          'ac',
          'touchAc',
          'flatFootedAc',
          'bab',
          'cmb',
          'cmd',
          'flatFootedCmd',
          'init',
          'attackMelee',
          'attackRanged',
          'saves.fort',
          'saves.ref',
          'saves.will',
        ] as StatPath[]
      ).filter((p) => {
        const [h, t] = p.split('.') as [
          keyof ResolvedSheet,
          string | undefined,
        ];
        const a = t
          ? (sheet[h] as Record<string, { total: number }>)[t]!.total
          : (sheet[h] as { total: number }).total;
        const b = t
          ? (baseline[h] as Record<string, { total: number }>)[t]!.total
          : (baseline[h] as { total: number }).total;
        return a !== b;
      }).length
    : 0;

  return (
    <SheetUiContext.Provider
      value={{
        mode,
        open,
        setOpen,
        baseline,
        dismissDeltas,
        focusLevelId,
        ranksLevelId,
        setRanksLevelId,
      }}
    >
      {/* The vitals strip: B's signature. Sticky under the shell's pinned
          bar from tablet width; in the flow on phone. */}
      <div
        className="bg-background/95 border-foreground/15 z-20 -mx-4 mb-3 flex flex-wrap items-end gap-x-3 gap-y-0.5 border-b px-4 py-1.5 backdrop-blur md:sticky md:-mx-6 md:px-6"
        style={{ top: 'var(--shell-top)' }}
      >
        {VITALS.map((v) => (
          <Figure
            key={v.path}
            path={v.path}
            sheet={sheet}
            title={v.title}
            short={v.short}
            signed={v.signed}
            size="sm"
            className={v.phoneHidden ? 'hidden md:flex' : undefined}
          />
        ))}
        {baseline && changedCount > 0 && (
          <button
            type="button"
            onClick={dismissDeltas}
            className={cn(
              chip,
              'mb-1 ml-auto border-sky-400/70 text-sky-300 hover:bg-sky-400/10',
            )}
            title="Hide the before → after markers"
          >
            {changedCount} changed · hide
          </button>
        )}
      </div>

      {banner}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-12">
          <IdentityBlock
            character={character}
            warnings={warnings}
            mode={mode}
          />
        </div>
        <div className="min-w-0 lg:col-span-12">
          <LevelsTable character={character} warnings={warnings} />
        </div>
        <div className="min-w-0 space-y-3 lg:col-span-5">
          <AbilitiesBlock
            character={character}
            sheet={sheet}
            warnings={warnings}
          />
          <DefensesBlock sheet={sheet} />
          <OffenseBlock sheet={sheet} />
          <div className="hidden lg:block">
            <GearBlock character={character} />
          </div>
        </div>
        <div className="min-w-0 lg:col-span-7">
          <SkillsTable
            character={character}
            sheet={sheet}
            warnings={warnings}
          />
        </div>
        <div className="min-w-0 lg:col-span-6">
          <FeatsBlock character={character} warnings={warnings} />
        </div>
        <div className="min-w-0 lg:col-span-6">
          <FeaturesBlock character={character} warnings={warnings} />
        </div>
        <div className="min-w-0 lg:hidden">
          <GearBlock character={character} />
        </div>
      </div>
      <BreakdownPopover sheet={sheet} />
    </SheetUiContext.Provider>
  );
}
