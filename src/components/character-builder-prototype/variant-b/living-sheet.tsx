'use client';
// PROTOTYPE (throwaway, #208) — Variant B: the one living sheet. Identity,
// abilities, defenses, offense, skills, feats, features, gear and the Class
// Levels strip, all edited in place. Creating, building out and levelling
// up are the same sheet in a different highlighted state.

import { ArrowLeft } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { ABILITY_LABEL, ABILITY_SHORT, CLASSES, RACES } from '../catalog';
import { useProtoNav } from '../nav';
import {
  ABILITIES,
  baseScores,
  classLevels,
  pointBuyCost,
  raceCatalog,
  useBuilderStore,
} from '../store';
import type { AbilityKey, Character, ResolvedSheet } from '../types';
import { formatBonus } from '../ui-helpers';
import type { Warning } from '../warnings';
import { IssuesButton } from './checklist';
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

function classSummary(sheet: ResolvedSheet) {
  const parts = sheet.classes.map((c) => `${c.name} ${c.levels}`);
  return parts.length ? parts.join(' / ') : 'No class';
}

// ---------------------------------------------------------------- identity

function IdentityBlock({
  character,
  sheet,
  warnings,
  mode,
}: {
  character: Character;
  sheet: ResolvedSheet;
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
    <Block
      id="b-identity"
      title="Character"
      aside={
        <span className="text-muted-foreground font-mono text-xs">
          {classSummary(sheet)} · level {sheet.level} · {sheet.hitDice} HD
        </span>
      }
    >
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
        <label className="flex flex-col gap-0.5">
          <span className={label}>Presentation</span>
          <PickField
            ariaLabel="Sheet presentation"
            className="w-full"
            value={character.sheetMode}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'militiaOnly', label: 'Militia-only' },
            ]}
            onChange={(v) => v && store.setSheetMode(character.id, v)}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-0.5 md:col-span-4 lg:col-span-2">
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
      {character.sheetMode === 'militiaOnly' && (
        <p className="text-muted-foreground mt-1.5 text-xs">
          Militia-only presentation: the militia reads level and the six scores.
          Everything else on this sheet is kept.
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

function DefensesBlock({ sheet }: { sheet: ResolvedSheet }) {
  return (
    <Block id="b-defenses" title="Defenses">
      <div className="grid grid-cols-3 gap-x-2 gap-y-2">
        <Figure
          path="hp"
          sheet={sheet}
          title="Hit points"
          short="HP"
          size="lg"
        />
        <Figure
          path="ac"
          sheet={sheet}
          title="Armor Class"
          short="AC"
          size="lg"
        />
        <div className="flex flex-col gap-1">
          <Figure
            path="touchAc"
            sheet={sheet}
            title="Touch AC"
            short="touch"
            size="sm"
          />
          <Figure
            path="flatFootedAc"
            sheet={sheet}
            title="Flat-footed AC"
            short="flat-footed"
            size="sm"
          />
        </div>
        <Figure
          path="saves.fort"
          sheet={sheet}
          title="Fortitude save"
          short="Fort"
          signed
        />
        <Figure
          path="saves.ref"
          sheet={sheet}
          title="Reflex save"
          short="Ref"
          signed
        />
        <Figure
          path="saves.will"
          sheet={sheet}
          title="Will save"
          short="Will"
          signed
        />
        <Figure
          path="cmd"
          sheet={sheet}
          title="Combat Maneuver Defense"
          short="CMD"
        />
        <Figure
          path="flatFootedCmd"
          sheet={sheet}
          title="Flat-footed CMD"
          short="FF CMD"
          size="sm"
        />
      </div>
    </Block>
  );
}

function OffenseBlock({ sheet }: { sheet: ResolvedSheet }) {
  return (
    <Block id="b-offense" title="Offense">
      <div className="grid grid-cols-3 gap-x-2 gap-y-2">
        <Figure
          path="bab"
          sheet={sheet}
          title="Base attack bonus"
          short="BAB"
          signed
        />
        <Figure
          path="attackMelee"
          sheet={sheet}
          title="Melee attack"
          short="Melee"
          signed
        />
        <Figure
          path="attackRanged"
          sheet={sheet}
          title="Ranged attack"
          short="Ranged"
          signed
        />
        <Figure
          path="cmb"
          sheet={sheet}
          title="Combat Maneuver Bonus"
          short="CMB"
          signed
        />
        <Figure
          path="init"
          sheet={sheet}
          title="Initiative"
          short="Init"
          signed
        />
      </div>
    </Block>
  );
}

// ------------------------------------------------------------- the sheet

/** Always-visible derived numbers in the sticky header. */
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
  actions,
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
  /** Extra header actions. */
  actions?: ReactNode;
}) {
  const nav = useProtoNav();
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
      <div className="bg-background/95 border-foreground/15 sticky top-0 z-30 -mx-4 -mt-4 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 backdrop-blur md:-mx-6 md:-mt-6 md:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="All characters"
          onClick={() => nav.go('list')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="font-sans text-xl md:text-2xl">{character.name}</h1>
        <span className="text-muted-foreground hidden font-mono text-sm md:inline">
          {classSummary(sheet)} · level {sheet.level}
        </span>
        {baseline && changedCount > 0 && (
          <button
            type="button"
            onClick={dismissDeltas}
            className={cn(
              chip,
              'border-sky-400/70 text-sky-300 hover:bg-sky-400/10',
            )}
            title="Hide the before → after markers"
          >
            {changedCount} changed · hide
          </button>
        )}
        <span className="ml-auto flex items-center gap-2">
          <IssuesButton warnings={warnings} characterId={character.id} />
          {actions}
        </span>
        <div className="flex basis-full flex-wrap items-end gap-x-3 gap-y-0.5">
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
        </div>
      </div>

      {banner}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-12">
          <IdentityBlock
            character={character}
            sheet={sheet}
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
      <p className="text-muted-foreground mt-3 text-xs">
        Numbers with a dotted underline open their breakdown. Nothing here is
        locked: past levels, scores and picks all edit in place. Rules checks
        are advisory. Buffed numbers show in violet; the base scores and BAB are{' '}
        {formatBonus(sheet.bab.total)} / {sheet.hp.total} hp today.
      </p>
      <BreakdownPopover sheet={sheet} />
    </SheetUiContext.Provider>
  );
}
