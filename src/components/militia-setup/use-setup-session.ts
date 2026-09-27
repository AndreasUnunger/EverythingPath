'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { campaignPath, weekPath } from '~/lib/campaign-routes';
import { newMilitiaSetup, type MilitiaSetup } from '~/lib/canonical-setup';
import {
  browserSetupStorage,
  readSetupEnvelope,
  retireSetupEnvelope,
  SETUP_ENVELOPE_VERSION,
  withCurrentCharacterFacts,
  writeSetupEnvelope,
  type SetupProgress,
  type SetupStorage,
} from '~/lib/setup-envelope';
import type { SetupStepKey } from '~/lib/setup-steps';
import type { GuidedSetupProps } from './use-guided-setup';

export type SetupSessionScope = {
  accountId: string;
  organizationId: string;
  campaignId: Id<'campaign'>;
};
// Something the player should know about keeping their entries.
export type SetupStorageNotice =
  /** Entries will not survive a reload or leaving the page. */
  | 'unkept'
  /** Entries from an earlier visit could not be restored. */
  | 'notRestored';
export type SetupSessionView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  /** Setup had already started when this page first loaded. */
  | {
      kind: 'started';
      week: number | null;
      weekHref: string;
      militiaHref: string;
    }
  /** Another player started the militia while this form was open. */
  | { kind: 'opening' }
  | {
      kind: 'form';
      notice: SetupStorageNotice | null;
      guided: Omit<GuidedSetupProps, 'addCharacter'>;
    };

type Entry =
  | { kind: 'started' }
  | {
      kind: 'form';
      restore: ReturnType<typeof readSetupEnvelope>['kind'];
      values: MilitiaSetup;
      step: SetupStepKey;
      visited: SetupStepKey[];
      initializationId: string;
    };
type Attempt = 'idle' | 'pending' | 'succeeded' | 'failed';

// Setup's entry, browser resume and start. The first authoritative options
// result decides the entry: an already-started militia shows the started
// page, even over a stale envelope; otherwise the form opens, resumed from
// this browser's envelope. A later completion by another player opens the
// accepted week; this player's own start opens its requested phase once.
export function useSetupSession({
  accountId,
  organizationId,
  campaignId,
  storage: givenStorage,
}: SetupSessionScope & {
  storage?: SetupStorage | null;
}): SetupSessionView {
  const scope = useMemo(
    () => ({ accountId, organizationId, campaignId }),
    [accountId, organizationId, campaignId],
  );
  const [storage] = useState(() =>
    givenStorage === undefined ? browserSetupStorage() : givenStorage,
  );
  const options = useQuery(api.canonicalSetup.options, { campaignId });
  const initialize = useMutation(api.canonicalSetup.initialize);
  const router = useRouter();

  const [entry, setEntry] = useState<Entry>();
  if (entry === undefined && options)
    setEntry(
      options.started
        ? { kind: 'started' }
        : openForm(readSetupEnvelope(storage, scope), options.characters),
    );
  const workspace = useQuery(
    api.canonicalDraftPersistence.workspace,
    entry?.kind === 'started' ? { campaignId } : 'skip',
  );

  const [attempt, setAttempt] = useState<Attempt>('idle');
  const [unkept, setUnkept] = useState(false);
  // Once setup has started, nothing may write the envelope again.
  const retired = useRef(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const staleEnvelope =
    entry?.kind === 'started' ||
    (entry?.kind === 'form' && entry.restore === 'discarded');
  useEffect(() => {
    if (staleEnvelope) retireSetupEnvelope(storage, scope);
  }, [staleEnvelope, storage, scope]);

  // Another player's completion wins unless this player's own start is in
  // flight or has succeeded; a failed start yields to it too.
  const startedElsewhere =
    entry?.kind === 'form' &&
    options?.started === true &&
    (attempt === 'idle' || attempt === 'failed');
  useEffect(() => {
    if (!startedElsewhere) return;
    retired.current = true;
    retireSetupEnvelope(storage, scope);
    router.replace(campaignPath(scope.campaignId, 'week'));
  }, [startedElsewhere, storage, scope, router]);

  if (options === undefined || (options && entry === undefined))
    return { kind: 'loading' };
  if (!options || !entry) return { kind: 'unavailable' };
  if (entry.kind === 'started')
    return {
      kind: 'started',
      week: workspace?.week ?? null,
      weekHref: campaignPath(campaignId, 'week'),
      militiaHref: campaignPath(campaignId, 'militia'),
    };
  if (startedElsewhere) return { kind: 'opening' };

  const form = entry;
  function persist(progress: SetupProgress) {
    if (retired.current) return;
    const kept = writeSetupEnvelope(storage, {
      version: SETUP_ENVELOPE_VERSION,
      scope,
      initializationId: form.initializationId,
      ...progress,
    });
    if (!kept) setUnkept(true);
  }
  async function save(setup: MilitiaSetup) {
    if (inFlight.current) return;
    inFlight.current = true;
    setAttempt('pending');
    try {
      // Every attempt, including one after a reload, reuses this identity, so
      // an unacknowledged start retried with the same values is idempotent and
      // a different one cannot replace an accepted setup.
      await initialize({
        campaignId: scope.campaignId,
        initializationId: form.initializationId,
        setup,
      });
    } catch (error) {
      inFlight.current = false;
      setAttempt('failed');
      throw error;
    }
    retired.current = true;
    retireSetupEnvelope(storage, scope);
    setAttempt('succeeded');
    // A player who has left this page, or switched campaign, stays put.
    if (mounted.current) router.push(weekPath(scope.campaignId, setup.phase));
  }
  return {
    kind: 'form',
    notice:
      unkept || form.restore === 'unavailable'
        ? 'unkept'
        : form.restore === 'discarded'
          ? 'notRestored'
          : null,
    guided: {
      characters: options.characters,
      initialValues: form.values,
      initialStep: form.step,
      initialVisited: form.visited,
      resumed: form.restore === 'restored',
      onProgress: persist,
      onSave: save,
      starting: attempt === 'succeeded',
    },
  };
}

function openForm(
  restore: ReturnType<typeof readSetupEnvelope>,
  characters: Parameters<typeof withCurrentCharacterFacts>[1],
): Entry {
  if (restore.kind === 'restored') {
    const { values, step, visited, initializationId } = restore.envelope;
    return {
      kind: 'form',
      restore: restore.kind,
      values: withCurrentCharacterFacts(values, characters),
      step,
      visited,
      initializationId,
    };
  }
  return {
    kind: 'form',
    restore: restore.kind,
    values: newMilitiaSetup('Loyalty'),
    step: 'startingPoint',
    visited: ['startingPoint'],
    initializationId: crypto.randomUUID(),
  };
}
