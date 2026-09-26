'use client';
// PROTOTYPE — pieces shared by the variants: role cards with the holder menu,
// the Assign picker sheet, the character record dialog, role chips, the
// pending-actions line and the sticky reason bar for a correction.

import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import type { Dispatch } from 'react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import {
  abilities,
  abilityShort,
  roleLabel,
  roles,
  type Action,
  type Character,
  type EditSection,
  type Kind,
  type Projection,
  type Role,
  type RoleView,
} from './mock';

export type VariantProps = { view: Projection; edit: Dispatch<Action> };

export function Chip({
  children,
  tone = 'muted',
  onClick,
  className,
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'role' | 'warn' | 'pc' | 'npc';
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap',
        tone === 'muted' && 'border-foreground/20 text-muted-foreground',
        tone === 'role' && 'border-primary/60 text-primary',
        tone === 'warn' && 'border-amber-300/60 text-amber-300',
        tone === 'pc' && 'border-sky-300/60 text-sky-300',
        tone === 'npc' && 'border-foreground/40 text-foreground',
        onClick && 'hover:bg-foreground/10',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function KindChip({ kind }: { kind: Kind | null }) {
  if (!kind) return <Chip>not on roster</Chip>;
  return <Chip tone={kind}>{kind.toUpperCase()}</Chip>;
}

export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function RoleChips({
  roles: rs,
  onJump,
}: {
  roles: Role[];
  onJump?: (r: Role) => void;
}) {
  if (!rs.length)
    return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {rs.map((r) => (
        <Chip
          key={r}
          tone="role"
          onClick={onJump ? () => onJump(r) : undefined}
        >
          {roleLabel[r]}
        </Chip>
      ))}
    </span>
  );
}

export function ManagesLine({
  manages,
}: {
  manages: { count: number; limit: number; names: string[] };
}) {
  if (!manages.count)
    return (
      <span className="text-muted-foreground text-xs">Manages no teams</span>
    );
  return (
    <span
      className={cn(
        'text-xs',
        manages.count > manages.limit
          ? 'text-amber-300'
          : 'text-muted-foreground',
      )}
      title={manages.names.join(', ')}
    >
      Manages {manages.count} of {manages.limit} teams{' '}
      <button className="underline underline-offset-2">Militia → Teams</button>
    </span>
  );
}

export function PendingLine({ view }: { view: Projection }) {
  const items = view.roleViews.flatMap((v) => v.pending);
  const unique = [...new Set(items)];
  if (!unique.length) return null;
  return (
    <p className="border-foreground/20 bg-card flex flex-wrap items-center gap-2 border px-3 py-2 text-sm">
      <span className="text-muted-foreground text-xs tracking-widest uppercase">
        Pending this week
      </span>
      {unique.map((p) => (
        <span key={p}>
          {p}{' '}
          <button className="underline underline-offset-2">
            Go to Activity →
          </button>
        </span>
      ))}
    </p>
  );
}

// ---------- role card ----------

function HolderMenu({
  holder,
  role,
  edit,
}: {
  holder: RoleView['holders'][number];
  role: Role;
  edit: Dispatch<Action>;
}) {
  const [open, setOpen] = useState<false | 'menu' | 'move'>(false);
  return (
    <span className="relative">
      <button
        aria-label={`Options for ${holder.name}`}
        className="hover:bg-foreground/10 rounded p-0.5"
        onClick={() => setOpen(open ? false : 'menu')}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <ul className="bg-popover border-foreground/30 absolute top-6 right-0 z-30 w-44 border text-sm shadow-lg">
          {open === 'menu' ? (
            <>
              <li>
                <button
                  className="hover:bg-foreground/10 flex w-full items-center justify-between px-3 py-1.5 text-left"
                  onClick={() => setOpen('move')}
                >
                  Move to… <ChevronRight className="size-3.5" />
                </button>
              </li>
              <li>
                <button
                  className="hover:bg-foreground/10 w-full px-3 py-1.5 text-left"
                  onClick={() => {
                    setOpen(false);
                    edit({
                      kind: 'unassign',
                      role,
                      characterId: holder.characterId,
                    });
                  }}
                >
                  Remove
                </button>
              </li>
            </>
          ) : (
            roles
              .filter((r) => r !== role)
              .map((r) => (
                <li key={r}>
                  <button
                    className="hover:bg-foreground/10 w-full px-3 py-1.5 text-left"
                    onClick={() => {
                      setOpen(false);
                      edit({
                        kind: 'move',
                        characterId: holder.characterId,
                        from: role,
                        to: r,
                      });
                    }}
                  >
                    {roleLabel[r]}
                  </button>
                </li>
              ))
          )}
        </ul>
      )}
    </span>
  );
}

