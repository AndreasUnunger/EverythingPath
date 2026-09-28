'use client';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMemo, useState } from 'react';
import type { CharacterRecord } from '~/components/character-manager/types';
import { campaignPath, militiaPath, weekPath } from '~/lib/campaign-routes';
import {
  archiveKeeps,
  characterRows,
  officerBoard,
  pendingRoleChanges,
  type CharacterRow,
  type OfficerRole,
  type PendingRoleChange,
  type RoleCard,
} from '~/lib/officer-board';

/** Which record dialog is open: a new record, or an existing one by id. */
export type RecordDialogTarget = { kind: 'add' } | { kind: 'edit'; id: string };

export type CharactersPageView =
  | { status: 'loading' }
  | {
      status: 'ready';
      /** The accepted militia's officers; null before Setup. */
      officers: {
        focus: string | null;
        cards: RoleCard[];
      } | null;
      /** Pending Change Officer Role actions of the open week. */
      pending: PendingRoleChange[];
      /** Rows shown with the current Show archived choice. */
      rows: CharacterRow[];
      counts: { onRoster: number; notOnRoster: number };
      /** "No active characters." / "No archived characters.", or null. */
      emptyMessage: string | null;
      showArchived: boolean;
      setShowArchived: (show: boolean) => void;
      links: { activity: string; teams: string; setup: string; people: string };
      dialog: {
        target: RecordDialogTarget | null;
        /** The record being edited, as currently stored. */
        record: CharacterRecord | undefined;
        /** "Archiving keeps Dalla Rook as Commandant.", or null. */
        archiveWarning: string | null;
        openAdd: () => void;
        openEdit: (characterId: string) => void;
        close: () => void;
      };
    };

// Characters & officers: the campaign's character records with the accepted
// roster's officer effects and the open week's pending officer changes.
// Records work before Setup; the officer board needs an accepted militia.
export function useCharactersPage({
  campaignId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
}): CharactersPageView {
  const records = useQuery(api.character.listByCampaign, {
    campaignId,
    organizationId,
    includeInactive: true,
  });
  const source = useQuery(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  const observation = useQuery(
    api.canonicalDraftPersistence.observe,
    source ? source.key : 'skip',
  );
  const [showArchived, setShowArchived] = useState(false);
  const [target, setTarget] = useState<RecordDialogTarget | null>(null);

  const derived = useMemo(() => {
    if (!records || source === undefined) return null;
    const snapshot = source?.snapshot ?? null;
    const names = new Map(records.map((record) => [record._id, record.name]));
    const pending =
      observation?.status === 'open' && observation.draft
        ? pendingRoleChanges(observation.draft.activity.slots, names)
        : [];
    const rows = characterRows({
      records,
      roster: snapshot?.roster ?? null,
      characters: snapshot?.characters ?? [],
    });
    return {
      pending,
      rows,
      officers: snapshot
        ? {
            focus: snapshot.focus,
            cards: officerBoard({
              roster: snapshot.roster,
              characters: snapshot.characters,
              names,
              focus: snapshot.focus,
              pending,
            }),
          }
        : null,
    };
  }, [records, source, observation]);

  if (!records || !derived) return { status: 'loading' };
  const { rows } = derived;
  const visible = showArchived ? rows : rows.filter((row) => !row.archived);
  const activeCount = rows.filter((row) => !row.archived).length;
  const archivedCount = rows.length - activeCount;
  const record =
    target?.kind === 'edit'
      ? records.find((value) => value._id === target.id)
      : undefined;
  const editedRow =
    target?.kind === 'edit'
      ? rows.find((row) => row.characterId === target.id)
      : undefined;

  return {
    status: 'ready',
    officers: derived.officers,
    pending: derived.pending,
    rows: visible,
    counts: {
      onRoster: rows.filter((row) => row.onRoster).length,
      notOnRoster: rows.filter((row) => !row.onRoster && !row.archived).length,
    },
    emptyMessage:
      showArchived && archivedCount === 0
        ? 'No archived characters.'
        : !showArchived && activeCount === 0
          ? 'No active characters.'
          : null,
    showArchived,
    setShowArchived,
    links: {
      activity: weekPath(campaignId, 'activity'),
      teams: militiaPath(campaignId, 'teams'),
      setup: campaignPath(campaignId, 'setup'),
      people: militiaPath(campaignId, 'people'),
    },
    dialog: {
      target,
      record,
      archiveWarning:
        editedRow && !editedRow.archived ? archiveKeeps(editedRow) : null,
      openAdd: () => setTarget({ kind: 'add' }),
      openEdit: (id) => setTarget({ kind: 'edit', id }),
      close: () => setTarget(null),
    },
  };
}

/** The DOM id of a role card, so a role chip can move focus to it. */
export function roleCardId(role: OfficerRole) {
  return `role-${role}`;
}
