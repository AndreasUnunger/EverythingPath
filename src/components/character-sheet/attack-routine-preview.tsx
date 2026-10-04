'use client';
import { useId } from 'react';
import { fieldLabel } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Row = ReturnType<typeof useCharacterSheet>['attacks']['rows'][number];
type Line = Row['singleView'][number];

const describeHand = (line: Line) =>
  line.endLabel
    ? `${line.handLabel}, ${line.endLabel.toLowerCase()}`
    : line.handLabel;
const describeHit = (line: Line) =>
  `${line.damage.text}/${line.critical.text}${line.range ? `, ${line.range.text}` : ''}`;

/**
 * Runs of attacks that differ only in their bonus, in the resolver's order:
 * "+6/+1 (1d8+3/19–20/×2)". Each run keeps its own weapon, damage and
 * critical, so an off hand or a double weapon's other end reads separately.
 */
function summarize(lines: Line[]) {
  const runs: { key: string; first: Line; lines: Line[] }[] = [];
  for (const line of lines) {
    const key = [
      line.hand,
      line.end,
      line.weaponName,
      line.mode,
      describeHit(line),
    ].join('|');
    const last = runs.at(-1);
    if (last?.key === key) last.lines.push(line);
    else runs.push({ key, first: line, lines: [line] });
  }
  const hasOffHand = lines.some((line) => line.hand === 'off');
  return runs.map(({ first, lines: run }, index) => {
    const bonuses = run.map((line) => line.attack.text).join('/');
    return {
      key: `${index}:${first.hand}:${first.end}`,
      lead: hasOffHand ? `${describeHand(first)}: ${first.weaponName}` : null,
      text: `${bonuses} (${describeHit(first)})`,
    };
  });
}

function Sequence({ title, lines }: { title: string; lines: Line[] }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{title}</dt>
      <dd className="min-w-0 space-y-0.5">
        {summarize(lines).map((run) => (
          <span key={run.key} className="block [overflow-wrap:anywhere]">
            {run.lead ? (
              <span className="text-muted-foreground">{run.lead} </span>
            ) : null}
            <span className="font-mono">{run.text}</span>
          </span>
        ))}
      </dd>
    </div>
  );
}

/** The saved routine as the sheet calculates it, kept until the next result arrives. */
export function AttackRoutinePreview({ row }: { row: Row }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="border-foreground/15 space-y-1 border-t pt-3"
    >
      <h3 id={id} className={fieldLabel}>
        As it attacks now
      </h3>
      {row.singleView.length > 0 ? (
        <dl className="space-y-0.5 text-sm">
          <Sequence title="Single attack" lines={row.singleView} />
          <Sequence title="Full attack" lines={row.fullView} />
        </dl>
      ) : null}
      {row.twoWeaponPenaltySummary ? (
        <p className="text-muted-foreground text-xs">
          {row.twoWeaponPenaltySummary}
        </p>
      ) : null}
      {row.warnings.map((warning) => (
        <p
          key={`${warning.check}:${warning.subject}`}
          className="text-xs [overflow-wrap:anywhere] text-amber-300"
        >
          {warning.message}
        </p>
      ))}
    </section>
  );
}
