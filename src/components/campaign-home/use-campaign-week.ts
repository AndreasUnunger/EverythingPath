'use client';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export type CampaignWeek =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'not_set_up' }
  | { kind: 'week'; week: number };

type Read<T> = { data?: T; error?: unknown };

// A campaign without a started militia has no workspace. The week number
// lives on the open draft, so a set-up campaign reads that too. Loading and
// failure are never "Not set up".
export function campaignWeek(
  workspace: Read<{ key: unknown } | null>,
  observed: Read<{ draft: { week: number } | null }>,
): CampaignWeek {
  if (workspace.error) return { kind: 'failed' };
  if (workspace.data === undefined) return { kind: 'loading' };
  if (workspace.data === null) return { kind: 'not_set_up' };
  if (observed.error) return { kind: 'failed' };
  // A closed draft is momentary: its successor arrives with the workspace.
  const draft = observed.data?.draft;
  return draft ? { kind: 'week', week: draft.week } : { kind: 'loading' };
}

/** "Week N" or "Not set up" for one authorized campaign row. */
export function useCampaignWeek(campaignId: Id<'campaign'>): CampaignWeek {
  const workspace = useQuery(
    convexQuery(api.canonicalDraftPersistence.workspace, { campaignId }),
  );
  const key = workspace.data?.key;
  const observed = useQuery(
    convexQuery(api.canonicalDraftPersistence.observe, key ?? 'skip'),
  );
  return campaignWeek(workspace, observed);
}
