'use client';
// PROTOTYPE — the settled page contents (from #113, #114, #117 and #118),
// cut into index rows and detail bodies so each variant only decides how
// they collapse on a phone and what desktop adds. Nothing here is under review.

import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Flag,
  History,
  Lock,
  Pencil,
  Plus,
  Users,
  X,
} from 'lucide-react';
import type { Dispatch } from 'react';
import { useState } from 'react';
import { CreateFields } from '~/components/campaign-home-prototype/frame';
import {
  continuePhase,
  formatInGameDate,
  militiaLine,
  provenanceBadge,
  statusLine,
  type Campaign,
} from '~/components/campaign-home-prototype/mock';
import {
  hitDiceText,
  roleLabel,
  type Action as COAction,
  type Character,
  type Kind,
  type Projection,
  type Role,
} from '~/components/characters-officers-prototype/mock';
import {
  Chip,
  KindChip,
  ManagesLine,
  PendingLine,
  RoleChips,
  Warn,
} from '~/components/characters-officers-prototype/parts';
import {
  currentWeek,
  effectiveEntry,
  phases,
  provenanceLabels,
  type Entry,
  type WeekRecord,
} from '~/components/finished-weeks-prototype/mock';
import {
  AdjustmentsSection,
  Chip as FwChip,
  isEffective,
  PhaseSection,
  ProvenanceLine,
  ReadOnlyNote,
  ResultTable,
  shortDate,
  type Selection,
} from '~/components/finished-weeks-prototype/parts';
import {
  carriedBlocks,
  countOf,
  sections,
  type Action as SCAction,
  type SectionKey,
  type Snapshot,
  type State as SCState,
} from '~/components/setup-correction-prototype/mock';
import {
  correctable,
  correctionLocked,
  sectionWarnings,
  setupModel,
  startMilitia,
  stepForProblem,
} from '~/components/setup-correction-prototype/model';
import {
  BlockRead,
  CarriedRead,
  CorrectionBody,
  ErrorSummary,
  Eyebrow,
  SectionWarnings,
  SetupStepBody,
  WarningLine,
} from '~/components/setup-correction-prototype/parts';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { FantasyDatePicker } from '~/components/ui/fantasy-date-picker';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';
import type { PageKey } from './primitives';

export type Props = {
  page: PageKey;
  go: (page: PageKey) => void;
  sc: { state: SCState; dispatch: Dispatch<SCAction> };
  co: { view: Projection; edit: Dispatch<COAction> };
  fw: {
    weeks: WeekRecord[];
    record: WeekRecord;
    entry: Entry;
    select: (s: Selection) => void;
  };
  ch: {
    campaigns: Campaign[];
    selectedId?: string;
    select: (id: string | undefined) => void;
    create: (name: string, description: string) => Campaign;
    update: (
      id: string,
      patch: { description?: string; inGameDate?: string },
    ) => void;
  };
};

export const rowClass = (active: boolean, disabled = false) =>
  cn(
    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
    active ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/5',
    disabled && 'opacity-40',
  );

// ============================================================ Setup

export const useSetup = (sc: Props['sc']) => setupModel(sc.state);
export type SetupModel = ReturnType<typeof setupModel>;
export type SetupStep = SetupModel['steps'][number];

export function StepIcon({
  s,
  attempted,
}: {
  s: SetupStep;
  attempted: boolean;
}) {
  const bad = s.errors.length > 0 && (s.visited || attempted);
  return (
    <span className="flex w-4 shrink-0 justify-center">
      {s.key === 'review' ? (
        <Flag className="size-3.5" />
      ) : bad ? (
        <CircleAlert className="text-destructive size-3.5" />
      ) : s.warnings.length ? (
        <AlertTriangle className="size-3.5 text-amber-300" />
      ) : s.visited ? (
        <Check className="size-3.5" />
      ) : null}
    </span>
  );
}

