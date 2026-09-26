'use client';
// PROTOTYPE — Variant C "Stacked". On a phone the index and the detail are
// one scrolling page: every step, section, week or campaign is a row that
// expands in place, and only one is open. Corrections, Assign and New
// campaign all edit inline inside the open row, with the reason bar stuck
// to the bottom. Role cards go two across and the character table becomes
// cards. Desktop keeps the two panes but widens the index and puts a preview
// line under each row, with the whole page centred.

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Lock,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
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
  CharacterCard,
  CharacterHeader,
  EntriesList,
  MilitiaCorrectButton,
  militiaCurrent,
  MilitiaEditor,
  militiaItems,
  MilitiaRead,
  NewCampaign,
  PendingLine,
  ProvenanceLine,
  ReasonBarResponsive,
  RecordBody,
  roleLabel,
  SetupNext,
  SetupStepDetail,
  StartingPoint,
  StepIcon,
  useSetup,
  type MilitiaKey,
  type Props,
} from './content';
import { AccordionRow, useWidth } from './primitives';
import {
  currentWeekLine,
  EntriesToggle,
  OfficersHeader,
  useCharactersState,
  WideCampaigns,
  WideCharacters,
  WideHistory,
  WideMilitia,
  WideSetup,
} from './wide';

export const name = 'Stacked; desktop widens the index with previews';

const centred = 'mx-auto w-full max-w-7xl';

