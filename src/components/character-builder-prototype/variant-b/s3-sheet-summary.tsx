'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 3, "Spells page": the
// Spellcasting section on the living sheet is one summary line per
// Spellcasting (class, caster level, concentration, per day, how many Spells,
// open warnings) linking to `?page=spells`. The sheet stays lean; the
// list lives on its own page. Contract: CONTRACT.md, "Round 4".

import { ArrowRight, TriangleAlert } from 'lucide-react';
import { cn } from '~/lib/utils';
import { className as classNameOf } from '../sheet';
import {
  ordinal,
  orphanedSpells,
  spellcastingsOf,
  type ResolvedSpellcasting,
} from '../spellcasting';
import type { Warning } from '../warnings';
import {
  PerDay,
  ProtoLink,
  recordedCount,
  useOpenWarningCount,
} from './s3-bits';
import type { SpellSlotProps } from './sheet-variants';
import { Block, StatButton } from './shared';

const label =
  'text-muted-foreground font-mono text-[11px] tracking-wide uppercase';

function SummaryLine({
  sc,
  characterId,
  warnings,
}: {
  sc: ResolvedSpellcasting;
  characterId: string;
  warnings: Warning[];
}) {
  const open = useOpenWarningCount(characterId, sc, warnings);
  const none = sc.casting.record === 'none';
  const linkText = none
    ? `Browse the ${sc.className.toLowerCase()} list`
    : 'Open spells';
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2">
      <span className="flex min-w-0 items-baseline gap-x-2">
        <span className="font-sans text-base">{sc.className}</span>
        <span className="text-muted-foreground truncate text-xs">
          {sc.heading ?? 'whole list'}
          {sc.advances.length > 0 && ` · +${sc.advances.length} prestige`}
        </span>
      </span>

      <span className="flex items-center gap-x-3">
        <span className="flex items-baseline gap-1">
          <span className={label}>CL</span>
          {sc.casterLevel ? (
            <StatButton
              size="sm"
              title={`${sc.className} caster level`}
              stat={sc.casterLevel}
              statKey={`${sc.classKey}:cl`}
            />
          ) : (
            <span className="text-muted-foreground font-mono">—</span>
          )}
        </span>
        <span className="flex items-baseline gap-1">
          <span className={label}>Conc</span>
          {sc.concentration ? (
            <StatButton
              size="sm"
              signed
              title={`${sc.className} concentration`}
              stat={sc.concentration}
              statKey={`${sc.classKey}:conc`}
            />
          ) : (
            <span className="text-muted-foreground font-mono">—</span>
          )}
        </span>
      </span>

      {sc.rows.length > 0 ? (
        <span
          className="flex flex-wrap items-baseline gap-x-2 font-mono text-base"
          aria-label={`${sc.className} spells per day`}
        >
          <span className={label}>Per day</span>
          {sc.rows.map((row, i) => (
            <span key={row.level} className="flex items-baseline gap-x-1">
              {i > 0 && <span className="text-muted-foreground/60">·</span>}
              <span className="text-muted-foreground text-sm">
                {ordinal(row.level)}
              </span>
              <PerDay row={row} sc={sc} />
              {row.prepared !== null && row.perDay !== null && (
                <span
                  className="text-muted-foreground text-sm"
                  title={`${row.prepared} prepared`}
                >
                  (prep {row.prepared})
                </span>
              )}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground text-sm">No spells yet</span>
      )}

      <span className="text-muted-foreground text-sm">
        {none
          ? sc.granted.length > 0
            ? `${sc.granted.length} granted`
            : 'no granted Spells'
          : recordedCount(sc) +
            (sc.granted.length > 0 ? ` · ${sc.granted.length} granted` : '')}
      </span>

      {open > 0 && (
        <ProtoLink
          to="spells"
          opts={{ params: { spellcasting: sc.classKey } }}
          className="flex items-center gap-1 font-mono text-sm text-amber-300 hover:underline"
          title={`${open} open warning${open === 1 ? '' : 's'}: open the spells page`}
        >
          <TriangleAlert aria-hidden className="size-3.5" />
          {open}
        </ProtoLink>
      )}

      <ProtoLink
        to="spells"
        opts={{ params: { spellcasting: sc.classKey } }}
        className="text-primary ml-auto flex min-h-11 items-center gap-1 text-sm hover:underline md:min-h-8"
      >
        {linkText}
        <ArrowRight aria-hidden className="size-3.5" />
      </ProtoLink>
    </li>
  );
}

/** The Spellcasting section: a lean line per Spellcasting; everything else is on the spells page. */
export function S3SpellcastingSummary({ character, warnings }: SpellSlotProps) {
  const all = spellcastingsOf(character);
  const orphans = orphanedSpells(character);
  if (all.length === 0 && orphans.length === 0) return null;
  const firstName = character.name.split(' ')[0] ?? character.name;
  return (
    <Block id="b-spellcasting" title="Spellcasting">
      <ul className="divide-foreground/10 -my-2 divide-y">
        {all.map((sc) => (
          <SummaryLine
            key={sc.classKey}
            sc={sc}
            characterId={character.id}
            warnings={warnings}
          />
        ))}
      </ul>
      {orphans.length > 0 && (
        <p
          className={cn(
            'mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-300',
            all.length > 0 && 'border-foreground/10 border-t pt-2',
          )}
        >
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            {orphans.map((o) => o.catalog.name).join(', ')}{' '}
            {orphans.length === 1 ? 'is' : 'are'} recorded for{' '}
            {[...new Set(orphans.map((o) => classNameOf(o.castingClass)))].join(
              ' and ',
            )}
            , which {firstName} has no levels in.
          </span>
          <ProtoLink
            to="spells"
            opts={
              all[0] ? { params: { spellcasting: all[0].classKey } } : undefined
            }
            className="text-primary flex min-h-11 items-center gap-1 hover:underline md:min-h-6"
          >
            Sort it out
            <ArrowRight aria-hidden className="size-3" />
          </ProtoLink>
        </p>
      )}
    </Block>
  );
}
