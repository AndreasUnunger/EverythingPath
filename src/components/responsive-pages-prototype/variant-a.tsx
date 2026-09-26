'use client';
// PROTOTYPE — Variant A "Drill in". On a phone the index is a page of its
// own; tapping an item pushes the detail page with a Back button. Correction
// editors take over the pushed page; Assign pushes a page too. Role cards
// become compact rows and the character table becomes cards. Desktop adds
// nothing beyond width: the detail pane is capped and the role cards run in
// one row of six.

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CharacterDialog } from '~/components/characters-officers-prototype/parts';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  AssignList,
  CampaignPane,
  CampaignRow,
  CharacterCard,
  CharacterHeader,
  EntriesList,
  MilitiaCorrectButton,
  militiaCurrent,
  MilitiaEditor,
  MilitiaRead,
  militiaTitle,
  NewCampaign,
  OfficerRow,
  PendingLine,
  ProvenanceLine,
  ReasonBarResponsive,
  RecordBody,
  roleLabel,
  SetupNext,
  SetupStepDetail,
  SetupStepRow,
  StartingPoint,
  useSetup,
  WeekRow,
  type MilitiaKey,
  type Props,
} from './content';
import { PushedPage, useWidth } from './primitives';
import {
  currentWeekLine,
  EntriesToggle,
  MilitiaIndex,
  OfficersHeader,
  useCharactersState,
  WeekArrows,
  WideCampaigns,
  WideCharacters,
  WideHistory,
  WideMilitia,
  WideSetup,
} from './wide';

export const name = 'Drill in; desktop only widens';

