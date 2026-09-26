'use client';
// PROTOTYPE — the settled tablet layouts (index and detail from #113, #117,
// #118; role cards over a table from #114). Not under review. Each variant
// passes what its desktop adds: an extra column, a wider index with previews,
// a capped detail width, or a role rail.

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  Lock,
  Pencil,
  Plus,
} from 'lucide-react';
import type { Dispatch, ReactNode } from 'react';
import { useState } from 'react';
import type {
  Action as COAction,
  Character,
  Projection,
  Role,
} from '~/components/characters-officers-prototype/mock';
import {
  CharacterDialog,
  RoleCard,
} from '~/components/characters-officers-prototype/parts';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  CampaignPane,
  CampaignRow,
  CharacterHeader,
  CharacterTable,
  currentWeek,
  EntriesList,
  MilitiaCorrectButton,
  MilitiaEditor,
  militiaTitle,
  militiaItems,
  MilitiaRead,
  NewCampaign,
  PendingLine,
  ProvenanceLine,
  RecordBody,
  rowClass,
  SetupNext,
  SetupStepDetail,
  SetupStepRow,
  StartingPoint,
  WeekRow,
  type MilitiaKey,
  type Props,
  type SetupModel,
} from './content';

export function IndexDetail({
  index,
  detail,
  aside,
  indexClass,
  detailClass,
  footer,
  header,
  wrap,
}: {
  index: ReactNode;
  detail: ReactNode;
  aside?: ReactNode;
  indexClass?: string;
  detailClass?: string;
  footer?: ReactNode;
  header?: ReactNode;
  wrap?: string;
}) {
  return (
    <div
      className={cn(
        'grid flex-1 grid-cols-[15rem_1fr]',
        aside && 'xl:grid-cols-[15rem_1fr_18rem]',
        wrap,
      )}
    >
      <aside className={cn('bg-sidebar/40 border-r p-3', indexClass)}>
        {index}
      </aside>
      <div className="flex min-w-0 flex-col">
        {header}
        <div className={cn('flex-1 space-y-4 p-5', detailClass)}>{detail}</div>
        {footer}
      </div>
      {aside && (
        <aside className="bg-sidebar/20 hidden border-l p-4 xl:block">
          {aside}
        </aside>
      )}
    </div>
  );
}

// ---------- Setup ----------

export function WideSetup({
  props,
  m,
  onGo,
  aside,
  indexClass,
  detailClass,
  wrap,
  preview,
}: {
  props: Props;
  m: SetupModel;
  onGo: (i: number) => void;
  aside?: ReactNode;
  indexClass?: string;
  detailClass?: string;
  wrap?: string;
  preview?: boolean;
}) {
  const { sc } = props;
  return (
    <IndexDetail
      wrap={wrap}
      indexClass={indexClass}
      detailClass={detailClass}
      aside={aside}
      index={
        <>
          <div className="mb-3">
            <StartingPoint sc={sc} />
          </div>
          <ol className="space-y-0.5">
            {m.steps.map((s) => (
              <SetupStepRow key={s.key} s={s} m={m} sc={sc} onGo={onGo} />
            ))}
          </ol>
          {preview && m.current.key !== 'review' && (
            <p className="text-muted-foreground mt-4 px-2 text-xs">
              {m.current.errors.length
                ? m.current.errors[0]!.text
                : m.current.warnings.length
                  ? m.current.warnings[0]!.text
                  : 'Nothing to fix on this step.'}
            </p>
          )}
        </>
      }
      detail={
        <>
          <h1 className="text-2xl">{m.current.label}</h1>
          <SetupStepDetail sc={sc} m={m} columns={2} onGo={onGo} />
        </>
      }
      footer={
        <footer className="bg-background sticky bottom-0 flex items-center justify-end gap-3 border-t px-5 py-3">
          <SetupNext props={props} m={m} onGo={onGo} />
        </footer>
      }
    />
  );
}

// ---------- Militia ----------