export function VariantC(props: Props) {
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

const Caret = ({ open }: { open: boolean }) => (
  <ChevronDown
    className={cn(
      'size-4 shrink-0 opacity-60 transition',
      open && 'rotate-180',
    )}
  />
);

// ---------- Setup ----------

function Setup(props: Props) {
  const { sc } = props;
  const width = useWidth();
  const m = useSetup(sc);
  const onGo = (step: number) => sc.dispatch({ kind: 'setup:step', step });
  if (width !== 'phone')
    return (
      <WideSetup
        props={props}
        m={m}
        onGo={onGo}
        wrap={cn(centred, 'xl:grid-cols-[20rem_1fr]')}
        preview
      />
    );
  return (
    <div className="flex-1">
      <div className="space-y-2 p-3">
        <h1 className="px-1 text-2xl">Set up militia</h1>
        <StartingPoint sc={sc} />
      </div>
      <ol>
        {m.steps.map((s) => {
          const open = s.index === m.current.index;
          return (
            <AccordionRow
              key={s.key}
              open={open}
              onToggle={() => onGo(s.index)}
              head={
                <>
                  <StepIcon s={s} attempted={sc.state.setup.attempted} />
                  <span className="flex-1">
                    {s.index + 1}. {s.label}
                  </span>
                  <span className="text-xs opacity-70">{s.caption}</span>
                  <Caret open={open} />
                </>
              }
            >
              <SetupStepDetail sc={sc} m={m} columns={2} onGo={onGo} />
              <SetupNext props={props} m={m} onGo={onGo} className="w-full" />
            </AccordionRow>
          );
        })}
      </ol>
    </div>
  );
}

// ---------- Militia ----------

function Militia(props: Props) {
  const { sc } = props;
  const width = useWidth();
  const [picked, setPicked] = useState<MilitiaKey>('values');
  const current = militiaCurrent(sc, picked);
  if (width !== 'phone')
    return (
      <WideMilitia
        props={props}
        current={current}
        onPick={setPicked}
        wrap={cn(centred, 'xl:grid-cols-[20rem_1fr]')}
        preview
      />
    );
  const { list, carried } = militiaItems(sc);
  const row = (i: (typeof list)[number]) => {
    const open = current === i.key;
    const editing =
      open && !!sc.state.correction && sc.state.correction.section === i.key;
    return (
      <AccordionRow
        key={i.key}
        open={open}
        onToggle={() =>
          !i.disabled &&
          setPicked(open && !editing ? ('__none' as MilitiaKey) : i.key)
        }
        className={cn(i.disabled && 'opacity-40')}
        head={
          <>
            <span className="flex-1">{i.label}</span>
            {i.editing && <Pencil className="size-3.5" />}
            {i.warnings > 0 && (
              <AlertTriangle className="size-3.5 text-amber-300" />
            )}
            {i.count !== null && (
              <span className="text-xs opacity-70">{i.count}</span>
            )}
            <Caret open={open} />
          </>
        }
      >
        {editing ? (
          <MilitiaEditor sc={sc} columns={2} />
        ) : (
          <>
            <MilitiaRead sc={sc} current={i.key} dense />
            <MilitiaCorrectButton sc={sc} current={i.key} />
          </>
        )}
      </AccordionRow>
    );
  };
  return (
    <div className="flex-1">
      <h1 className="px-4 pt-3 pb-1 text-2xl">Militia</h1>
      <ul>{list.map(row)}</ul>
      <p className="text-muted-foreground mt-4 mb-1 flex items-center gap-1 px-4 text-[11px] tracking-widest uppercase">
        <Lock className="size-3" /> Changes through the week
      </p>
      <ul>{row(carried)}</ul>
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
  const assign = cs.assigning && (
    <section className="border-primary bg-card border-2">
      <header className="flex items-center gap-2 px-3 pt-3">
        <h3 className="flex-1 font-semibold">
          Assign {roleLabel[cs.assigning]}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={() => cs.setAssigning(null)}
        >
          <X />
        </Button>
      </header>
      <AssignList
        role={cs.assigning}
        view={view}
        edit={edit}
        onDone={() => cs.setAssigning(null)}
      />
    </section>
  );
  if (width !== 'phone')
    return (
      <>
        <WideCharacters
          props={props}
          cs={cs}
          wrap={cn(
            centred,
            cs.assigning && '[&_.grid-cols-3]:grid-cols-[1fr_1fr_1fr_20rem]',
          )}
        />
        {assign && (
          <div className="fixed right-4 bottom-20 z-30 w-96 shadow-2xl">
            {assign}
          </div>
        )}
        <ReasonBarResponsive view={view} edit={edit} />
      </>
    );
  const everyone = view.state.characters.filter(
    (c) => cs.showArchived || !c.archived,
  );
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-6 px-3 py-4">
        <section
          className={cn(
            'space-y-3',
            rosterEditing && 'pointer-events-none opacity-50',
          )}
        >
          <OfficersHeader view={view} edit={edit} section={section} />
          <div className="grid grid-cols-2 gap-2">
            {view.roleViews.map((v) => (
              <RoleCard
                key={v.role}
                id={`role-${v.role}`}
                v={v}
                editing={officersEditing}
                edit={edit}
                onAssign={cs.setAssigning}
                compact
              />
            ))}
          </div>
          {assign}
        </section>
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
          <ul className="space-y-2">
            {everyone.map((ch) => (
              <CharacterCard
                key={ch.id}
                view={view}
                edit={edit}
                ch={ch}
                rosterEditing={rosterEditing}
                onEdit={cs.setRecord}
                onJump={(r) =>
                  document
                    .getElementById(`role-${r}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
      </div>
      <ReasonBarResponsive view={view} edit={edit} inline />
    </div>
  );
}

// ---------- Finished weeks ----------

function History(props: Props) {
  const { fw } = props;
  const width = useWidth();
  const [entries, setEntries] = useState(false);
  const [openWeek, setOpenWeek] = useState<number | null>(fw.record.week);
  if (width !== 'phone')
    return (
      <WideHistory
        props={props}
        wrap={cn(centred, 'xl:grid-cols-[20rem_1fr]')}
        preview
      />
    );
  return (
    <div className="flex-1">
      <h1 className="px-4 pt-3 pb-1 text-2xl">Finished weeks</h1>
      <ol>
        {fw.weeks.map((w) => {
          const open = openWeek === w.week && fw.record.week === w.week;
          return (
            <AccordionRow
              key={w.week}
              open={open}
              onToggle={() => {
                if (open) return setOpenWeek(null);
                fw.select({ week: w.week });
                setOpenWeek(w.week);
              }}
              head={
                <>
                  <span className="flex-1 font-semibold">Week {w.week}</span>
                  <span className="truncate text-xs opacity-70">
                    {w.headline[0]}
                  </span>
                  {w.entries.length > 1 && (
                    <span className="text-xs opacity-70">
                      {w.entries.length} entries
                    </span>
                  )}
                  <Caret open={open} />
                </>
              }
            >
              <ProvenanceLine record={fw.record} entry={fw.entry} />
              <EntriesToggle
                fw={fw}
                open={entries}
                onToggle={() => setEntries(!entries)}
              />
              {entries && <EntriesList fw={fw} />}
              <RecordBody record={fw.record} />
            </AccordionRow>
          );
        })}
      </ol>
      <p className="text-muted-foreground px-4 py-3 text-xs">
        {currentWeekLine}
      </p>
    </div>
  );
}

// ---------- Campaigns ----------

function Campaigns(props: Props) {
  const { ch, go } = props;
  const width = useWidth();
  const [creating, setCreating] = useState(false);
  if (width !== 'phone')
    return (
      <WideCampaigns
        props={props}
        creating={creating}
        setCreating={setCreating}
        wrap={centred}
        indexClass="xl:w-96"
        preview
      />
    );
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h1 className="text-2xl">Campaigns</h1>
        <Button
          size="sm"
          variant={creating ? 'secondary' : 'outline'}
          onClick={() => setCreating(!creating)}
        >
          {creating ? <X /> : <Plus />} New
        </Button>
      </div>
      <ul>
        {creating && (
          <AccordionRow
            open
            onToggle={() => setCreating(false)}
            head={<span className="flex-1 italic">New campaign</span>}
          >
            <NewCampaign
              ch={ch}
              onDone={(c) => {
                setCreating(false);
                ch.select(c.id);
              }}
              onCancel={() => setCreating(false)}
            />
          </AccordionRow>
        )}
        {ch.campaigns.map((c) => {
          const open = !creating && c.id === ch.selectedId;
          return (
            <AccordionRow
              key={c.id}
              open={open}
              onToggle={() => {
                setCreating(false);
                ch.select(open ? undefined : c.id);
              }}
              head={
                <>
                  <span className="flex-1">
                    <span className="block">{c.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {c.militia ? `Week ${c.militia.week}` : 'Not set up'}
                    </span>
                  </span>
                  {open && <Check className="size-4 opacity-60" />}
                  <Caret open={open} />
                </>
              }
            >
              <CampaignPane c={c} go={go} update={ch.update} compact />
            </AccordionRow>
          );
        })}
        {ch.campaigns.length === 0 && !creating && (
          <li className="p-4">
            <NewCampaign ch={ch} onDone={(c) => ch.select(c.id)} />
          </li>
        )}
      </ul>
    </div>
  );
}