export function RoleCard({
  v,
  editing,
  edit,
  onAssign,
  compact,
  id,
}: {
  v: RoleView;
  editing: boolean;
  edit: Dispatch<Action>;
  onAssign: (r: Role) => void;
  compact?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-label={v.label}
      className={cn(
        'bg-card border-foreground/20 flex flex-col gap-2 border p-3',
        v.vacant && 'border-dashed',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{v.label}</h3>
          {!compact && (
            <p className="text-muted-foreground text-xs">{v.rule}</p>
          )}
        </div>
        {editing && (
          <Button
            size={compact ? 'icon' : 'sm'}
            variant="outline"
            aria-label={`Assign ${v.label}`}
            onClick={() => onAssign(v.role)}
          >
            <Plus /> {!compact && 'Assign'}
          </Button>
        )}
      </header>
      <ul className="space-y-1">
        {v.holders.map((h) => (
          <li
            key={h.characterId}
            className={cn(
              'flex items-center gap-2 text-sm',
              !h.counts && 'text-muted-foreground',
            )}
          >
            <span className={cn('font-medium', h.archived && 'line-through')}>
              {h.name}
            </span>
            <span className="text-muted-foreground text-xs">{h.detail}</span>
            {h.archived && <Chip tone="warn">archived</Chip>}
            {editing && <HolderMenu holder={h} role={v.role} edit={edit} />}
          </li>
        ))}
      </ul>
      <p
        className={cn(
          'mt-auto font-mono text-sm',
          v.vacant ? 'text-muted-foreground italic' : 'text-foreground',
        )}
      >
        {v.effect}
      </p>
      {v.pending.map((p) => (
        <p key={p} className="text-xs text-sky-300">
          Pending this week: {p}
        </p>
      ))}
    </section>
  );
}

export function AssignSheet({
  role,
  view,
  edit,
  onClose,
}: {
  role: Role | null;
  view: Projection;
  edit: Dispatch<Action>;
  onClose: () => void;
}) {
  const list = role ? view.candidates(role) : [];
  const group = (kind: Kind) => list.filter((c) => c.kind === kind);
  return (
    <Sheet open={role !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[26rem] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Assign {role ? roleLabel[role] : ''}</SheetTitle>
          <SheetDescription>
            People on the militia roster. Adding a role keeps their current one.
          </SheetDescription>
        </SheetHeader>
        {(['pc', 'npc'] as Kind[]).map((kind) => (
          <div key={kind} className="px-4 pb-4">
            <h4 className="text-muted-foreground mb-1 text-xs tracking-widest uppercase">
              {kind === 'pc' ? 'Player characters' : 'NPCs'}
            </h4>
            {group(kind).length === 0 && (
              <p className="text-muted-foreground text-sm">None available.</p>
            )}
            <ul className="space-y-1">
              {group(kind).map((c) => (
                <li key={c.characterId}>
                  <button
                    className="border-foreground/20 hover:bg-foreground/10 flex w-full flex-col border px-3 py-2 text-left disabled:opacity-50"
                    onClick={() => {
                      if (role)
                        edit({
                          kind: 'assign',
                          role,
                          characterId: c.characterId,
                        });
                      onClose();
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
        {role && view.candidates(role).some((c) => c.kind === 'pc') && (
          <p className="text-muted-foreground px-4 text-xs">
            In play this is normally a Change Officer Role action.{' '}
            <button className="underline">Go to Activity</button>
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------- character record dialog ----------

export function CharacterDialog({
  character,
  view,
  edit,
  onClose,
}: {
  character: Character | 'new' | null;
  view: Projection;
  edit: Dispatch<Action>;
  onClose: () => void;
}) {
  const kindOnRecord = view.state.scenario.kindHome === 'record';
  const base: Character =
    character && character !== 'new'
      ? character
      : {
          id: `c${Date.now()}`,
          name: '',
          level: 1,
          kind: 'pc',
          notes: '',
          archived: false,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        };
  return (
    <Dialog open={character !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const num = (k: string) => Number(f.get(k) ?? 0);
            const str = (k: string) => {
              const v = f.get(k);
              return typeof v === 'string' ? v : '';
            };
            edit({
              kind: 'saveCharacter',
              character: {
                ...base,
                name: str('name'),
                level: num('level'),
                kind: kindOnRecord ? (str('kind') as Kind) : base.kind,
                notes: str('notes'),
                strength: num('strength'),
                dexterity: num('dexterity'),
                constitution: num('constitution'),
                intelligence: num('intelligence'),
                wisdom: num('wisdom'),
                charisma: num('charisma'),
              },
            });
            onClose();
          }}
          className="space-y-3"
        >
          <DialogHeader>
            <DialogTitle>
              {character === 'new' ? 'Add character' : 'Edit character'}
            </DialogTitle>
            <DialogDescription>
              {kindOnRecord
                ? 'The record: name, level, kind, ability scores and notes.'
                : 'The record: name, level, ability scores and notes. PC or NPC is set on the militia roster.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_5rem_7rem] gap-2">
            <label className="text-sm">
              Name
              <Input name="name" defaultValue={base.name} required />
            </label>
            <label className="text-sm">
              Level
              <Input
                name="level"
                type="number"
                min={1}
                defaultValue={base.level}
              />
            </label>
            {kindOnRecord ? (
              <label className="text-sm">
                Kind
                <select
                  name="kind"
                  defaultValue={base.kind}
                  className="border-input bg-background h-9 w-full border px-2 text-sm"
                >
                  <option value="pc">PC</option>
                  <option value="npc">NPC</option>
                </select>
              </label>
            ) : (
              <span />
            )}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {abilities.map((a) => (
              <label key={a} className="font-mono text-xs uppercase">
                {abilityShort[a]}
                <Input
                  name={a}
                  type="number"
                  defaultValue={base[a]}
                  className="font-mono"
                />
              </label>
            ))}
          </div>
          <label className="block text-sm">
            Notes
            <Input name="notes" defaultValue={base.notes} />
          </label>
          <DialogFooter>
            {character !== 'new' && character && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  edit({
                    kind: 'archive',
                    characterId: character.id,
                    archived: !character.archived,
                  });
                  onClose();
                }}
              >
                {character.archived ? <ArchiveRestore /> : <Archive />}
                {character.archived ? 'Un-archive' : 'Archive'}
              </Button>
            )}
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditRecordButton({
  character,
  onEdit,
}: {
  character: Character;
  onEdit: (c: Character) => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => onEdit(character)}
      aria-label={`Edit ${character.name}`}
    >
      <Pencil />
    </Button>
  );
}

// ---------- reason bar ----------

const quickReasons = [
  'Story change',
  'Fixing a mistake',
  'New officer joined',
  'Character left',
];

export function ReasonBar({
  view,
  edit,
  title,
}: {
  view: Projection;
  edit: Dispatch<Action>;
  title?: string;
}) {
  const e = view.state.edit;
  if (!e) return null;
  const label: Record<EditSection, string> = {
    officers: 'Correcting officers',
    roster: 'Correcting the roster',
    both: 'Correcting people & officers',
  };
  return (
    <div className="bg-background/95 border-foreground/30 fixed inset-x-0 bottom-0 z-20 border-t px-5 py-3 pb-14 backdrop-blur">
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
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs tracking-widest whitespace-nowrap uppercase">
            {title ?? label[e.section]}
          </span>
          <Input
            placeholder="Reason (required)"
            value={e.reason}
            onChange={(ev) =>
              edit({ kind: 'setReason', reason: ev.target.value })
            }
            className="max-w-md"
          />
          <span className="flex gap-1">
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
              onClick={() => edit({ kind: 'cancelEdit' })}
            >
              <X /> Cancel
            </Button>
            <Button
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
