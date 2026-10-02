'use client';
// PROTOTYPE (throwaway, #208) — Variant B: the one living sheet. Identity,
// abilities, defenses, offense, skills, feats, features, gear and the Class
// Levels strip, all edited in place. Creating, building out and levelling
// up all end here, on the same sheet. It opens with its vitals row (the
// name on the left, sticky under the shell's bar from tablet width) and
// the membership strip under it.
//
// Round 3 (#216): the Defenses and Offense blocks, the vitals row's extras,
// a row above the grid, skill extras and the breakdown's end come from the
// active sheet variant's slots (sheet-variants.tsx). The situation lens
// (`ui.situation`) renders the whole sheet resolved in that situation.

import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '~/lib/utils';
import { ABILITY_LABEL, ABILITY_SHORT, CLASSES, RACES } from '../catalog';
import { getStat, resolveInSituation } from '../resolve';
import {
  ABILITIES,
  baseScores,
  pointBuyCost,
  raceCatalog,
  useBuilderStore,
} from '../store';
import type {
  AbilityKey,
  Character,
  ResolvedSheet,
  SituationKey,
} from '../types';
import type { Warning } from '../warnings';
import { LevelsTable } from './levels-table';
import { FeatsBlock, FeaturesBlock, GearBlock } from './lists';
import { Figure } from './sheet-default-blocks';
import { useSheetVariant } from './sheet-variants';
import {
  Block,
  BreakdownPopover,
  FieldWarnings,
  NumField,
  PickField,
  SheetUiContext,
  StatButton,
  TextField,
  type OpenBreakdown,
  type SheetUi,
  type StatPath,
} from './shared';
import { SkillsTable } from './skills-table';

// ---------------------------------------------------------------- identity

function IdentityBlock({
  character,
  warnings,
}: {
  character: Character;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  const race = raceCatalog(character);
  const favored =
    race?.entry.state.kind === 'race' ? race.entry.state.favoredClass : null;
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

/**
 * The sheet. `sheet` is the normal one; with the situation lens set, every
 * block renders the sheet resolved in that situation instead. Mount it with
 * `key={character.id}` so the lens and the open breakdown reset when the
 * Character changes.
 */
export function LivingSheet({
  character,
  sheet: baseSheet,
  warnings,
  heading,
  below,
}: {
  character: Character;
  sheet: ResolvedSheet;
  warnings: Warning[];
  /** Left of the vitals row: the Character's name and summary line. */
  heading?: ReactNode;
  /** Under the vitals row: the membership strip. */
  below?: ReactNode;
}) {
  const [open, setOpen] = useState<OpenBreakdown | null>(null);
  const [ranksLevelId, setRanksLevelId] = useState<string | null>(null);
  const [situation, setSituationState] = useState<SituationKey | null>(null);
  const { key: variant, slots } = useSheetVariant();
  const sheet = useMemo(
    () => (situation ? resolveInSituation(character, situation) : baseSheet),
    [baseSheet, character, situation],
  );
  const ui: SheetUi = {
    open,
    setOpen,
    openStat: ({ key, title, stat, signed = true, anchor }) =>
      setOpen(
        open?.key === key
          ? null
          : {
              key,
              title,
              stat,
              signed,
              path: null,
              rect: anchor.getBoundingClientRect(),
            },
      ),
    ranksLevelId,
    setRanksLevelId,
    situation,
    setSituation: (next) => {
      setOpen(null);
      setSituationState(next);
    },
    sheet,
    baseSheet,
    character,
    variant,
    slots,
  };
  const { Defenses, Offense, VitalExtra, AboveSheet } = slots;

  return (
    <SheetUiContext.Provider value={ui}>
      {/* The vitals row: the name and summary on the left, the numbers
          right-aligned. Sticky under the shell's pinned bar from tablet
          width; in the flow on phone, where the name stacks above the
          numbers. */}
      <div
        className="bg-background/95 border-foreground/15 z-20 -mx-4 mb-3 flex flex-col gap-y-1.5 border-b px-4 py-1.5 backdrop-blur md:sticky md:-mx-6 md:flex-row md:items-end md:justify-between md:gap-x-4 md:px-6"
        style={{ top: 'var(--shell-top)' }}
      >
        {heading && <div className="min-w-0 md:flex-1">{heading}</div>}
        <div className="flex flex-wrap items-end justify-end gap-x-3 gap-y-0.5 md:shrink-0 md:flex-nowrap">
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
            >
              {VitalExtra && (
                <VitalExtra
                  path={v.path}
                  stat={getStat(sheet, v.path)}
                  character={character}
                  sheet={sheet}
                />
              )}
            </Figure>
          ))}
        </div>
      </div>

      {below}
      {AboveSheet && <AboveSheet character={character} sheet={sheet} />}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-12">
          <IdentityBlock character={character} warnings={warnings} />
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
          <Defenses character={character} sheet={sheet} />
          <Offense character={character} sheet={sheet} />
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
        <div className="min-w-0 lg:col-span-5">
          <FeatsBlock character={character} warnings={warnings} />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <FeaturesBlock character={character} warnings={warnings} />
        </div>
        <div className="min-w-0 lg:hidden">
          <GearBlock character={character} />
        </div>
      </div>
      <BreakdownPopover />
    </SheetUiContext.Provider>
  );
}
