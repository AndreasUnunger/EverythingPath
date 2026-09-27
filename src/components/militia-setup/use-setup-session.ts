'use client';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
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
  type SetupRestore,
  type SetupStorage,
} from '~/lib/setup-envelope';
import type { GuidedSetupProps } from './use-guided-setup';

export type SetupSessionScope = {
  accountId: string;
  organizationId: string;
  campaignId: Id<'campaign'>;
};
// Something the player should know about keeping their entries.
export type SetupNotice =
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
      notice: SetupNotice | null;
      guided: Omit<GuidedSetupProps, 'onAddCharacter'>;
    };

type FormEntry = SetupProgress & {
  kind: 'form';
  restore: SetupRestore['kind'];
  initializationId: string;
  /** A start sent before a reload whose result never arrived. */
  submitted: MilitiaSetup | null;
};
type Entry = { kind: 'started' } | FormEntry;
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
        : formEntry(readSetupEnvelope(storage, scope), options.characters),
    );
  const workspace = useQuery(
    api.canonicalDraftPersistence.workspace,
    entry?.kind === 'started' ? { campaignId } : 'skip',
  );

  const [attempt, setAttempt] = useState<Attempt>('idle');
  const [unkept, setUnkept] = useState(false);
  // What the envelope holds besides the entry: the latest form position and
  // the source of a start whose result is unknown.
  const latest = useRef<{
    progress?: SetupProgress;
    submitted?: MilitiaSetup | null;
  }>({});
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

  const form = entry?.kind === 'form' ? entry : null;
  function persist(progress?: SetupProgress, submitted?: MilitiaSetup | null) {
    if (!form || retired.current) return;
    latest.current = {
      progress: progress ?? latest.current.progress,
      submitted: submitted === undefined ? latest.current.submitted : submitted,
    };
    const kept = writeSetupEnvelope(storage, {
      version: SETUP_ENVELOPE_VERSION,
      scope,
      ...(latest.current.progress ?? form),
      initializationId: form.initializationId,
      submitted:
        latest.current.submitted === undefined
          ? form.submitted
          : latest.current.submitted,
    });
    if (!kept) setUnkept(true);
  }
  async function save(setup: MilitiaSetup) {
    if (!form || inFlight.current) return;
    inFlight.current = true;
    setAttempt('pending');
    // Kept before sending, so a reload before the result retries this source.
    persist(undefined, setup);
    try {
      // Every attempt, including one after a reload, reuses this identity, so
      // a start retried with the same source is idempotent and a different
      // source cannot replace an accepted setup.
      await initialize({
        campaignId: scope.campaignId,
        initializationId: form.initializationId,
        setup,
      });
    } catch (error) {
      inFlight.current = false;
      persist(undefined, null);
      setAttempt('failed');
      throw error;
    }
    retired.current = true;
    retireSetupEnvelope(storage, scope);
    setAttempt('succeeded');
    // A player who has left this page, or switched campaign, stays put.
    if (mounted.current) router.push(weekPath(scope.campaignId, setup.phase));
  }

  // A start sent before a reload may be the one that just started the
  // militia: resending its source under the same identity finds out.
  const unacknowledged = form && attempt === 'idle' ? form.submitted : null;
  // Otherwise another player's completion wins unless this player's own
  // start is in flight or has succeeded; a failed start yields to it too.
  const startedElsewhere =
    form !== null &&
    options?.started === true &&
    (attempt === 'idle' || attempt === 'failed');
  const followStarted = useEffectEvent(() => {
    if (unacknowledged) {
      save(unacknowledged).catch(() => undefined);
      return;
    }
    retired.current = true;
    retireSetupEnvelope(storage, scope);
    router.replace(campaignPath(scope.campaignId, 'week'));
  });
  useEffect(() => {
    if (startedElsewhere) followStarted();
  }, [startedElsewhere]);

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
  if (startedElsewhere && !unacknowledged) return { kind: 'opening' };
  return {
    kind: 'form',
    notice: storageNotice(entry.restore, unkept),
    guided: {
      characters: options.characters,
      initialValues: entry.values,
      initialStep: entry.step,
      initialVisited: entry.visited,
      resumed: entry.restore === 'restored',
      onProgress: (progress) => persist(progress),
      onSave: save,
      // Start stays disabled while a start is out or its week is opening.
      starting:
        attempt === 'pending' ||
        attempt === 'succeeded' ||
        (startedElsewhere && unacknowledged !== null),
    },
  };
}

function storageNotice(
  restore: SetupRestore['kind'],
  unkept: boolean,
): SetupNotice | null {
  if (unkept || restore === 'unavailable') return 'unkept';
  if (restore === 'discarded') return 'notRestored';
  return null;
}

// The form's starting point: the restored envelope, with each roster
// character's current ledger facts, or a New militia's defaults.
function formEntry(
  restore: SetupRestore,
  characters: Parameters<typeof withCurrentCharacterFacts>[1],
): FormEntry {
  if (restore.kind === 'restored') {
    const { values, step, visited, initializationId, submitted } =
      restore.envelope;
    return {
      kind: 'form',
      restore: restore.kind,
      values: withCurrentCharacterFacts(values, characters),
      step,
      visited,
      initializationId,
      submitted,
    };
  }
  return {
    kind: 'form',
    restore: restore.kind,
    values: newMilitiaSetup('Loyalty'),
    step: 'startingPoint',
    visited: ['startingPoint'],
    initializationId: crypto.randomUUID(),
    submitted: null,
  };
}
