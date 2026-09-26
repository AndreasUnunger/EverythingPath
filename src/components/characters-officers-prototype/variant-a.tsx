'use client';
// PROTOTYPE variant A — "Roster beside roles". Left: the militia roster (people
// with kind, Hit Dice, role chips, teams managed) plus the records not on it.
// Right: six role cards. One correction covers both people and officers.

import { Plus, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { Character, Kind, Role } from './mock';
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

export const name = 'Roster beside roles';

export function VariantA({ view, edit }: VariantProps) {
  const [assigning, setAssigning] = useState<Role | null>(null);
  const [record, setRecord] = useState<Character | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const kindOnRoster = view.state.scenario.kindHome === 'roster';
  const jump = (r: Role) =>
    document
      .getElementById(`role-${r}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const rows = view.rows.filter((r) => showArchived || !r.character.archived);

  return (
    <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-5">
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Militia roster</h2>
          <span className="text-muted-foreground text-sm">
            {view.rows.length} people
          </span>
          <span className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRecord('new')}
            >
              <Plus /> Add character
            </Button>
            {!view.editing && (
              <Button
                size="sm"
                onClick={() => edit({ kind: 'startEdit', section: 'both' })}
              >
                Correct people & officers
              </Button>
            )}
          </span>
        </header>

        <ul className="border-foreground/20 divide-foreground/10 divide-y border">
          {rows.map((r) => (
            <li
              key={r.character.id}
              className={cn(
                'grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-2',
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
                <RoleChips roles={r.roles} onJump={jump} />
              </div>
              <div className="row-span-2 flex items-center gap-1 self-center">
                <EditRecordButton character={r.character} onEdit={setRecord} />
                {view.editing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      edit({ kind: 'leave', characterId: r.character.id })
                    }
                  >
                    <UserMinus /> Remove from roster
                  </Button>
                )}
              </div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 text-xs">
                <span>
                  Hit Dice:{' '}
                  {view.editing ? (
                    <input
                      type="number"
                      min={0}
                      placeholder={`${r.character.level} (level)`}
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
                      className="border-input bg-background h-6 w-24 border px-1 font-mono text-xs"
                    />
                  ) : (
                    <span className="font-mono">{r.hitDiceShown}</span>
                  )}
                </span>
                <ManagesLine manages={r.manages} />
              </div>
              {r.warnings.map((w) => (
                <div key={w} className="col-span-2">
                  <Warn>{w}</Warn>
                </div>
              ))}
            </li>
          ))}
        </ul>
        <button
          className="text-muted-foreground text-xs underline"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? 'Hide' : 'Show'} archived on the roster
        </button>

        <section className="space-y-2">
          <h3 className="text-muted-foreground text-xs tracking-widest uppercase">
            Characters not on the roster · {view.offRoster.length}
          </h3>
          <ul className="border-foreground/20 divide-foreground/10 divide-y border border-dashed">
            {view.offRoster.map((ch) => (
              <li key={ch.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="font-semibold">{ch.name}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  L{ch.level}
                </span>
                {!kindOnRoster && <KindChip kind={ch.kind} />}
                <span className="ml-auto flex items-center gap-1">
                  <EditRecordButton character={ch} onEdit={setRecord} />
                  {view.editing &&
                    (kindOnRoster ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            edit({
                              kind: 'join',
                              characterId: ch.id,
                              kind_: 'pc',
                            })
                          }
                        >
                          <UserPlus /> Add as PC
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            edit({
                              kind: 'join',
                              characterId: ch.id,
                              kind_: 'npc',
                            })
                          }
                        >
                          <UserPlus /> Add as NPC
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          edit({
                            kind: 'join',
                            characterId: ch.id,
                            kind_: ch.kind,
                          })
                        }
                      >
                        <UserPlus /> Add to roster
                      </Button>
                    ))}
                </span>
              </li>
            ))}
            {view.offRoster.length === 0 && (
              <li className="text-muted-foreground px-3 py-2 text-sm">
                Everyone is on the roster.
              </li>
            )}
          </ul>
          {view.archived.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {view.archived.length} archived record
              {view.archived.length > 1 ? 's' : ''}:{' '}
              {view.archived.map((a) => (
                <button
                  key={a.id}
                  className="underline"
                  onClick={() => setRecord(a)}
                >
                  {a.name}
                </button>
              ))}
            </p>
          )}
        </section>
      </div>

      <div className="space-y-3">
        <header className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Officers</h2>
          <span className="text-muted-foreground text-sm">
            Focus: {view.state.focus}
          </span>
        </header>
        <PendingLine view={view} />
        <div className="grid grid-cols-2 gap-3">
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
      </div>

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
