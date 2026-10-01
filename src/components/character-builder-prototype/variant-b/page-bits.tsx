'use client';
// PROTOTYPE (throwaway, #208) — Variant B, round 2: the pieces the list
// pages and the Character pages share, in shell C's idiom
// (`app-shell-prototype/pages.tsx`): page title, roster facts, the
// confirmation note, the Build out / Leave campaign / Add to campaign
// dialogs, the Character header block, and Militia-only in-place editing
// (name, level with its lowering confirmation, the six scores).

import {
  ArrowRight,
  Check,
  Hammer,
  LogOut,
  Minus,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { cn } from '~/lib/utils';
import { ABILITY_LABEL, ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import { militiaCharacterFacts } from '../resolve';
import {
  ABILITIES,
  ME,
  canLeave,
  classLevels,
  leaveConsequences,
  levelLine,
  levelsRemovedBy,
  useBuilderStore,
  useCampaign,
  useCampaigns,
  useNotice,
  useRosterPerson,
  userName,
  type Notice,
} from '../store';
import type { Character, ProtoPage, RosterPerson } from '../types';
import { NumField, TextField, action, chip, rowButton } from './shared';

// ------------------------------------------------------------ list idiom

export function Title({
  children,
  actions,
  eyebrow,
}: {
  children: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-muted-foreground text-xs tracking-widest uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-sans text-2xl md:text-xl">{children}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Officer roles as primary chips, else "On roster" / "Not on roster". */
export function OnRoster({ roster }: { roster: RosterPerson | null }) {
  if (roster && roster.roles.length > 0)
    return (
      <span className="flex flex-wrap gap-1">
        {roster.roles.map((role) => (
          <span key={role} className={cn(chip, 'border-primary text-primary')}>
            {role}
          </span>
        ))}
      </span>
    );
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      {roster ? (
        <Check aria-hidden className="text-foreground size-4" />
      ) : (
        <Minus aria-hidden className="size-4" />
      )}
      {roster ? 'On roster' : 'Not on roster'}
    </span>
  );
}

export function ownerLine(character: Character) {
  return `${userName(character.ownerId)}${character.ownerId === ME ? ' (me)' : ''}`;
}

// ---------------------------------------------------------------- notice

/** The store's confirmation note, inline, with a dismiss. */
export function NoticeCard({
  notice,
  onDismiss,
  className,
}: {
  notice: Notice;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'border-primary/50 bg-primary/5 flex items-start gap-2 border p-3 text-sm',
        className,
      )}
    >
      <Check aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-sans">{notice.title}</p>
        {notice.lines.length > 0 && (
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            {notice.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground -m-1.5 flex size-9 shrink-0 items-center justify-center md:size-7"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** The note for this Character, if the last membership change was its. */
export function NoticeBanner({
  characterId,
  className,
}: {
  characterId: string;
  className?: string;
}) {
  const store = useBuilderStore();
  const notice = useNotice(characterId);
  if (!notice) return null;
  return (
    <NoticeCard
      notice={notice}
      onDismiss={store.dismissNotice}
      className={className}
    />
  );
}

// --------------------------------------------------------------- dialogs

/**
 * Build out, with its one-way confirmation. `ask(character)` opens it;
 * confirming builds the Character out and opens its sheet (from `from`, or
 * wherever the current Character page came from).
 */
export function useBuildOut(from?: ProtoPage) {
  const store = useBuilderStore();
  const nav = useProtoNav();
  const [character, setCharacter] = useState<Character | null>(null);
  const close = () => setCharacter(null);
  const dialog = (
    <Dialog open={character !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-sans">
            Build out {character?.name}?
          </DialogTitle>
          <DialogDescription>
            This is one way. Everything is kept: level{' '}
            {character ? classLevels(character).length : ''} and the six scores
            stay as the militia knows them. From now on {character?.name} is a
            Full Character, edited on its sheet. There is no way back to
            Militia-only.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" className={action} onClick={close}>
            Keep Militia-only
          </Button>
          <Button
            className={action}
            onClick={() => {
              if (!character) return;
              store.buildOut(character.id);
              nav.go('sheet', {
                character: character.id,
                ...(from ? { from } : {}),
              });
              close();
            }}
          >
            <Hammer /> Build out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { ask: setCharacter, dialog };
}

export function AddToCampaignDialog({
  characterId,
  open,
  onOpenChange,
}: {
  characterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useBuilderStore();
  const campaigns = useCampaigns();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-sans">Add to campaign</DialogTitle>
          <DialogDescription>
            Everyone in that campaign will be able to see and edit this
            Character.
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-1">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <button
                type="button"
                className={rowButton}
                onClick={() => {
                  store.addToCampaign(characterId, campaign.id);
                  onOpenChange(false);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-sans">{campaign.name}</span>
                  <span className="text-muted-foreground block text-sm">
                    {campaign.militia
                      ? `Militia · Week ${campaign.militia.week}`
                      : 'No militia'}
                  </span>
                </span>
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function LeaveCampaignDialog({
  characterId,
  open,
  onOpenChange,
}: {
  characterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useBuilderStore();
  const character = store.state.characters.find((c) => c.id === characterId);
  const cons = leaveConsequences(store.state, characterId);
  if (!character || !cons) return null;
  const lines: string[] = [];
  if (cons.roster)
    lines.push(
      `Taken off the ${cons.campaign.name} militia roster${
        cons.roster.roles.length
          ? `; no longer ${cons.roster.roles.join(' and ')}`
          : ''
      }. Finished weeks keep it as it was.`,
    );
  for (const name of cons.detached)
    lines.push(
      `${name} is ${cons.campaign.name} homebrew: kept as its own copy; the sheet doesn't change.`,
    );
  if (cons.becomesFull)
    lines.push(
      'Militia-only becomes Full: that presentation needs a campaign with a militia.',
    );
  lines.push('Only you can see it afterwards, until you add it to a campaign.');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-sans">
            Take {character.name} out of {cons.campaign.name}?
          </DialogTitle>
          <DialogDescription>What changes:</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            variant="ghost"
            className={action}
            onClick={() => onOpenChange(false)}
          >
            Stay in {cons.campaign.name}
          </Button>
          <Button
            variant="destructive"
            className={action}
            onClick={() => {
              store.leaveCampaign(characterId);
              onOpenChange(false);
            }}
          >
            <LogOut /> Leave campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------- header block

/** The name and its summary line: level, classes, owner. */
export function CharacterTitle({ character }: { character: Character }) {
  return (
    <div className="min-w-0">
      <h1 className="font-sans text-2xl leading-tight md:text-xl">
        {character.name}
      </h1>
      <p className="text-muted-foreground text-sm">
        {levelLine(character)} · {ownerLine(character)}
      </p>
    </div>
  );
}

/**
 * The membership strip with Leave / Add to campaign, and the confirmation
 * note under it.
 */
export function MembershipStrip({
  character,
  className,
}: {
  character: Character;
  className?: string;
}) {
  const campaign = useCampaign(character.campaignId);
  const roster = useRosterPerson(character.id);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  return (
    <div className={className}>
      <div className="bg-sidebar/60 border-foreground/15 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border px-3 py-2 text-sm">
        {campaign ? (
          <>
            <span>
              In{' '}
              <strong className="font-sans font-normal">{campaign.name}</strong>
              <span className="text-muted-foreground">
                {campaign.militia
                  ? roster
                    ? ` · on the militia roster${
                        roster.roles.length
                          ? ` as ${roster.roles.join(' and ')}`
                          : ''
                      }`
                    : ' · not on the militia roster'
                  : ' · no militia'}
              </span>
            </span>
            {canLeave(character) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={action}
                onClick={() => setLeaving(true)}
              >
                <LogOut /> Leave campaign
              </Button>
            ) : (
              <span className="text-muted-foreground text-xs">
                Only {userName(character.ownerId)} can take {character.name} out
                of the campaign.
              </span>
            )}
          </>
        ) : (
          <>
            <span>
              <strong className="font-sans font-normal">No campaign</strong>
              <span className="text-muted-foreground">
                {' '}
                · only you can see this Character
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              className={action}
              onClick={() => setAdding(true)}
            >
              <UserPlus /> Add to campaign
            </Button>
          </>
        )}
      </div>

      <NoticeBanner characterId={character.id} className="mt-3" />

      <AddToCampaignDialog
        characterId={character.id}
        open={adding}
        onOpenChange={setAdding}
      />
      {campaign && (
        <LeaveCampaignDialog
          characterId={character.id}
          open={leaving}
          onOpenChange={setLeaving}
        />
      )}
    </div>
  );
}

/**
 * The header of a Character page without a living sheet (Militia-only):
 * the title with its actions on the right, the membership strip below.
 * The shell's Back sits above. Sheet pages put the title in the vitals
 * row instead (`LivingSheet`'s `heading`).
 */
export function CharacterHeader({
  character,
  actions,
}: {
  character: Character;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <CharacterTitle character={character} />
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <MembershipStrip character={character} className="mt-3" />
    </div>
  );
}

// ------------------------------------------------- Militia-only editing

/** The name, edited in place; focused (and selected) when `focus` turns on. */
export function NameField({
  character,
  focus = false,
  className,
}: {
  character: Character;
  focus?: boolean;
  className?: string;
}) {
  const store = useBuilderStore();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focus) return;
    ref.current?.focus();
    ref.current?.select();
  }, [focus]);
  return (
    <TextField
      inputRef={ref}
      ariaLabel={`${character.name} name`}
      value={character.name}
      onChange={(v) => store.setName(character.id, v)}
      className={cn('font-sans', className)}
    />
  );
}

type PendingLower = { character: Character; level: number; removed: string[] };

/**
 * Militia-only level editing. Raising appends Unspecified levels; lowering
 * that would remove real Class Levels confirms first, naming them.
 */
export function useMilitiaLevel() {
  const store = useBuilderStore();
  const [pending, setPending] = useState<PendingLower | null>(null);
  const setLevel = (character: Character, level: number | null) => {
    if (level === null || level < 0 || level > 40) return;
    const removed = levelsRemovedBy(character, level);
    if (removed.length > 0) setPending({ character, level, removed });
    else store.setMilitiaLevel(character.id, level);
  };
  const dialog = (
    <Dialog
      open={pending !== null}
      onOpenChange={(o) => !o && setPending(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-sans">
            Lower {pending?.character.name} to level {pending?.level}?
          </DialogTitle>
          <DialogDescription>
            This removes real Class Levels and what they granted:
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 text-sm">
          {pending?.removed.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            variant="ghost"
            className={action}
            onClick={() => setPending(null)}
          >
            Keep
          </Button>
          <Button
            variant="destructive"
            className={action}
            onClick={() => {
              if (pending)
                store.setMilitiaLevel(pending.character.id, pending.level);
              setPending(null);
            }}
          >
            Lower to {pending?.level}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { setLevel, dialog };
}

export function LevelField({
  character,
  setLevel,
}: {
  character: Character;
  setLevel: (character: Character, level: number | null) => void;
}) {
  return (
    <NumField
      ariaLabel={`${character.name} level`}
      value={classLevels(character).length}
      width="w-12"
      onChange={(v) => setLevel(character, v)}
    />
  );
}

/** One of the six scores, the permanent total, edited in place. */
export function ScoreField({
  character,
  ability,
  value,
}: {
  character: Character;
  ability: (typeof ABILITIES)[number];
  value: number;
}) {
  const store = useBuilderStore();
  return (
    <NumField
      ariaLabel={`${character.name} ${ABILITY_LABEL[ability]}`}
      value={value}
      width="w-12"
      onChange={(v) =>
        v !== null && store.setMilitiaScore(character.id, ability, v)
      }
    />
  );
}

/** The six scores as a labelled 6-column grid (phone cards, the Militia-only sheet). */
export function MilitiaScoresGrid({
  character,
  editable,
  className,
}: {
  character: Character;
  editable: boolean;
  className?: string;
}) {
  const facts = militiaCharacterFacts(character);
  return (
    <div className={cn('grid grid-cols-6 gap-1 text-center', className)}>
      {ABILITIES.map((a) => (
        <span
          key={a}
          className="text-muted-foreground font-mono text-[11px] uppercase"
        >
          {ABILITY_SHORT[a]}
        </span>
      ))}
      {ABILITIES.map((a) =>
        editable ? (
          <span key={a} className="flex justify-center">
            <ScoreField
              character={character}
              ability={a}
              value={facts.scores[a]}
            />
          </span>
        ) : (
          <span key={a} className="font-mono text-base">
            {facts.scores[a]}
          </span>
        ),
      )}
    </div>
  );
}
