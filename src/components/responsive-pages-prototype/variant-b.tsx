'use client';
// PROTOTYPE — Variant B "Picker and drawers; desktop adds a column". On a
// phone the detail is always on screen; the index collapses into a picker
// button at the top that opens a bottom sheet, with previous/next beside it.
// Correction editors, Assign, the entries list and New campaign open as
// bottom sheets over the detail. Role cards become a swipeable strip and the
// character rows pack into two lines. Desktop adds a third column: problems
// across all Setup steps, Militia warnings and corrections, the entries of
// the shown week, and a role rail beside the character table.

import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import {
  CharacterDialog,
  RoleCard,
} from '~/components/characters-officers-prototype/parts';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  AssignList,
  CampaignPane,
  CampaignRow,
  CharacterCard,
  CharacterHeader,
  EntriesList,
  MilitiaAside,
  MilitiaCorrectButton,
  militiaCurrent,
  MilitiaEditor,
  MilitiaRead,
  militiaTitle,
  NewCampaign,
  PendingLine,
  ProvenanceLine,
  ReasonBarResponsive,
  RecordBody,
  roleLabel,
  SetupNext,
  SetupProblems,
  SetupStepDetail,
  SetupStepRow,
  StartingPoint,
  useSetup,
  WeekRow,
  type MilitiaKey,
  type Props,
} from './content';
import { BottomSheet, useWidth } from './primitives';
import {
  currentWeekLine,
  EntriesToggle,
  MilitiaIndex,
  OfficersHeader,
  useCharactersState,
  WideCampaigns,
  WideCharacters,
  WideHistory,
  WideMilitia,
  WideSetup,
} from './wide';

export const name = 'Picker and drawers; desktop adds a column';

export function VariantB(props: Props) {
  switch (props.page) {
    case 'setup':
      return <Setup {...props} />;
    case 'militia':
      return <Militia {...props} />;
    case 'characters':
      return <Characters {...props} />;
    case 'history':
      return <History {...props} />;
    default:
      return <Campaigns {...props} />;
  }
}

/** The phone header: a picker button that opens the index, with previous/next. */
function PickerBar({
  label,
  caption,
  onOpen,
  onPrev,
  onNext,
  action,
}: {
  label: React.ReactNode;
  caption?: React.ReactNode;
  onOpen: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-background sticky top-0 z-10 flex items-center gap-1 border-b px-2 py-1.5">
      <button
        aria-haspopup="dialog"
        onClick={onOpen}
        className="hover:bg-foreground/5 flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">
            {label}
          </span>
          {caption && (
            <span className="text-muted-foreground block truncate text-xs">
              {caption}
            </span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </button>
      {onPrev && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous"
          disabled={!onPrev}
          onClick={onPrev}
        >
          <ChevronLeft />
        </Button>
      )}
      {onNext !== undefined && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next"
          disabled={!onNext}
          onClick={onNext}
        >
          <ChevronRight />
        </Button>
      )}
      {action}
    </div>
  );
}

// ---------- Setup ----------

function Setup(props: Props) {
  const { sc } = props;
  const width = useWidth();
  const m = useSetup(sc);
  const [open, setOpen] = useState(false);
  const onGo = (step: number) => {
    sc.dispatch({ kind: 'setup:step', step });
    setOpen(false);
  };
  if (width !== 'phone')
    return (
      <WideSetup
        props={props}
        m={m}
        onGo={onGo}
        aside={<SetupProblems m={m} onGo={onGo} />}
      />
    );
  const i = m.current.index;
  return (
    <div className="flex flex-1 flex-col">
      <PickerBar
        label={m.current.label}
        caption={`Step ${i + 1} of ${m.steps.length}${m.current.caption ? ` · ${m.current.caption}` : ''}`}
        onOpen={() => setOpen(true)}
        onPrev={i > 0 ? () => onGo(i - 1) : undefined}
        onNext={i < m.steps.length - 1 ? () => onGo(i + 1) : undefined}
      />
      <div className="flex-1 space-y-4 p-4">
        <SetupStepDetail sc={sc} m={m} columns={2} onGo={onGo} />
      </div>
      <footer className="bg-background sticky bottom-0 flex items-center border-t px-4 py-3">
        <SetupNext props={props} m={m} onGo={onGo} className="w-full" />
      </footer>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Steps">
        <div className="space-y-3 p-3">
          <StartingPoint sc={sc} />
          <ol className="space-y-0.5">
            {m.steps.map((s) => (
              <SetupStepRow key={s.key} s={s} m={m} sc={sc} onGo={onGo} />
            ))}
          </ol>
        </div>
      </BottomSheet>
    </div>
  );
}

