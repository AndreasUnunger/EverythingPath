'use client';
// PROTOTYPE (throwaway, #208/#216) — the default Defenses and Offense
// blocks of the living sheet, and the row pieces they are built from
// (`Figure`, `StatRow`, `StatGroups`), exported so sheet variants can reuse
// them. Moved out of living-sheet.tsx in round 3 (#216).

import type { ReactNode } from 'react';
import { cn } from '~/lib/utils';
import type { Character, ResolvedSheet } from '../types';
import { Block, StatButton, type StatPath } from './shared';

/** A small labelled number, as in the vitals row. */
export function Figure({
  path,
  sheet,
  title,
  short,
  signed,
  size = 'md',
  className,
  children,
}: {
  path: StatPath;
  sheet: ResolvedSheet;
  title: string;
  short?: string;
  signed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Under the number (the vitals row's `VitalExtra` slot). */
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col items-start', className)}>
      <span className="text-muted-foreground font-sans text-[11px] leading-tight tracking-wide">
        {short ?? title}
      </span>
      <StatButton
        path={path}
        sheet={sheet}
        title={title}
        signed={signed}
        size={size}
        className="font-sans"
      />
      {children}
    </div>
  );
}

/**
 * One line of a defense or offense card: a plain-text label, optional
 * secondary numbers, and the main number right-aligned in a fixed column so
 * the figures line up down the card. Body font, not the pixel one. The row's
 * solid rule runs under the labels; each number sits on that same edge and
 * covers its stretch of the rule with its own dotted underline.
 */
const onRule = 'bg-card -mb-px self-end';

export function StatRow({
  label,
  title,
  path,
  sheet,
  signed,
  also,
  children,
}: {
  label: string;
  title: string;
  path: StatPath;
  sheet: ResolvedSheet;
  signed?: boolean;
  /** Secondary numbers shown between the label and the main one. */
  also?: { label: string; title: string; path: StatPath; signed?: boolean }[];
  /** Extra content after the label (a variant's situational notes). */
  children?: ReactNode;
}) {
  return (
    <li className="border-foreground/15 flex items-end gap-3 border-b pt-1">
      <span className="flex min-w-0 flex-1 flex-wrap items-end gap-x-4">
        <span className="pb-1.5 text-sm leading-tight">{label}</span>
        {also && (
          <span className="text-muted-foreground flex flex-wrap items-end gap-x-3 text-xs">
            {also.map((a) => (
              <span key={a.path} className="inline-flex items-end gap-1">
                <span className="pb-1.5 leading-tight">{a.label}</span>
                <StatButton
                  path={a.path}
                  sheet={sheet}
                  title={a.title}
                  signed={a.signed}
                  className={cn(
                    onRule,
                    'text-foreground min-h-7 font-sans text-sm',
                  )}
                />
              </span>
            ))}
          </span>
        )}
        {children}
      </span>
      <StatButton
        path={path}
        sheet={sheet}
        title={title}
        signed={signed}
        className={cn(onRule, 'min-w-12 justify-end font-sans text-xl')}
      />
    </li>
  );
}

/** Rows in groups set apart by space: HP and AC, the saves, CMD. */
export function StatGroups({
  groups,
}: {
  groups: { key: string; rows: ReactNode }[];
}) {
  return (
    <div>
      {groups.map((g) => (
        <ul key={g.key} className="py-3 first:pt-0 last:pb-0">
          {g.rows}
        </ul>
      ))}
    </div>
  );
}

export function DefensesBlock({
  sheet,
}: {
  character: Character;
  sheet: ResolvedSheet;
}) {
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

export function OffenseBlock({
  sheet,
}: {
  character: Character;
  sheet: ResolvedSheet;
}) {
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