/** One step in the index: icon, label, caption. Renders the Optional eyebrow and the divider before Review. */
export function SetupStepRow({
  s,
  m,
  sc,
  onGo,
  chevron,
}: {
  s: SetupStep;
  m: SetupModel;
  sc: Props['sc'];
  onGo: (i: number) => void;
  chevron?: boolean;
}) {
  return (
    <li>
      {s.key === 'conditions' && sc.state.scenario.mode === 'new' && (
        <p className="text-muted-foreground mt-2 mb-1 px-2 text-[11px] tracking-widest uppercase">
          Optional
        </p>
      )}
      {s.key === 'review' && <div className="bg-foreground/15 my-2 h-px" />}
      <button
        onClick={() => onGo(s.index)}
        className={rowClass(s.index === m.current.index)}
      >
        <StepIcon s={s} attempted={sc.state.setup.attempted} />
        <span className="flex-1">{s.label}</span>
        <span className="text-xs opacity-70">{s.caption}</span>
        {chevron && <ChevronRight className="size-4 opacity-50" />}
      </button>
    </li>
  );
}

export function StartingPoint({ sc }: { sc: Props['sc'] }) {
  return (
    <div
      className="grid grid-cols-2 overflow-hidden rounded-md border text-sm"
      role="radiogroup"
      aria-label="Starting point"
    >
      {(['new', 'existing'] as const).map((mode) => (
        <button
          key={mode}
          role="radio"
          aria-checked={sc.state.scenario.mode === mode}
          onClick={() =>
            sc.dispatch({ kind: 'scenario', key: 'mode', value: mode })
          }
          className={cn(
            'py-1.5',
            sc.state.scenario.mode === mode &&
              'bg-primary text-primary-foreground',
          )}
        >
          {mode === 'new' ? 'New' : 'Existing'}
        </button>
      ))}
    </div>
  );
}

/** The body of the current step (or Review). The variant owns the title and footer. */
export function SetupStepDetail({
  sc,
  m,
  columns,
  onGo,
}: {
  sc: Props['sc'];
  m: SetupModel;
  columns: 2 | 3 | 4;
  onGo: (i: number) => void;
}) {
  const patch = (fn: (s: Snapshot) => Snapshot) =>
    sc.dispatch({ kind: 'setup:patch', fn });
  if (m.current.key === 'review')
    return (
      <div className="space-y-4">
        <ErrorSummary
          errors={sc.state.setup.attempted ? m.errors : []}
          onGo={(p) => onGo(stepForProblem(p))}
        />
        <div className="space-y-1">
          <Eyebrow>Warnings by step</Eyebrow>
          {m.steps
            .filter((s) => s.warnings.length)
            .map((s) => (
              <div key={s.key} className="space-y-0.5">
                <button
                  className="text-sm underline underline-offset-2"
                  onClick={() => onGo(s.index)}
                >
                  {s.label}
                </button>
                {s.warnings.map((w) => (
                  <WarningLine key={w.text}>{w.text}</WarningLine>
                ))}
              </div>
            ))}
          {m.warnings.length === 0 && (
            <p className="text-muted-foreground text-sm">None.</p>
          )}
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Setup notes</span>
          <textarea
            className="border-input bg-background min-h-28 w-full rounded-md border p-2 text-sm"
            value={m.draft.notes}
            onChange={(e) => patch((s) => ({ ...s, notes: e.target.value }))}
          />
        </label>
      </div>
    );
  return (
    <div className={cn(columns === 2 && '[&_.w-52]:w-full')}>
      <SetupStepBody
        stepKey={m.current.key}
        blocks={m.current.blocks}
        draft={m.draft}
        mode={sc.state.scenario.mode}
        patch={patch}
        errors={m.showErrors ? m.errors : []}
        warnings={m.current.warnings}
        columns={columns}
      />
    </div>
  );
}

export function SetupNext({
  props,
  m,
  onGo,
  className,
}: {
  props: Props;
  m: SetupModel;
  onGo: (i: number) => void;
  className?: string;
}) {
  const { sc, go } = props;
  return m.current.key === 'review' ? (
    <Button
      size="lg"
      className={className}
      onClick={() =>
        startMilitia({
          state: sc.state,
          dispatch: sc.dispatch,
          screen: 'setup',
          go: () => go('militia'),
        })
      }
    >
      <Flag /> Start militia week
    </Button>
  ) : (
    <Button className={className} onClick={() => onGo(m.current.index + 1)}>
      Next: {m.steps[m.current.index + 1]!.label} <ArrowRight />
    </Button>
  );
}