// ---------- Militia ----------

function Militia(props: Props) {
  const { sc } = props;
  const width = useWidth();
  const [picked, setPicked] = useState<MilitiaKey>('values');
  const [open, setOpen] = useState(false);
  const current = militiaCurrent(sc, picked);
  const editing =
    !!sc.state.correction && sc.state.correction.section === current;
  const onPick = (k: MilitiaKey) => {
    setPicked(k);
    setOpen(false);
  };
  if (width !== 'phone')
    return (
      <WideMilitia
        props={props}
        current={current}
        onPick={onPick}
        aside={<MilitiaAside sc={sc} onPick={onPick} />}
      />
    );
  return (
    <div className="flex flex-1 flex-col">
      <PickerBar
        label={militiaTitle(sc, current)}
        caption="Militia"
        onOpen={() => setOpen(true)}
        action={<MilitiaCorrectButton sc={sc} current={current} size="sm" />}
      />
      <div className="flex-1 space-y-4 p-4">
        <MilitiaRead sc={sc} current={current} dense />
      </div>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Militia sections"
      >
        <div className="p-3">
          <MilitiaIndex sc={sc} current={current} onPick={onPick} />
        </div>
      </BottomSheet>
      <BottomSheet
        open={editing}
        tall
        onClose={() => sc.dispatch({ kind: 'correct:cancel' })}
        title={`Correct ${militiaTitle(sc, current).toLowerCase()}`}
      >
        <div className="p-4">
          <MilitiaEditor sc={sc} columns={2} />
        </div>
      </BottomSheet>
    </div>
  );
}

// ---------- Characters & officers ----------

