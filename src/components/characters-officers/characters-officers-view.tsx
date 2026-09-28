'use client';
import { ArrowRight, Plus } from 'lucide-react';
import { useId } from 'react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import { useWideLayout } from '~/components/militia-corrections/use-wide-layout';
import { BOARD_ROLES, ROLE_LABELS } from '~/lib/officer-board';
import { CharacterCards, CharacterTable } from './character-rows';
import { RoleCardView, UnassignedRoleCard } from './role-card';
import type { CharactersPageView } from './use-characters-page';

type Page = Extract<CharactersPageView, { status: 'ready' }>;

const action = 'min-h-11 md:min-h-9';
const board = 'grid grid-cols-2 gap-3 md:grid-cols-3';

function Officers({ page }: { page: Page }) {
  const headingId = useId();
  const { officers } = page;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2 id={headingId} className="font-sans text-2xl">
          Officers
        </h2>
        {officers?.focus && (
          <p className="text-muted-foreground text-sm">
            Focus: {officers.focus}
          </p>
        )}
        {officers === null && (
          <Button asChild variant="outline" className={`${action} ml-auto`}>
            <GuardedLink href={page.links.setup}>Set up militia</GuardedLink>
          </Button>
        )}
      </div>
      {officers === null ? (
        <div className={board}>
          {BOARD_ROLES.map((role) => (
            <UnassignedRoleCard key={role} label={ROLE_LABELS[role]} />
          ))}
        </div>
      ) : (
        <div className={board}>
          {officers.cards.map((card) => (
            <RoleCardView key={card.role} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

function PendingBar({ page }: { page: Page }) {
  if (page.pending.length === 0) return null;
  return (
    <div className="border-foreground/20 flex flex-col gap-x-3 gap-y-1 border p-3 sm:flex-row sm:flex-wrap sm:items-baseline">
      <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
        Pending this week
      </p>
      <ul className="min-w-0 flex-1 space-y-0.5 text-sm">
        {page.pending.map((change) => (
          <li key={change.key} className="[overflow-wrap:anywhere]">
            {change.text}
          </li>
        ))}
      </ul>
      <GuardedLink
        href={page.links.activity}
        className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4 md:min-h-0"
      >
        Go to Activity
        <ArrowRight aria-hidden className="size-4" />
      </GuardedLink>
    </div>
  );
}

function Characters({ page }: { page: Page }) {
  const headingId = useId();
  const showArchivedId = useId();
  const wide = useWideLayout();
  const rowProps = {
    rows: page.rows,
    hasBoard: page.officers !== null,
    teamsHref: page.links.teams,
    onEdit: page.dialog.openEdit,
  };
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={headingId} className="font-sans text-2xl">
          Characters
        </h2>
        {page.officers !== null && (
          <p className="text-muted-foreground text-sm">
            {page.counts.onRoster} on the roster · {page.counts.notOnRoster} not
          </p>
        )}
        <label
          htmlFor={showArchivedId}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm select-none md:min-h-9"
        >
          <input
            id={showArchivedId}
            type="checkbox"
            className="accent-primary size-4"
            checked={page.showArchived}
            onChange={(event) => page.setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
        <Button
          type="button"
          variant="outline"
          className={`${action} ml-auto`}
          onClick={page.dialog.openAdd}
        >
          <Plus /> Add character
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Officer roles and roster membership are corrected under{' '}
        <GuardedLink
          href={page.links.people}
          className="text-foreground underline underline-offset-4"
        >
          People &amp; officers
        </GuardedLink>{' '}
        on Militia.
      </p>
      <PendingBar page={page} />
      {page.rows.length > 0 &&
        (wide ? (
          <CharacterTable {...rowProps} />
        ) : (
          <CharacterCards {...rowProps} />
        ))}
      {page.emptyMessage !== null && (
        <p className="text-muted-foreground text-sm">{page.emptyMessage}</p>
      )}
    </section>
  );
}

// Characters & officers: the officer board over the character rows. Roster
// and officer corrections are on Militia; here records are added and edited.
export function CharactersOfficersView({ page }: { page: Page }) {
  return (
    <div className="min-w-0 space-y-8">
      <Officers page={page} />
      <Characters page={page} />
    </div>
  );
}
