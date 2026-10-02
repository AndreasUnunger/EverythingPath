'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 3, "Spells page": the
// Spellcasting section on the living sheet is one summary line per
// Spellcasting (class, caster level, concentration, per day, how many Spells,
// open warnings) linking to `?page=spells`; on phone the line wraps into a
// compact card. Orphaned Spells get the same group as on the page
// (s3-orphans.tsx). Contract: CONTRACT.md, "Round 4".

import { ArrowRight, TriangleAlert } from 'lucide-react';
import { cn } from '~/lib/utils';
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
  prestigeShare,
  recordedCount,
  useOpenWarningCount,
} from './s3-bits';
import { Orphans } from './s3-orphans';
import type { SpellSlotProps } from './sheet-variants';
import { Block, StatButton } from './shared';

// The same scale as the page's labels and the table headers (`th`).
const label = 'text-muted-foreground font-mono text-xs tracking-wide uppercase';

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
  const share = prestigeShare(sc);
  const linkText = none
    ? `Browse the ${sc.className.toLowerCase()} list`
    : 'Open spells';
  // A `none` caster has nothing to count unless something is granted.
  const counts = none
    ? sc.granted.length > 0
      ? `${sc.granted.length} granted`
      : null
    : recordedCount(sc) +
      (sc.granted.length > 0 ? ` · ${sc.granted.length} granted` : '');
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2">
      <span className="flex min-w-0 basis-full flex-wrap items-baseline gap-x-2 md:basis-auto">
        <span className="font-sans text-base">{sc.className}</span>
        <span className="text-muted-foreground text-xs">
          {sc.heading ?? 'whole list'}
          {share && ` · ${share}`}
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
          className="flex min-w-0 flex-wrap items-baseline gap-x-2 font-mono text-base"
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

      {/* The counts and the warning count wrap as one unit. */}
      {(counts !== null || open > 0) && (
        <span className="flex items-center gap-x-3">
          {counts && (
            <span className="text-muted-foreground font-mono text-sm">
              {counts}
            </span>
          )}
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
        </span>
      )}

      <ProtoLink
        to="spells"
        opts={{ params: { spellcasting: sc.classKey } }}
        className="text-primary flex min-h-11 basis-full items-center gap-1 text-sm hover:underline md:ml-auto md:min-h-8 md:basis-auto"
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
  const orphans = orphanedSpells(character).length;
  if (all.length === 0 && orphans === 0) return null;
  return (
    <Block id="b-spellcasting" title="Spellcasting">
      {all.length > 0 && (
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
      )}
      <Orphans
        character={character}
        warnings={warnings}
        className={cn(
          all.length > 0 && 'border-foreground/10 mt-4 border-t pt-2',
        )}
      />
    </Block>
  );
}
