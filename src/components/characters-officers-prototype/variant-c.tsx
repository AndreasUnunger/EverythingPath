'use client';
// PROTOTYPE variant C — "Two tabs". The Militia tab shows a compact officer
// strip above person cards; joining is an "Add to militia" picker. The
// Character records tab is the plain ledger table (add, edit, archive) with
// no militia data on it.

import { Plus, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import {
  abilities,
  abilityShort,
  type Character,
  type Kind,
  type Role,
} from './mock';
import {
  AssignSheet,
  CharacterDialog,
  Chip,
  EditRecordButton,
  KindChip,
  ManagesLine,
  PendingLine,
  ReasonBar,
  RoleCard,
  RoleChips,
  Warn,
  type VariantProps,
} from './parts';

export const name = 'Militia tab and Character records tab';

export function VariantC({ view, edit }: VariantProps) {
  const [assigning, setAssigning] = useState<Role | null>(null);
  const [record, setRecord] = useState<Character | 'new' | null>(null);
  const [joining, setJoining] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const kindOnRoster = view.state.scenario.kindHome === 'roster';
  const jump = (r: Role) =>
    document
      .getElementById(`role-${r}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const people = view.rows.filter(
    (r) => !r.character.archived || r.roles.length || r.manages.count,
  );

  return (
    <Tabs defaultValue="militia">
      <TabsList>
        <TabsTrigger value="militia">
          Militia · {view.rows.length} people
        </TabsTrigger>
        <TabsTrigger value="records">
          Character records ·{' '}
          {view.state.characters.filter((c) => !c.archived).length}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="militia" className="space-y-4 pt-3">
        <header className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Officers</h2>
          <span className="text-muted-foreground text-sm">
            Focus: {view.state.focus}
          </span>
          {!view.editing && (
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => edit({ kind: 'startEdit', section: 'both' })}
            >
              Correct militia people
            </Button>
          )}
        </header>
        <PendingLine view={view} />
        <div className="grid grid-cols-6 gap-2">
          {view.roleViews.map((v) => (
            <RoleCard
              key={v.role}
              id={`role-${v.role}`}
              v={{ ...v, pending: [] }}
              editing={view.editing}
              edit={edit}
              onAssign={setAssigning}
              compact
            />
          ))}
        </div>

        <header className="flex items-center gap-3 pt-2">
          <h2 className="text-lg font-semibold">People</h2>
          {view.editing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setJoining(true)}
            >
              <UserPlus /> Add to militia
            </Button>
          )}
        </header>
        <div className="grid grid-cols-4 gap-3">
          {people.map((r) => (
            <article
              key={r.character.id}
              className={cn(
                'bg-card border-foreground/20 flex flex-col gap-1.5 border p-3',
                r.character.archived && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">
                  {r.character.name}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  L{r.character.level}
                </span>
                <span className="ml-auto">
                  <EditRecordButton
                    character={r.character}
                    onEdit={setRecord}
                  />
                </span>
              </div>
              <div className="flex items-center gap-2">
                {kindOnRoster && view.editing ? (
                  <select
                    value={r.kind}
                    onChange={(e) =>
                      edit({
                        kind: 'setPersonKind',
                        characterId: r.character.id,
                        kind_: e.target.value as Kind,
                      })
                    }
                    className="border-input bg-background h-7 border px-1 font-mono text-xs"
                  >
                    <option value="pc">PC</option>
                    <option value="npc">NPC</option>
                  </select>
                ) : (
                  <KindChip kind={r.kind} />
                )}
                {r.character.archived && <Chip tone="warn">archived</Chip>}
                <span className="text-muted-foreground text-xs">
                  HD{' '}
                  {view.editing ? (
                    <input
                      type="number"
                      min={0}
                      placeholder={`${r.character.level}`}
                      value={r.person.hitDice ?? ''}
                      onChange={(e) =>
                        edit({
                          kind: 'setHitDice',
                          characterId: r.character.id,
                          hitDice:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        })
                      }
                      className="border-input bg-background h-6 w-14 border px-1 font-mono text-xs"
                    />
                  ) : (
                    <span className="font-mono">{r.hitDiceShown}</span>
                  )}
                </span>
              </div>
              <RoleChips roles={r.roles} onJump={jump} />
              <ManagesLine manages={r.manages} />
              {r.warnings.map((w) => (
                <Warn key={w}>{w}</Warn>
              ))}
              {view.editing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-auto self-start"
                  onClick={() =>
                    edit({ kind: 'leave', characterId: r.character.id })
                  }
                >
                  <UserMinus /> Remove from militia
                </Button>
              )}
            </article>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="records" className="space-y-3 pt-3">
        <header className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Character records</h2>
          <label className="text-muted-foreground ml-2 flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setRecord('new')}
          >
            <Plus /> Add character
          </Button>
        </header>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs tracking-widest uppercase">
            <tr className="border-foreground/20 border-b">
              <th className="py-1 pr-2">Character</th>
              <th className="py-1 pr-2">Level</th>
              {!kindOnRoster && <th className="py-1 pr-2">Kind</th>}
              <th className="py-1 pr-2">Ability scores</th>
              <th className="py-1 pr-2">Militia</th>
              <th className="py-1 pr-2">Notes</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-foreground/10 divide-y">
            {view.state.characters
              .filter((c) => showArchived || !c.archived)
              .map((ch) => (
                <tr key={ch.id} className={cn(ch.archived && 'opacity-60')}>
                  <td className="py-2 pr-2 font-semibold">
                    {ch.name}
                    {ch.archived && (
                      <Chip tone="warn" className="ml-1">
                        archived
                      </Chip>
                    )}
                  </td>
                  <td className="py-2 pr-2 font-mono">{ch.level}</td>
                  {!kindOnRoster && (
                    <td className="py-2 pr-2">
                      <KindChip kind={ch.kind} />
                    </td>
                  )}
                  <td className="py-2 pr-2 font-mono text-xs">
                    {abilities
                      .map((a) => `${abilityShort[a].toUpperCase()} ${ch[a]}`)
                      .join('  ')}
                  </td>
                  <td className="text-muted-foreground py-2 pr-2 text-xs">
                    {view.rows.some((r) => r.character.id === ch.id)
                      ? 'On the roster'
                      : 'Not on the roster'}
                  </td>
                  <td className="text-muted-foreground max-w-48 truncate py-2 pr-2 text-xs">
                    {ch.notes}
                  </td>
                  <td className="py-1 text-right">
                    <EditRecordButton character={ch} onEdit={setRecord} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </TabsContent>

      <Sheet open={joining} onOpenChange={(o) => !o && setJoining(false)}>
        <SheetContent side="right" className="w-[26rem]">
          <SheetHeader>
            <SheetTitle>Add to militia</SheetTitle>
            <SheetDescription>
              Character records that are not on the roster yet.
            </SheetDescription>
          </SheetHeader>
          <ul className="space-y-1 px-4">
            {view.offRoster.map((ch) => (
              <li
                key={ch.id}
                className="border-foreground/20 flex items-center gap-2 border px-3 py-2"
              >
                <span className="font-semibold">{ch.name}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  L{ch.level}
                </span>
                {!kindOnRoster && <KindChip kind={ch.kind} />}
                <span className="ml-auto flex gap-1">
                  {kindOnRoster ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          edit({
                            kind: 'join',
                            characterId: ch.id,
                            kind_: 'pc',
                          });
                          setJoining(false);
                        }}
                      >
                        as PC
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          edit({
                            kind: 'join',
                            characterId: ch.id,
                            kind_: 'npc',
                          });
                          setJoining(false);
                        }}
                      >
                        as NPC
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        edit({
                          kind: 'join',
                          characterId: ch.id,
                          kind_: ch.kind,
                        });
                        setJoining(false);
                      }}
                    >
                      Add
                    </Button>
                  )}
                </span>
              </li>
            ))}
            {view.offRoster.length === 0 && (
              <li className="text-muted-foreground text-sm">
                Everyone is on the roster.
              </li>
            )}
          </ul>
          <p className="text-muted-foreground px-4 pt-3 text-xs">
            Someone new?{' '}
            <button
              className="underline"
              onClick={() => {
                setJoining(false);
                setRecord('new');
              }}
            >
              Add a character record
            </button>
          </p>
        </SheetContent>
      </Sheet>
      <AssignSheet
        role={assigning}
        view={view}
        edit={edit}
        onClose={() => setAssigning(null)}
      />
      <CharacterDialog
        character={record}
        view={view}
        edit={edit}
        onClose={() => setRecord(null)}
      />
      <ReasonBar view={view} edit={edit} title="Correcting militia people" />
    </Tabs>
  );
}