export function VariantA(props: Props) {
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

// ---------- Setup ----------

function Setup(props: Props) {
  const { sc } = props;
  const width = useWidth();
  const m = useSetup(sc);
  const [drilled, setDrilled] = useState(false);
  const onGo = (step: number) => {
    sc.dispatch({ kind: 'setup:step', step });
    setDrilled(true);
  };
  if (width !== 'phone')
    return (
      <WideSetup props={props} m={m} onGo={onGo} detailClass="xl:max-w-4xl" />
    );
  if (!drilled)
    return (
      <div className="flex-1 space-y-3 p-3">
        <h1 className="px-2 text-2xl">Set up militia</h1>
        <StartingPoint sc={sc} />
        <ol className="space-y-0.5">
          {m.steps.map((s) => (
            <SetupStepRow key={s.key} s={s} m={m} sc={sc} onGo={onGo} chevron />
          ))}
        </ol>
      </div>
    );
  return (
    <PushedPage
      title={
        <>
          {m.current.label}{' '}
          <span className="text-muted-foreground text-xs font-normal">
            {m.current.index + 1}/{m.steps.length}
          </span>
        </>
      }
      onBack={() => setDrilled(false)}
      footer={
        <footer className="bg-background sticky bottom-0 flex items-center justify-end border-t px-4 py-3">
          <SetupNext props={props} m={m} onGo={onGo} className="w-full" />
        </footer>
      }
    >
      <SetupStepDetail sc={sc} m={m} columns={2} onGo={onGo} />
    </PushedPage>
  );
}

// ---------- Militia ----------

function Militia(props: Props) {
  const { sc } = props;
  const width = useWidth();
  const [picked, setPicked] = useState<MilitiaKey>('values');
  const [drilled, setDrilled] = useState(false);
  const current = militiaCurrent(sc, picked);
  const editing =
    !!sc.state.correction && sc.state.correction.section === current;
  const onPick = (k: MilitiaKey) => {
    setPicked(k);
    setDrilled(true);
  };
  if (width !== 'phone')
    return (
      <WideMilitia
        props={props}
        current={current}
        onPick={onPick}
        detailClass="xl:max-w-4xl"
      />
    );
  if (!drilled && !editing)
    return (
      <div className="flex-1 space-y-3 p-3">
        <h1 className="px-2 text-2xl">Militia</h1>
        <MilitiaIndex sc={sc} current={current} onPick={onPick} chevron />
      </div>
    );
  return (
    <PushedPage
      title={
        editing
          ? `Correct ${militiaTitle(sc, current).toLowerCase()}`
          : militiaTitle(sc, current)
      }
      onBack={() =>
        editing ? sc.dispatch({ kind: 'correct:cancel' }) : setDrilled(false)
      }
      actions={<MilitiaCorrectButton sc={sc} current={current} size="sm" />}
    >
      {editing ? (
        <MilitiaEditor sc={sc} columns={2} />
      ) : (
        <MilitiaRead sc={sc} current={current} dense />
      )}
    </PushedPage>
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
  if (width !== 'phone')
    return (
      <>
        <WideCharacters
          props={props}
          cs={cs}
          wrap="[&_.grid-cols-3]:xl:grid-cols-6"
        />
        <AssignPage cs={cs} props={props} sheet />
        <ReasonBarResponsive view={view} edit={edit} />
      </>
    );
  if (cs.assigning) return <AssignPage cs={cs} props={props} />;
  const everyone = view.state.characters.filter(
    (c) => cs.showArchived || !c.archived,
  );
  return (
    <div className="flex-1 space-y-6 px-3 py-4 pb-48">
      <section
        className={cn(
          'space-y-2',
          rosterEditing && 'pointer-events-none opacity-50',
        )}
      >
        <OfficersHeader view={view} edit={edit} section={section} />
        <ul className="bg-card border-foreground/20 divide-foreground/10 divide-y border">
          {view.roleViews.map((v) => (
            <OfficerRow
              key={v.role}
              v={v}
              editing={officersEditing}
              onAssign={cs.setAssigning}
              edit={edit}
            />
          ))}
        </ul>
      </section>
      <section
        className={cn(
          'space-y-2',
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
              onJump={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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
      <ReasonBarResponsive view={view} edit={edit} />
    </div>
  );
}

/** Phone: a pushed page. Tablet and desktop: the settled right-hand sheet. */
function AssignPage({
  cs,
  props,
  sheet,
}: {
  cs: ReturnType<typeof useCharactersState>;
  props: Props;
  sheet?: boolean;
}) {
  const { view, edit } = props.co;
  if (!cs.assigning) return null;
  if (sheet)
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <button
          aria-label="Close"
          className="absolute inset-0 bg-black/50"
          onClick={() => cs.setAssigning(null)}
        />
        <section
          role="dialog"
          aria-modal="true"
          className="bg-background relative w-[26rem] overflow-y-auto border-l shadow-2xl"
        >
          <h2 className="px-4 pt-4 text-lg font-semibold">
            Assign {roleLabel[cs.assigning]}
          </h2>
          <AssignList
            role={cs.assigning}
            view={view}
            edit={edit}
            onDone={() => cs.setAssigning(null)}
          />
        </section>
      </div>
    );
  return (
    <PushedPage
      title={`Assign ${roleLabel[cs.assigning]}`}
      onBack={() => cs.setAssigning(null)}
    >
      <div className="-m-4">
        <AssignList
          role={cs.assigning}
          view={view}
          edit={edit}
          onDone={() => cs.setAssigning(null)}
        />
      </div>
    </PushedPage>
  );
}

// ---------- Finished weeks ----------

function History(props: Props) {
  const { fw } = props;
  const width = useWidth();
  const [drilled, setDrilled] = useState(false);
  const [showEntries, setShowEntries] = useState(false);
  if (width !== 'phone')
    return <WideHistory props={props} detailClass="xl:max-w-4xl" />;
  if (!drilled)
    return (
      <div className="flex-1 space-y-2 p-3">
        <h1 className="px-2 text-2xl">Finished weeks</h1>
        <ol className="space-y-0.5">
          {fw.weeks.map((w) => (
            <WeekRow
              key={w.week}
              w={w}
              active={false}
              chevron
              onSelect={() => {
                fw.select({ week: w.week });
                setDrilled(true);
              }}
            />
          ))}
        </ol>
        <p className="text-muted-foreground px-2 text-xs">{currentWeekLine}</p>
      </div>
    );
  return (
    <PushedPage
      title={`Week ${fw.record.week}`}
      onBack={() => setDrilled(false)}
      actions={<WeekArrows fw={fw} size="sm" />}
    >
      <ProvenanceLine record={fw.record} entry={fw.entry} />
      <EntriesToggle
        fw={fw}
        open={showEntries}
        onToggle={() => setShowEntries(!showEntries)}
      />
      {showEntries && <EntriesList fw={fw} />}
      <RecordBody record={fw.record} />
    </PushedPage>
  );
}

// ---------- Campaigns ----------

function Campaigns(props: Props) {
  const { ch, go } = props;
  const width = useWidth();
  const [creating, setCreating] = useState(false);
  const [drilled, setDrilled] = useState(false);
  const selected = ch.campaigns.find((c) => c.id === ch.selectedId);
  if (width !== 'phone')
    return (
      <WideCampaigns
        props={props}
        creating={creating}
        setCreating={setCreating}
      />
    );
  if (creating)
    return (
      <PushedPage title="New campaign" onBack={() => setCreating(false)}>
        <NewCampaign
          ch={ch}
          onDone={(c) => {
            setCreating(false);
            ch.select(c.id);
            setDrilled(true);
          }}
        />
      </PushedPage>
    );
  if (drilled && selected)
    return (
      <PushedPage title={selected.name} onBack={() => setDrilled(false)}>
        <CampaignPane c={selected} go={go} update={ch.update} compact />
      </PushedPage>
    );
  return (
    <div className="flex-1 space-y-2 p-3">
      <div className="flex items-center justify-between px-2">
        <h1 className="text-2xl">Campaigns</h1>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus /> New
        </Button>
      </div>
      <nav className="space-y-1">
        {ch.campaigns.map((c) => (
          <CampaignRow
            key={c.id}
            c={c}
            active={false}
            chevron
            onSelect={() => {
              ch.select(c.id);
              setDrilled(true);
            }}
          />
        ))}
        {ch.campaigns.length === 0 && (
          <NewCampaign ch={ch} onDone={(c) => ch.select(c.id)} />
        )}
      </nav>
    </div>
  );
}