/** Errors and warnings across all steps, for a desktop side column. */
export function SetupProblems({
  m,
  onGo,
}: {
  m: SetupModel;
  onGo: (i: number) => void;
}) {
  const steps = m.steps.filter((s) => s.errors.length || s.warnings.length);
  return (
    <div className="space-y-3">
      <Eyebrow>Across all steps</Eyebrow>
      {steps.length === 0 && (
        <p className="text-muted-foreground text-sm">Nothing to fix.</p>
      )}
      {steps.map((s) => (
        <div key={s.key} className="space-y-0.5">
          <button
            className="text-sm font-medium underline underline-offset-2"
            onClick={() => onGo(s.index)}
          >
            {s.label}
          </button>
          {s.errors.map((e) => (
            <p key={e.text} className="text-destructive text-xs">
              {e.text}
            </p>
          ))}
          {s.warnings.map((w) => (
            <WarningLine key={w.text}>{w.text}</WarningLine>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================ Militia

export type MilitiaKey = SectionKey | 'carried';

export function militiaItems(sc: Props['sc']) {
  const { state } = sc;
  const list = sections
    .filter((s) => correctable().includes(s.key))
    .map((s) => ({
      key: s.key as MilitiaKey,
      label: s.label,
      count: countOf(state.latest, s.key),
      warnings: sectionWarnings(state.latest, s.key).length,
      editing: state.correction?.section === s.key,
      disabled: !!state.correction && state.correction.section !== s.key,
      summary: firstLine(state.latest, s.key),
    }));
  const carried = {
    key: 'carried' as MilitiaKey,
    label: 'Week & carried effects',
    count: carriedBlocks.reduce(
      (n, b) => n + (state.latest[b.key] as unknown[]).length,
      0,
    ),
    warnings: 0,
    editing: false,
    disabled: !!state.correction,
    summary: `Week ${state.latest.week.week}`,
  };
  return { list, carried };
}
const firstLine = (s: Snapshot, key: SectionKey) => {
  const b = sections.find((x) => x.key === key)!.blocks[0]!;
  if (b.single) {
    const row = s[b.key] as Record<string, string | boolean | undefined>;
    return b.columns
      .slice(0, 3)
      .map(
        (c) =>
          `${c.label} ${typeof row[c.key] === 'boolean' ? (row[c.key] ? 'Yes' : 'No') : (row[c.key] ?? '—')}`,
      )
      .join(' · ');
  }
  return (s[b.key] as { name?: string }[])
    .map((r) => r.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
};

export const militiaCurrent = (
  sc: Props['sc'],
  picked: MilitiaKey,
): MilitiaKey =>
  sc.state.correction && sc.state.correction.section !== 'people'
    ? sc.state.correction.section
    : picked;
export const militiaTitle = (sc: Props['sc'], key: MilitiaKey) =>
  key === 'carried'
    ? `Week ${sc.state.latest.week.week} & carried effects`
    : sections.find((s) => s.key === key)!.label;

export function MilitiaCorrectButton({
  sc,
  current,
  size,
}: {
  sc: Props['sc'];
  current: MilitiaKey;
  size?: 'sm' | 'default';
}) {
  if (current === 'carried') return null;
  const section = sections.find((s) => s.key === current)!;
  const editing = sc.state.correction?.section === current;
  if (editing) return null;
  return (
    <Button
      size={size}
      onClick={() =>
        sc.dispatch({ kind: 'correct:open', section: section.key })
      }
      disabled={correctionLocked(sc.state, section.key)}
    >
      <Pencil /> Correct {size === 'sm' ? '' : section.label.toLowerCase()}
    </Button>
  );
}

/** The read view of a section, or the carried state. */
export function MilitiaRead({
  sc,
  current,
  dense,
}: {
  sc: Props['sc'];
  current: MilitiaKey;
  dense?: boolean;
}) {
  if (current === 'carried')
    return <CarriedRead snapshot={sc.state.latest} dense={dense} />;
  const section = sections.find((s) => s.key === current)!;
  return (
    <>
      {section.blocks.map((b) => (
        <div key={b.key} className="space-y-1 overflow-x-auto">
          {section.blocks.length > 1 && <Eyebrow>{b.label}</Eyebrow>}
          <BlockRead block={b} snapshot={sc.state.latest} dense={dense} />
        </div>
      ))}
      <SectionWarnings
        warnings={sectionWarnings(sc.state.latest, section.key)}
      />
    </>
  );
}

export function MilitiaEditor({
  sc,
  columns,
}: {
  sc: Props['sc'];
  columns: 2 | 3 | 4;
}) {
  return (
    <CorrectionBody state={sc.state} dispatch={sc.dispatch} columns={columns} />
  );
}

/** Desktop side column: warnings across sections and this session's saved corrections. */
export function MilitiaAside({
  sc,
  onPick,
}: {
  sc: Props['sc'];
  onPick: (k: MilitiaKey) => void;
}) {
  const items = militiaItems(sc).list.filter((i) => i.warnings);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Eyebrow>Warnings</Eyebrow>
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">None.</p>
        )}
        {items.map((i) => (
          <div key={i.key}>
            <button
              className="text-sm underline underline-offset-2"
              onClick={() => onPick(i.key)}
            >
              {i.label}
            </button>
            {sectionWarnings(sc.state.latest, i.key as SectionKey).map((w) => (
              <WarningLine key={w.text}>{w.text}</WarningLine>
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Eyebrow>Corrected this session</Eyebrow>
        {sc.state.savedCorrections.length === 0 && (
          <p className="text-muted-foreground text-sm">Nothing yet.</p>
        )}
        {sc.state.savedCorrections.map((c) => (
          <p key={`${c.section}-${c.reason}-${c.by}`} className="text-sm">
            <span className="capitalize">{c.section}</span>{' '}
            <span className="text-muted-foreground">
              · {c.reason} · {c.by}
            </span>
          </p>
        ))}
      </div>
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        <Lock className="size-3" /> Carried state changes through the week.
      </p>
    </div>
  );
}

// ============================================================ Characters & officers

/** One role as a compact row (phone): role, holder, effect, and Assign when editing. */
export function OfficerRow({
  v,
  editing,
  onAssign,
  edit,
}: {
  v: Projection['roleViews'][number];
  editing: boolean;
  onAssign: (r: Role) => void;
  edit: Dispatch<COAction>;
}) {
  return (
    <li
      className={cn(
        'flex items-start gap-3 px-3 py-2',
        v.vacant && 'text-muted-foreground',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{v.label}</span>
          {v.holders.map((h) => (
            <span
              key={h.characterId}
              className={cn(
                !h.counts && 'text-muted-foreground',
                h.archived && 'line-through',
              )}
            >
              {h.name}
              {editing && (
                <button
                  aria-label={`Remove ${h.name}`}
                  className="ml-1 align-middle opacity-60"
                  onClick={() =>
                    edit({
                      kind: 'unassign',
                      role: v.role,
                      characterId: h.characterId,
                    })
                  }
                >
                  <X className="size-3.5" />
                </button>
              )}
            </span>
          ))}
          {v.vacant && <span className="italic">Vacant</span>}
        </p>
        <p className="truncate font-mono text-xs">{v.effect}</p>
        {v.pending.map((p) => (
          <p key={p} className="text-xs text-sky-300">
            Pending: {p}
          </p>
        ))}
      </div>
      {editing && (
        <Button
          size="sm"
          variant="outline"
          aria-label={`Assign ${v.label}`}
          onClick={() => onAssign(v.role)}
        >
          <Plus /> Assign
        </Button>
      )}
    </li>
  );
}

/** The candidates for a role, hosted wherever the variant likes. */
export function AssignList({
  role,
  view,
  edit,
  onDone,
}: {
  role: Role;
  view: Projection;
  edit: Dispatch<COAction>;
  onDone: () => void;
}) {
  const list = view.candidates(role);
  return (
    <div className="space-y-4 p-4">
      <p className="text-muted-foreground text-sm">
        People on the militia roster. Adding a role keeps their current one.
      </p>
      {(['pc', 'npc'] as Kind[]).map((kind) => (
        <div key={kind}>
          <h4 className="text-muted-foreground mb-1 text-xs tracking-widest uppercase">
            {kind === 'pc' ? 'Player characters' : 'NPCs'}
          </h4>
          {list.filter((c) => c.kind === kind).length === 0 && (
            <p className="text-muted-foreground text-sm">None available.</p>
          )}
          <ul className="space-y-1">
            {list
              .filter((c) => c.kind === kind)
              .map((c) => (
                <li key={c.characterId}>
                  <button
                    className="border-foreground/20 hover:bg-foreground/10 flex w-full flex-col border px-3 py-2 text-left"
                    onClick={() => {
                      edit({
                        kind: 'assign',
                        role,
                        characterId: c.characterId,
                      });
                      onDone();
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.disabled && <Chip tone="warn">{c.disabled}</Chip>}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {c.value}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {list.some((c) => c.kind === 'pc') && (
        <p className="text-muted-foreground text-xs">
          In play this is normally a Change Officer Role action.{' '}
          <button className="underline">Go to Activity</button>
        </p>
      )}
    </div>
  );
}

export function CharacterHeader({
  view,
  edit,
  section,
  onAdd,
  showArchived,
  setShowArchived,
}: {
  view: Projection;
  edit: Dispatch<COAction>;
  section: string | null;
  onAdd: () => void;
  showArchived: boolean;
  setShowArchived: (b: boolean) => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 className="text-lg font-semibold">Characters</h2>
      <span className="text-muted-foreground text-sm">
        {view.rows.length} on the roster · {view.offRoster.length} not
      </span>
      <label className="text-muted-foreground flex items-center gap-1 text-xs">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>
      <span className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus /> Add
        </Button>
        {!section && (
          <Button
            size="sm"
            onClick={() => edit({ kind: 'startEdit', section: 'roster' })}
          >
            Correct roster
          </Button>
        )}
      </span>
    </header>
  );
}

function RosterSwitch({
  view,
  edit,
  ch,
  rosterEditing,
}: {
  view: Projection;
  edit: Dispatch<COAction>;
  ch: Character;
  rosterEditing: boolean;
}) {
  const r = view.rows.find((x) => x.character.id === ch.id);
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        role="switch"
        className="size-4"
        checked={!!r}
        disabled={!rosterEditing}
        onChange={(e) =>
          e.target.checked
            ? edit({ kind: 'join', characterId: ch.id, kind_: ch.kind })
            : edit({ kind: 'leave', characterId: ch.id })
        }
      />
      <span className="text-muted-foreground text-xs">
        {r ? 'On roster' : 'Not on roster'}
      </span>
    </label>
  );
}

function HitDice({
  view,
  edit,
  ch,
  rosterEditing,
}: {
  view: Projection;
  edit: Dispatch<COAction>;
  ch: Character;
  rosterEditing: boolean;
}) {
  const r = view.rows.find((x) => x.character.id === ch.id);
  if (!r) return <>{hitDiceText(ch, view.kindOf(ch.id), null)}</>;
  if (!rosterEditing) return <>{r.hitDiceShown}</>;
  return (
    <>
      <input
        type="number"
        min={0}
        placeholder={`${ch.level}`}
        value={r.person.hitDice ?? ''}
        onChange={(e) =>
          edit({
            kind: 'setHitDice',
            characterId: ch.id,
            hitDice: e.target.value === '' ? null : Number(e.target.value),
          })
        }
        className="border-input bg-background h-7 w-16 border px-1"
      />{' '}
      HD
    </>
  );
}

/** The settled table (tablet and up). */
export function CharacterTable({
  view,
  edit,
  everyone,
  rosterEditing,
  onEdit,
  onJump,
}: {
  view: Projection;
  edit: Dispatch<COAction>;
  everyone: Character[];
  rosterEditing: boolean;
  onEdit: (c: Character) => void;
  onJump: (r: Role) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-muted-foreground text-left text-xs tracking-widest uppercase">
        <tr className="border-foreground/20 border-b">
          <th className="py-1 pr-2">On roster</th>
          <th className="py-1 pr-2">Character</th>
          <th className="py-1 pr-2">Kind</th>
          <th className="py-1 pr-2">Hit Dice</th>
          <th className="py-1 pr-2">Officer roles</th>
          <th className="py-1 pr-2">Teams</th>
          <th />
        </tr>
      </thead>
      <tbody className="divide-foreground/10 divide-y">
        {everyone.map((ch) => {
          const r = view.rows.find((x) => x.character.id === ch.id);
          return (
            <tr
              key={ch.id}
              className={cn('align-top', ch.archived && 'opacity-60')}
            >
              <td className="py-2 pr-2">
                <RosterSwitch
                  view={view}
                  edit={edit}
                  ch={ch}
                  rosterEditing={rosterEditing}
                />
              </td>
              <td className="py-2 pr-2">
                <span className="font-semibold">{ch.name}</span>
                {ch.archived && (
                  <Chip tone="warn" className="ml-1">
                    archived
                  </Chip>
                )}
                {r?.warnings.map((w) => (
                  <Warn key={w}>{w}</Warn>
                ))}
              </td>
              <td className="py-2 pr-2">
                <KindChip kind={view.kindOf(ch.id)} />
              </td>
              <td className="py-2 pr-2 font-mono text-xs">
                <HitDice
                  view={view}
                  edit={edit}
                  ch={ch}
                  rosterEditing={rosterEditing}
                />
              </td>
              <td className="py-2 pr-2">
                {r ? (
                  <RoleChips roles={r.roles} onJump={onJump} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 pr-2">
                {r ? (
                  <ManagesLine manages={r.manages} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-1 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(ch)}
                  aria-label={`Edit ${ch.name}`}
                >
                  <Pencil />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** One character as a card (phone). `dense` packs it into two lines. */
export function CharacterCard({
  view,
  edit,
  ch,
  rosterEditing,
  onEdit,
  onJump,
  dense,
}: {
  view: Projection;
  edit: Dispatch<COAction>;
  ch: Character;
  rosterEditing: boolean;
  onEdit: (c: Character) => void;
  onJump: (r: Role) => void;
  dense?: boolean;
}) {
  const r = view.rows.find((x) => x.character.id === ch.id);
  return (
    <li
      className={cn(
        'space-y-1.5 px-3 py-2',
        !dense && 'bg-card border-foreground/20 border',
        ch.archived && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 font-semibold">
          {ch.name}
          {ch.archived && (
            <Chip tone="warn" className="ml-1">
              archived
            </Chip>
          )}
        </span>
        <KindChip kind={view.kindOf(ch.id)} />
        <span className="font-mono text-xs">
          <HitDice
            view={view}
            edit={edit}
            ch={ch}
            rosterEditing={rosterEditing}
          />
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(ch)}
          aria-label={`Edit ${ch.name}`}
        >
          <Pencil />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {rosterEditing || !dense ? (
          <RosterSwitch
            view={view}
            edit={edit}
            ch={ch}
            rosterEditing={rosterEditing}
          />
        ) : null}
        {r ? (
          <>
            <RoleChips roles={r.roles} onJump={onJump} />
            <ManagesLine manages={r.manages} />
          </>
        ) : (
          <span className="text-muted-foreground text-xs">
            Not on the roster
          </span>
        )}
      </div>
      {r?.warnings.map((w) => (
        <Warn key={w}>{w}</Warn>
      ))}
    </li>
  );
}

const quickReasons = [
  'Story change',
  'Fixing a mistake',
  'New officer joined',
  'Character left',
];

/** The sticky reason bar for an open correction, wrapping on a phone. */
export function ReasonBarResponsive({
  view,
  edit,
  inline,
}: {
  view: Projection;
  edit: Dispatch<COAction>;
  inline?: boolean;
}) {
  const e = view.state.edit;
  if (!e) return null;
  const label = {
    officers: 'Correcting officers',
    roster: 'Correcting the roster',
    both: 'Correcting people & officers',
  }[e.section];
  return (
    <div
      className={cn(
        'bg-background/95 border-foreground/30 border-t px-4 py-3 backdrop-blur',
        inline ? 'sticky bottom-0 z-20' : 'fixed inset-x-0 bottom-0 z-20 pb-14',
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        {e.conflict && (
          <div
            className="border-destructive/60 border p-2 text-sm"
            role="alert"
          >
            Another player changed the officers while you were editing: Kess is
            now the Spymaster. Their change is shown; check your edits and save
            again.
          </div>
        )}
        {view.strategistPreview && (
          <p className="text-sm text-sky-300">{view.strategistPreview}</p>
        )}
        {view.saveWarnings.map((w) => (
          <Warn key={w}>{w}</Warn>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs tracking-widest whitespace-nowrap uppercase">
            {label}
          </span>
          <Input
            placeholder="Reason (required)"
            value={e.reason}
            onChange={(ev) =>
              edit({ kind: 'setReason', reason: ev.target.value })
            }
            className="min-w-40 flex-1 md:max-w-md"
          />
          <span className="flex flex-wrap gap-1">
            {quickReasons.map((q) => (
              <Chip
                key={q}
                onClick={() => edit({ kind: 'setReason', reason: q })}
              >
                {q}
              </Chip>
            ))}
          </span>
          <span className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => edit({ kind: 'cancelEdit' })}
            >
              <X /> Cancel
            </Button>
            <Button
              size="sm"
              disabled={!e.reason.trim()}
              onClick={() => edit({ kind: 'save' })}
            >
              Save correction
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}

export { PendingLine, roleLabel };

// ============================================================ Finished weeks

export function WeekRow({
  w,
  active,
  onSelect,
  chevron,
  preview,
}: {
  w: WeekRecord;
  active: boolean;
  onSelect: () => void;
  chevron?: boolean;
  preview?: boolean;
}) {
  const eff = effectiveEntry(w);
  return (
    <li>
      <button
        aria-current={active ? 'page' : undefined}
        onClick={onSelect}
        className={cn(
          'w-full space-y-0.5 border px-2 py-1.5 text-left',
          active
            ? 'bg-primary text-primary-foreground border-primary'
            : 'hover:border-foreground/25 border-transparent',
        )}
      >
        <span className="flex items-center justify-between">
          <span className="text-sm font-semibold">Week {w.week}</span>
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              active ? 'opacity-80' : 'text-muted-foreground',
            )}
          >
            {shortDate(eff.recordedAt)}
            {chevron && <ChevronRight className="size-4 opacity-60" />}
          </span>
        </span>
        <span
          className={cn(
            'block truncate text-xs',
            active ? 'opacity-80' : 'text-muted-foreground',
          )}
        >
          {(preview ? w.headline : w.headline.slice(0, 2)).join(' · ')}
        </span>
        {(w.entries.length > 1 || eff.provenance !== 'confirmation') && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              active ? 'opacity-80' : 'text-muted-foreground',
            )}
          >
            <History className="size-3" />
            {w.entries.length > 1
              ? `corrected · ${w.entries.length} entries`
              : 'reconstructed'}
          </span>
        )}
      </button>
    </li>
  );
}

export function EntriesList({ fw }: { fw: Props['fw'] }) {
  const { record, entry, select } = fw;
  return (
    <ol
      aria-label="Entries for this week"
      className="bg-card border-foreground/20 divide-foreground/10 divide-y border"
    >
      {[...record.entries].reverse().map((e) => {
        const current = e.recordId === entry.recordId;
        const eff = isEffective(record, e);
        return (
          <li key={e.recordId}>
            <button
              aria-current={current ? 'true' : undefined}
              onClick={() =>
                select({
                  week: record.week,
                  recordId: eff ? undefined : e.recordId,
                })
              }
              className={cn(
                'flex w-full flex-wrap items-baseline gap-2 px-3 py-2 text-left text-sm',
                current && 'bg-foreground/5',
              )}
            >
              <span className="text-muted-foreground w-14 font-mono text-xs">
                Entry {e.sequence + 1}
              </span>
              <span className="font-medium">
                {provenanceLabels[e.provenance]}
              </span>
              <span className="text-muted-foreground">
                {shortDate(e.recordedAt)} · Ruleset {e.rulesetVersion}
              </span>
              {eff && <FwChip tone="change">effective</FwChip>}
              {current && !eff && <FwChip tone="warn">showing</FwChip>}
            </button>
          </li>
        );
      })}
      {record.entries.length > 5 && (
        <li>
          <button className="text-muted-foreground w-full px-3 py-2 text-left text-sm underline">
            Earlier entries
          </button>
        </li>
      )}
    </ol>
  );
}

/** The six numbered sections and the footer line. */
export function RecordBody({ record }: { record: WeekRecord }) {
  return (
    <>
      {phases.map((p, i) => (
        <PhaseSection key={p} record={record} phase={p} n={i + 1} />
      ))}
      <AdjustmentsSection record={record} n={5} />
      <div className="overflow-x-auto">
        <ResultTable record={record} n={6} />
      </div>
      <ReadOnlyNote />
    </>
  );
}

export { currentWeek, ProvenanceLine };

// ============================================================ Campaigns

export function CampaignRow({
  c,
  active,
  onSelect,
  chevron,
}: {
  c: Campaign;
  active: boolean;
  onSelect: () => void;
  chevron?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center rounded-md border-l-4 border-transparent px-3 py-2.5 text-left',
        active
          ? 'bg-background border-primary shadow-sm'
          : 'hover:bg-background/50',
      )}
    >
      <span className="flex-1">
        <span className="block">{c.name}</span>
        <span className="text-muted-foreground block text-sm">
          {statusLine(c)}
        </span>
      </span>
      {chevron && <ChevronRight className="size-4 opacity-50" />}
    </button>
  );
}

export function NewCampaign({
  ch,
  onDone,
  onCancel,
}: {
  ch: Props['ch'];
  onDone: (c: Campaign) => void;
  onCancel?: () => void;
}) {
  const empty = ch.campaigns.length === 0;
  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-2xl">
        {empty ? 'Create a campaign to get started.' : 'New campaign'}
      </h2>
      <CreateFields
        multiline
        onCreate={(n, d) => onDone(ch.create(n, d))}
        onCancel={empty ? undefined : onCancel}
      />
    </div>
  );
}

/** The campaign home pane from #118 variant B. `go` lands on the other pages of this prototype. */
export function CampaignPane({
  c,
  go,
  update,
  compact,
}: {
  c: Campaign;
  go: Props['go'];
  update: Props['ch']['update'];
  compact?: boolean;
}) {
  const m = c.militia;
  const [editing, setEditing] = useState(false);
  return (
    <div className={cn('space-y-5', !compact && 'max-w-3xl space-y-6')}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className={compact ? 'text-2xl' : 'text-3xl'}>{c.name}</h2>
          {c.inGameDate && (
            <Badge variant="outline">{formatInGameDate(c.inGameDate)}</Badge>
          )}
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setEditing(true)}
            >
              <Pencil /> Edit
            </Button>
          )}
        </div>
        {editing ? (
          <EditDetails
            campaign={c}
            onSave={(patch) => {
              update(c.id, patch);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          c.description && (
            <p className="text-muted-foreground max-w-prose">{c.description}</p>
          )
        )}
      </header>
      {m ? (
        <Button
          size="lg"
          className={cn('h-12 px-6 text-base', compact && 'w-full')}
          onClick={() => go('militia')}
        >
          Continue week {m.week} <ChevronRight />
        </Button>
      ) : (
        <Button
          size="lg"
          className={cn('h-12 px-6 text-base', compact && 'w-full')}
          onClick={() => go('setup')}
        >
          Set up militia <ChevronRight />
        </Button>
      )}
      {m && (
        <Card className="gap-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm tracking-wide uppercase">Militia</h3>
            <Button variant="link" size="sm" onClick={() => go('militia')}>
              Open militia
            </Button>
          </div>
          <p className="text-sm">{militiaLine(m)}</p>
          <p className="text-muted-foreground text-xs">
            Continues at {continuePhase(m)}.
          </p>
        </Card>
      )}
      {m && (
        <Card className="gap-2 p-4">
          <h3 className="text-sm tracking-wide uppercase">
            Recent finished weeks
          </h3>
          {m.finished.length === 0 ? (
            <p className="text-muted-foreground">No finished weeks yet</p>
          ) : (
            <ul>
              {m.finished.slice(0, 3).map((w) => (
                <li key={w.week}>
                  <button
                    className="hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
                    onClick={() => go('history')}
                  >
                    <History className="size-4 opacity-60" />
                    Week {w.week}
                    {provenanceBadge[w.provenance] && (
                      <Badge variant="secondary">
                        {provenanceBadge[w.provenance]}
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {m.finished.length > 3 && (
            <Button
              variant="link"
              size="sm"
              className="self-start"
              onClick={() => go('history')}
            >
              All finished weeks
            </Button>
          )}
        </Card>
      )}
      <Button
        variant="outline"
        className={cn(compact && 'w-full')}
        onClick={() => go('characters')}
      >
        <Users /> {m ? 'Characters & officers' : 'Characters'}
      </Button>
    </div>
  );
}

function EditDetails({
  campaign: c,
  onSave,
  onCancel,
}: {
  campaign: Campaign;
  onSave: (patch: { description: string; inGameDate?: string }) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(c.description);
  const [date, setDate] = useState(c.inGameDate ?? '');
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          description: description.trim(),
          inGameDate: date || undefined,
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="edit-description">Description</Label>
        <textarea
          id="edit-description"
          autoFocus
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border-input focus-visible:border-ring rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
        />
      </div>
      <div className="grid gap-2">
        <Label>In-game date</Label>
        <FantasyDatePicker
          value={date}
          onChange={setDate}
          ariaLabel="In-game date"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
