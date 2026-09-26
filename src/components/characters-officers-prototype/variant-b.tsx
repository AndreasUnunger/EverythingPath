'use client';
// PROTOTYPE variant B — "Officer board over one character table". The six
// role cards run full width on top. Below, every character record is one row
// with an On-roster switch, kind, Hit Dice, roles and teams managed. Officers
// and the roster are two separate corrections, one open at a time.

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { hitDiceText, type Character, type Kind, type Role } from './mock';
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

export const name = 'Officer board over one character table';

export function VariantB({ view, edit }: VariantProps) {
  const [assigning, setAssigning] = useState<Role | null>(null);
  const [record, setRecord] = useState<Character | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const section = view.state.edit?.section ?? null;
  const officersEditing = section === 'officers';
  const rosterEditing = section === 'roster';
  const kindOnRoster = view.state.scenario.kindHome === 'roster';
  const jump = (r: Role) =>
    document
      .getElementById(`role-${r}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const everyone = view.state.characters.filter(
    (c) => showArchived || !c.archived,
  );
  const rowOf = (id: string) => view.rows.find((r) => r.character.id === id);

  return (
    <div className="space-y-6">
      <section
        className={cn(
          'space-y-3',
          rosterEditing && 'pointer-events-none opacity-50',
        )}
      >
        <header className="flex items-center gap-3">
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
        <div className="grid grid-cols-3 gap-3">
          {view.roleViews.map((v) => (
            <RoleCard
              key={v.role}
              id={`role-${v.role}`}
              v={v}
              editing={officersEditing}
              edit={edit}
              onAssign={setAssigning}
            />
          ))}
        </div>
      </section>

      <section
        className={cn(
          'space-y-3',
          officersEditing && 'pointer-events-none opacity-50',
        )}
      >
        <header className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Characters</h2>
          <span className="text-muted-foreground text-sm">
            {view.rows.length} on the roster · {view.offRoster.length} not
          </span>
          <label className="text-muted-foreground ml-2 flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <span className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRecord('new')}
            >
              <Plus /> Add character
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
        <PendingLine view={view} />
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
              const r = rowOf(ch.id);
              return (
                <tr
                  key={ch.id}
                  className={cn('align-top', ch.archived && 'opacity-60')}
                >
                  <td className="py-2 pr-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        role="switch"
                        className="size-4"
                        checked={!!r}
                        disabled={!rosterEditing}
                        onChange={(e) =>
                          e.target.checked
                            ? edit({
                                kind: 'join',
                                characterId: ch.id,
                                kind_: ch.kind,
                              })
                            : edit({ kind: 'leave', characterId: ch.id })
                        }
                      />
                      <span className="text-muted-foreground text-xs">
                        {r ? 'Yes' : 'No'}
                      </span>
                    </label>
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
                    {kindOnRoster && rosterEditing && r ? (
                      <select
                        value={r.kind}
                        onChange={(e) =>
                          edit({
                            kind: 'setPersonKind',
                            characterId: ch.id,
                            kind_: e.target.value as Kind,
                          })
                        }
                        className="border-input bg-background h-7 border px-1 font-mono text-xs"
                      >
                        <option value="pc">PC</option>
                        <option value="npc">NPC</option>
                      </select>
                    ) : (
                      <KindChip kind={view.kindOf(ch.id)} />
                    )}
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs">
                    {r ? (
                      rosterEditing ? (
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
                                hitDice:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                            className="border-input bg-background h-7 w-16 border px-1"
                          />{' '}
                          HD
                        </>
                      ) : (
                        r.hitDiceShown
                      )
                    ) : (
                      hitDiceText(ch, view.kindOf(ch.id), null)
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {r ? (
                      <RoleChips roles={r.roles} onJump={jump} />
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
                    <EditRecordButton character={ch} onEdit={setRecord} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

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
      <ReasonBar view={view} edit={edit} />
    </div>
  );
}