export function MilitiaIndex({
  sc,
  current,
  onPick,
  chevron,
  preview,
}: {
  sc: Props['sc'];
  current: MilitiaKey;
  onPick: (k: MilitiaKey) => void;
  chevron?: boolean;
  preview?: boolean;
}) {
  const { list, carried } = militiaItems(sc);
  const row = (i: (typeof list)[number]) => (
    <button
      key={i.key}
      disabled={i.disabled}
      onClick={() => onPick(i.key)}
      className={cn(rowClass(current === i.key), 'disabled:opacity-40')}
    >
      <span className="min-w-0 flex-1">
        <span className="block">{i.label}</span>
        {preview && i.summary && (
          <span className="block truncate text-xs opacity-70">{i.summary}</span>
        )}
      </span>
      {i.editing && <Pencil className="size-3.5" />}
      {i.warnings > 0 && (
        <span className="text-xs text-amber-300">{i.warnings} ⚠</span>
      )}
      {i.count !== null && (
        <span className="text-xs opacity-70">{i.count}</span>
      )}
      {chevron && <ChevronRight className="size-4 opacity-50" />}
    </button>
  );
  return (
    <>
      <ul className="space-y-0.5">
        {list.map((i) => (
          <li key={i.key}>{row(i)}</li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-4 mb-1 flex items-center gap-1 px-2 text-[11px] tracking-widest uppercase">
        <Lock className="size-3" /> Changes through the week
      </p>
      {row(carried)}
    </>
  );
}

export function WideMilitia({
  props,
  current,
  onPick,
  aside,
  indexClass,
  detailClass,
  wrap,
  preview,
}: {
  props: Props;
  current: MilitiaKey;
  onPick: (k: MilitiaKey) => void;
  aside?: ReactNode;
  indexClass?: string;
  detailClass?: string;
  wrap?: string;
  preview?: boolean;
}) {
  const { sc } = props;
  const editing =
    !!sc.state.correction && sc.state.correction.section === current;
  return (
    <IndexDetail
      wrap={wrap}
      indexClass={indexClass}
      detailClass={detailClass}
      aside={aside}
      index={
        <MilitiaIndex
          sc={sc}
          current={current}
          onPick={onPick}
          preview={preview}
        />
      }
      header={
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h1 className="text-2xl">{militiaTitle(sc, current)}</h1>
          <MilitiaCorrectButton sc={sc} current={current} />
        </div>
      }
      detail={
        editing ? (
          <MilitiaEditor sc={sc} columns={3} />
        ) : (
          <MilitiaRead sc={sc} current={current} />
        )
      }
    />
  );
}

// ---------- Characters & officers ----------

export type CharactersState = {
  assigning: Role | null;
  setAssigning: (r: Role | null) => void;
  record: Character | 'new' | null;
  setRecord: (c: Character | 'new' | null) => void;
  showArchived: boolean;
  setShowArchived: (b: boolean) => void;
};

export function useCharactersState(): CharactersState {
  const [assigning, setAssigning] = useState<Role | null>(null);
  const [record, setRecord] = useState<Character | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  return {
    assigning,
    setAssigning,
    record,
    setRecord,
    showArchived,
    setShowArchived,
  };
}

export const jumpToRole = (r: Role) =>
  document
    .getElementById(`role-${r}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

export function OfficersHeader({
  view,
  edit,
  section,
}: {
  view: Projection;
  edit: Dispatch<COAction>;
  section: string | null;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 className="text-lg font-semibold">Officers</h2>
      <span className="text-muted-foreground text-sm">
        Focus: {view.state.focus}
      </span>
      {!section && (
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => edit({ kind: 'startEdit', section: 'officers' })}
        >
          Correct officers
        </Button>
      )}
    </header>
  );
}

/** Tablet: six role cards 3×2 over the table. `rail` (desktop, variant B) stacks the cards down the left instead. */
export function WideCharacters({
  props,
  cs,
  rail,
  wrap,
}: {
  props: Props;
  cs: CharactersState;
  rail?: boolean;
  wrap?: string;
}) {
  const { view, edit } = props.co;
  const section = view.state.edit?.section ?? null;
  const officersEditing = section === 'officers';
  const rosterEditing = section === 'roster';
  const everyone = view.state.characters.filter(
    (c) => cs.showArchived || !c.archived,
  );
  const officers = (
    <section
      className={cn(
        'space-y-3',
        rosterEditing && 'pointer-events-none opacity-50',
      )}
    >
      <OfficersHeader view={view} edit={edit} section={section} />
      <div
        className={cn(
          'grid gap-3',
          rail ? 'grid-cols-3 xl:grid-cols-1' : 'grid-cols-3',
        )}
      >
        {view.roleViews.map((v) => (
          <RoleCard
            key={v.role}
            id={`role-${v.role}`}
            v={v}
            editing={officersEditing}
            edit={edit}
            onAssign={cs.setAssigning}
            compact={rail}
          />
        ))}
      </div>
    </section>
  );
  const characters = (
    <section
      className={cn(
        'space-y-3',
        officersEditing && 'pointer-events-none opacity-50',
      )}
    >
      <CharacterHeader
        view={view}
        edit={edit}
        section={section}
        onAdd={() => cs.setRecord('new')}
        showArchived={cs.showArchived}
        setShowArchived={cs.setShowArchived}
      />
      <PendingLine view={view} />
      <CharacterTable
        view={view}
        edit={edit}
        everyone={everyone}
        rosterEditing={rosterEditing}
        onEdit={cs.setRecord}
        onJump={jumpToRole}
      />
    </section>
  );
  return (
    <div className={cn('flex-1 px-5 py-4 pb-40', wrap)}>
      <div
        className={cn(
          rail ? 'grid gap-6 xl:grid-cols-[18rem_1fr]' : 'space-y-6',
        )}
      >
        {officers}
        {characters}
      </div>
      <CharacterDialog
        character={cs.record}
        view={view}
        edit={edit}
        onClose={() => cs.setRecord(null)}
      />
    </div>
  );
}

// ---------- Finished weeks ----------

export function WeekList({
  fw,
  chevron,
  preview,
}: {
  fw: Props['fw'];
  chevron?: boolean;
  preview?: boolean;
}) {
  return (
    <>
      <h2 className="text-muted-foreground mb-1 px-2 text-xs tracking-widest uppercase">
        Finished weeks
      </h2>
      <ol className="space-y-0.5">
        {fw.weeks.map((w) => (
          <WeekRow
            key={w.week}
            w={w}
            active={w.week === fw.record.week}
            onSelect={() => fw.select({ week: w.week })}
            chevron={chevron}
            preview={preview}
          />
        ))}
      </ol>
      <p className="text-muted-foreground mt-2 px-2 text-xs">
        Week {currentWeek} is in progress.
      </p>
    </>
  );
}

export function WeekArrows({
  fw,
  size = 'icon',
}: {
  fw: Props['fw'];
  size?: 'icon' | 'sm';
}) {
  const i = fw.weeks.findIndex((w) => w.week === fw.record.week);
  const prev = fw.weeks[i - 1];
  const next = fw.weeks[i + 1];
  return (
    <>
      <Button
        variant="outline"
        size={size}
        aria-label="Previous week"
        disabled={!prev}
        onClick={() => prev && fw.select({ week: prev.week })}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size={size}
        aria-label="Next week"
        disabled={!next}
        onClick={() => next && fw.select({ week: next.week })}
      >
        <ChevronRight />
      </Button>
    </>
  );
}

export function EntriesToggle({
  fw,
  open,
  onToggle,
}: {
  fw: Props['fw'];
  open: boolean;
  onToggle: () => void;
}) {
  if (fw.record.entries.length < 2) return null;
  return (
    <Button variant="outline" size="sm" aria-expanded={open} onClick={onToggle}>
      <History /> {fw.record.entries.length} entries{' '}
      <ChevronDown className={cn('transition', open && 'rotate-180')} />
    </Button>
  );
}

export function WideHistory({
  props,
  aside,
  indexClass,
  detailClass,
  wrap,
  preview,
}: {
  props: Props;
  aside?: ReactNode;
  indexClass?: string;
  detailClass?: string;
  wrap?: string;
  preview?: boolean;
}) {
  const { fw } = props;
  const [showEntries, setShowEntries] = useState(false);
  return (
    <IndexDetail
      wrap={wrap}
      indexClass={indexClass}
      detailClass={detailClass}
      aside={aside}
      index={<WeekList fw={fw} preview={preview} />}
      detail={
        <article className="space-y-4">
          <header className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <h1 className="text-2xl font-semibold">
                  Week {fw.record.week}
                </h1>
                <ProvenanceLine record={fw.record} entry={fw.entry} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!aside && (
                  <EntriesToggle
                    fw={fw}
                    open={showEntries}
                    onToggle={() => setShowEntries(!showEntries)}
                  />
                )}
                <WeekArrows fw={fw} />
              </div>
            </div>
            {showEntries && !aside && <EntriesList fw={fw} />}
          </header>
          <RecordBody record={fw.record} />
        </article>
      }
    />
  );
}

// ---------- Campaigns ----------

export function WideCampaigns({
  props,
  creating,
  setCreating,
  indexClass,
  wrap,
  preview,
}: {
  props: Props;
  creating: boolean;
  setCreating: (b: boolean) => void;
  indexClass?: string;
  wrap?: string;
  preview?: boolean;
}) {
  const { ch, go } = props;
  const selected =
    ch.campaigns.find((c) => c.id === ch.selectedId) ?? ch.campaigns[0];
  return (
    <div className={cn('flex min-h-0 flex-1', wrap)}>
      <aside className={cn('bg-sidebar w-80 shrink-0 border-r', indexClass)}>
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg">Campaigns</h1>
          {ch.campaigns.length > 0 && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="New campaign"
              onClick={() => setCreating(true)}
            >
              <Plus />
            </Button>
          )}
        </div>
        <nav className="space-y-1 px-2">
          {ch.campaigns.map((c) => (
            <div key={c.id}>
              <CampaignRow
                c={c}
                active={!creating && c.id === selected?.id}
                onSelect={() => {
                  setCreating(false);
                  ch.select(c.id);
                }}
              />
              {preview && c.description && (
                <p className="text-muted-foreground truncate px-4 pb-1 text-xs">
                  {c.description}
                </p>
              )}
            </div>
          ))}
          {ch.campaigns.length === 0 && (
            <p className="text-muted-foreground px-3 py-2">No campaigns yet</p>
          )}
          {creating && (
            <div className="bg-background border-primary rounded-md border-l-4 px-3 py-2.5 italic shadow-sm">
              New campaign
            </div>
          )}
        </nav>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto p-6">
        {creating || !selected ? (
          <NewCampaign
            ch={ch}
            onDone={(c) => {
              setCreating(false);
              ch.select(c.id);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <CampaignPane
            key={selected.id}
            c={selected}
            go={go}
            update={ch.update}
          />
        )}
      </section>
    </div>
  );
}

export const currentWeekLine = `Week ${currentWeek} is in progress.`;
