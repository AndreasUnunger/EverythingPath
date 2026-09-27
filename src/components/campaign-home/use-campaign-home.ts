'use client';
import { useEffect, useRef, useState } from 'react';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { campaignQuery } from '~/lib/sharedQueries';
import { campaignPath } from '~/lib/campaign-routes';
import { useNavigationGuard } from '~/components/campaign-shell/navigation-guard';
import { useSession } from '~/components/campaign-shell/session';
import {
  classifyList,
  resolveSelection,
  type HomeList,
  type HomeSelection,
  type Opening,
  type Organization,
} from './home-state';
import { useCreateCampaign, type CreateCampaign } from './use-create-campaign';

export type CampaignHomeList = { list: HomeList; retry: () => void };

/** The active organization's authorized campaign list, once the session settles. */
export function useCampaignHomeList(): CampaignHomeList {
  const session = useSession();
  const organization =
    session.kind === 'member' ? session.organization : undefined;
  const query = campaignQuery(organization?.id, organization !== undefined);
  return {
    list: classifyList(session, query),
    retry: () => {
      void query.refetch();
    },
  };
}

export type CampaignHomeSelection = HomeSelection & {
  create: CreateCampaign;
  /** A concise outcome for the live region, e.g. after a create. */
  announcement: string | null;
  startCreate: () => void;
  cancelCreate: () => void;
  /** Call when an existing row is chosen: leaves the local create form. */
  choose: () => void;
};

// Local create and selection state for one organization. Mount it keyed by
// the organization so none of it, and no late create result, carries into
// another organization.
export function useCampaignHomeSelection({
  organization,
  campaigns,
  requested,
}: {
  organization: Organization;
  campaigns: Doc<'campaign'>[];
  requested: string | null;
}): CampaignHomeSelection {
  const guard = useNavigationGuard();
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  // Read by the create acknowledgement, which may arrive after the player
  // has moved on: the new campaign is then listed but not selected.
  const current = useRef({ creating, requested, alive: true });
  current.current.creating = creating;
  current.current.requested = requested;
  useEffect(() => {
    const state = current.current;
    state.alive = true;
    return () => {
      state.alive = false;
    };
  }, []);

  const create = useCreateCampaign(
    organization.id,
    (campaignId: Id<'campaign'>, name: string) => {
      const state = current.current;
      if (!state.alive) return;
      setAnnouncement(`Created ${name}.`);
      if (!state.creating) return;
      setCreating(false);
      setOpening({ campaignId, name, from: state.requested });
      guard.navigate(campaignPath(campaignId));
    },
  );

  const selection = resolveSelection({
    campaigns,
    organization,
    requested,
    creating,
    opening,
  });
  // Adjust during render once the new home is shown or the player moved on.
  if (selection.openingSettled) setOpening(null);

  return {
    ...selection,
    create,
    announcement,
    startCreate: () => {
      setAnnouncement(null);
      setCreating(true);
    },
    cancelCreate: () => setCreating(false),
    choose: () => {
      setCreating(false);
      setOpening(null);
    },
  };
}
