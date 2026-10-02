'use client';
import { useQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMemo, useState } from 'react';
import type { CharacterRecord } from '~/components/character-manager/types';
import { campaignPath, militiaPath, weekPath } from '~/lib/campaign-routes';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import {
  archiveKeeps,
  characterRows,
  officerBoard,
  pendingRoleChanges,
  type CharacterRow,
  type PendingRoleChange,
  type RoleCard,
} from '~/lib/officer-board';

type Snapshot = CanonicalWeekState['militiaSnapshot'];

/** Which record dialog is open: a new record, or an existing one by id. */
export type RecordDialogTarget = { kind: 'add' } | { kind: 'edit'; id: string };

export type CharactersPageView =
  | { status: 'loading' }
  | {
      status: 'ready';
      /** The accepted militia and its open week; null before Setup. */
      militia: { militiaId: Id<'militia'>; draftId: string } | null;
      /** Every character record of the campaign, archived included. */
      records: CharacterRecord[];
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
      links: { activity: string; teams: string; setup: string };
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
      /**
       * The same page over another militia: an open correction's result,
       * shown in place of the accepted board and rows.
       */
      present: (snapshot: Snapshot) => CharactersPage;
    };
export type CharactersPage = Extract<CharactersPageView, { status: 'ready' }>;

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
  const { data: records } = useQuery({
    ...convexQuery(api.character.listByCampaign, {
      campaignId,
      organizationId,
      includeInactive: true,
    }),
    throwOnError: true,
  });
  const { data: source } = useQuery({
    ...convexQuery(api.canonicalDraftPersistence.workspace, {
      campaignId,
    }),
    throwOnError: true,
  });
  const { data: observation } = useQuery({
    ...convexQuery(
      api.canonicalDraftPersistence.observe,
      source ? source.key : 'skip',
    ),
    throwOnError: true,
  });
  const [showArchived, setShowArchived] = useState(false);
  // The campaign and organization the page has loaded for, with its open
  // record dialog: a scope change closes the dialog and loads again.
  const [scoped, setScoped] = useState<{
    campaignId: Id<'campaign'>;
    organizationId: string;
    target: RecordDialogTarget | null;
  } | null>(null);
  const sameScope =
    scoped?.campaignId === campaignId &&
    scoped.organizationId === organizationId;
  const target = sameScope ? scoped.target : null;
  const setTarget = (next: RecordDialogTarget | null) =>
    setScoped({ campaignId, organizationId, target: next });

  const pending = useMemo(() => {
    if (!records) return [];
    const names = new Map(records.map((record) => [record._id, record.name]));
    return observation?.status === 'open' && observation.draft
      ? pendingRoleChanges(observation.draft.activity.slots, names)
      : [];
  }, [records, observation]);

  // With a militia, the first load waits for the open week too, so pending
  // changes never appear late. Later, a new week's draft (another player
  // confirmed) is briefly unobserved: the page stays, with no pending
  // changes until the new week's arrive, so an open record dialog keeps its
  // unsaved input (#141, #198).
  if (!records || source === undefined) return { status: 'loading' };
  if (source && observation === undefined && !sameScope)
    return { status: 'loading' };
  if (!sameScope) setScoped({ campaignId, organizationId, target: null });

  const names = new Map(records.map((record) => [record._id, record.name]));
  const militia = source
    ? { militiaId: source.key.militiaId, draftId: source.key.draftId }
    : null;

  function present(snapshot: Snapshot | null): CharactersPage {
    const rows = characterRows({
      records: records!,
      roster: snapshot?.roster ?? null,
      characters: snapshot?.characters ?? [],
    });
    const visible = showArchived ? rows : rows.filter((row) => !row.archived);
    const activeCount = rows.filter((row) => !row.archived).length;
    const archivedCount = rows.length - activeCount;
    const record =
      target?.kind === 'edit'
        ? records!.find((value) => value._id === target.id)
        : undefined;
    const editedRow =
      target?.kind === 'edit'
        ? rows.find((row) => row.characterId === target.id)
        : undefined;
    return {
      status: 'ready',
      militia,
      records: records!,
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
      pending,
      rows: visible,
      counts: {
        onRoster: rows.filter((row) => row.onRoster).length,
        notOnRoster: rows.filter((row) => !row.onRoster && !row.archived)
          .length,
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
      present,
    };
  }

  return present(source?.snapshot ?? null);
}