function Characters(props: Props) {
  const width = useWidth();
  const cs = useCharactersState();
  const { view, edit } = props.co;
  const section = view.state.edit?.section ?? null;
  const officersEditing = section === 'officers';
  const rosterEditing = section === 'roster';
  const assign = (
    <BottomSheet
      open={!!cs.assigning}
      onClose={() => cs.setAssigning(null)}
      title={cs.assigning ? `Assign ${roleLabel[cs.assigning]}` : ''}
    >
      {cs.assigning && (
        <AssignList
          role={cs.assigning}
          view={view}
          edit={edit}
          onDone={() => cs.setAssigning(null)}
        />
      )}
    </BottomSheet>
  );
  if (width !== 'phone')
    return (
      <>
        <WideCharacters props={props} cs={cs} rail />
        {assign}
        <ReasonBarResponsive view={view} edit={edit} />
      </>
    );
  const everyone = view.state.characters.filter(
    (c) => cs.showArchived || !c.archived,
  );
  return (
    <div className="flex-1 space-y-6 py-4 pb-48">
      <section
        className={cn(
          'space-y-2',
          rosterEditing && 'pointer-events-none opacity-50',
        )}
      >
        <div className="px-3">
          <OfficersHeader view={view} edit={edit} section={section} />
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2">
          {view.roleViews.map((v) => (
            <div
              key={v.role}
              id={`role-${v.role}`}
              className="w-[78vw] shrink-0 snap-center [&>section]:h-full"
            >
              <RoleCard
                v={v}
                editing={officersEditing}
                edit={edit}
                onAssign={cs.setAssigning}
              />
            </div>
          ))}
        </div>
        <p className="text-muted-foreground px-3 text-center text-xs">
          Swipe for more roles
        </p>
      </section>
      <section
        className={cn(
          'space-y-2 px-3',
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
        <ul className="bg-card border-foreground/20 divide-foreground/10 divide-y border">
          {everyone.map((ch) => (
            <CharacterCard
              key={ch.id}
              dense
              view={view}
              edit={edit}
              ch={ch}
              rosterEditing={rosterEditing}
              onEdit={cs.setRecord}
              onJump={(r) =>
                document.getElementById(`role-${r}`)?.scrollIntoView({
                  behavior: 'smooth',
                  inline: 'center',
                  block: 'nearest',
                })
              }
            />
          ))}
        </ul>
      </section>
      <CharacterDialog
        character={cs.record}
        view={view}
        edit={edit}
        onClose={() => cs.setRecord(null)}
      />
      {assign}
      <ReasonBarResponsive view={view} edit={edit} />
    </div>
  );
}

// ---------- Finished weeks ----------

function History(props: Props) {
  const { fw } = props;
  const width = useWidth();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(false);
  if (width !== 'phone')
    return (
      <WideHistory
        props={props}
        aside={
          <div className="space-y-2">
            <h2 className="text-muted-foreground text-xs tracking-widest uppercase">
              Entries for week {fw.record.week}
            </h2>
            {fw.record.entries.length > 1 ? (
              <EntriesList fw={fw} />
            ) : (
              <p className="text-muted-foreground text-sm">
                One entry, from confirmation.
              </p>
            )}
          </div>
        }
      />
    );
  const i = fw.weeks.findIndex((w) => w.week === fw.record.week);
  const prev = fw.weeks[i - 1];
  const next = fw.weeks[i + 1];
  return (
    <div className="flex flex-1 flex-col">
      <PickerBar
        label={`Week ${fw.record.week}`}
        caption="Finished weeks"
        onOpen={() => setOpen(true)}
        onPrev={prev ? () => fw.select({ week: prev.week }) : undefined}
        onNext={next ? () => fw.select({ week: next.week }) : undefined}
      />
      <article className="flex-1 space-y-4 p-4">
        <ProvenanceLine record={fw.record} entry={fw.entry} />
        <EntriesToggle
          fw={fw}
          open={entries}
          onToggle={() => setEntries(true)}
        />
        <RecordBody record={fw.record} />
      </article>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Finished weeks"
      >
        <ol className="space-y-0.5 p-3">
          {fw.weeks.map((w) => (
            <WeekRow
              key={w.week}
              w={w}
              active={w.week === fw.record.week}
              onSelect={() => {
                fw.select({ week: w.week });
                setOpen(false);
              }}
            />
          ))}
        </ol>
        <p className="text-muted-foreground px-5 pb-4 text-xs">
          {currentWeekLine}
        </p>
      </BottomSheet>
      <BottomSheet
        open={entries}
        onClose={() => setEntries(false)}
        title={`Entries for week ${fw.record.week}`}
      >
        <div className="p-3" onClick={() => setEntries(false)}>
          <EntriesList fw={fw} />
        </div>
      </BottomSheet>
    </div>
  );
}

// ---------- Campaigns ----------

function Campaigns(props: Props) {
  const { ch, go } = props;
  const width = useWidth();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const selected =
    ch.campaigns.find((c) => c.id === ch.selectedId) ?? ch.campaigns[0];
  if (width !== 'phone')
    return (
      <WideCampaigns
        props={props}
        creating={creating}
        setCreating={setCreating}
      />
    );
  return (
    <div className="flex flex-1 flex-col">
      <PickerBar
        label={selected?.name ?? 'Campaigns'}
        caption={selected ? `${ch.campaigns.length} campaigns` : undefined}
        onOpen={() => setOpen(true)}
        action={
          <Button
            variant="ghost"
            size="icon"
            aria-label="New campaign"
            onClick={() => setCreating(true)}
          >
            <Plus />
          </Button>
        }
      />
      <div className="flex-1 p-4">
        {selected ? (
          <CampaignPane
            key={selected.id}
            c={selected}
            go={go}
            update={ch.update}
            compact
          />
        ) : (
          <NewCampaign ch={ch} onDone={(c) => ch.select(c.id)} />
        )}
      </div>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Campaigns">
        <nav className="space-y-1 p-3">
          {ch.campaigns.map((c) => (
            <CampaignRow
              key={c.id}
              c={c}
              active={c.id === selected?.id}
              onSelect={() => {
                ch.select(c.id);
                setOpen(false);
              }}
            />
          ))}
        </nav>
      </BottomSheet>
      <BottomSheet
        open={creating}
        tall
        onClose={() => setCreating(false)}
        title="New campaign"
      >
        <div className="p-4">
          <NewCampaign
            ch={ch}
            onDone={(c) => {
              setCreating(false);
              ch.select(c.id);
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      </BottomSheet>
    </div>
  );
}
