import type { CanonicalWeekState } from './canonical-weekly-source';
import type { StagedReference } from './correction-staged-choices';
import type {
  MilitiaSectionKey,
  SectionValues,
} from './militia-correction-sections';

// Same-identity restoration: when a correction removed something the open
// week's choices still use, an ordinary section correction can add it back
// under the identity those choices refer to, rather than a new one. Only
// facts this device saw accepted are reused; anything else is entered again.

type Snapshot = CanonicalWeekState['militiaSnapshot'];
type Team = SectionValues['teams'][number];
type Settlement = SectionValues['settlements'][number];

type Rows = { team: Team; settlement: Settlement };
/** Identity kinds a section correction can restore. */
export type RestorableKind = keyof Rows;
export type RestorableRow<K extends RestorableKind = RestorableKind> = Rows[K];

type Adapter<K extends RestorableKind> = {
  section: MilitiaSectionKey;
  rows: (snapshot: Snapshot) => readonly Rows[K][];
  identity: (row: Rows[K]) => string;
  /** The row to fill in when no facts were captured for the identity. */
  blank: (id: string) => Rows[K];
};

// Facts nobody entered stay unset or unrecorded: the player enters the name,
// type and condition, and the form reports them as required.
const unset = undefined as never;
const adapters: { [K in RestorableKind]: Adapter<K> } = {
  team: {
    section: 'teams',
    rows: (snapshot) => snapshot.roster.teams,
    identity: (team) => team.teamId,
    blank: (teamId) => ({
      teamId,
      name: '',
      teamType: unset,
      status: unset,
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    }),
  },
  settlement: {
    section: 'settlements',
    rows: (snapshot) => snapshot.settlements,
    identity: (town) => town.settlementId,
    blank: (settlementId) => ({
      settlementId,
      name: '',
      reputation: null,
      secured: null,
      occupied: null,
      temporaryReputationShift: null,
      refugeActivatedWeek: null,
      refugeActiveUntilWeek: null,
    }),
  },
};
const kinds = Object.keys(adapters) as RestorableKind[];

const isRestorable = (kind: string): kind is RestorableKind => kind in adapters;

/** The kinds of identity the section's correction can restore. */
export function restorableKinds(section: MilitiaSectionKey): RestorableKind[] {
  return kinds.filter((kind) => adapters[kind].section === section);
}

/** Accepted rows last seen on this device, by kind and identity. */
export type CapturedFacts = {
  readonly [K in RestorableKind]: ReadonlyMap<string, Rows[K]>;
};
export const noCapturedFacts: CapturedFacts = {
  team: new Map(),
  settlement: new Map(),
};

function remember<K extends RestorableKind>(
  kind: K,
  previous: ReadonlyMap<string, Rows[K]>,
  snapshot: Snapshot,
) {
  const adapter = adapters[kind] as Adapter<K>;
  const next = new Map(previous);
  for (const row of adapter.rows(snapshot))
    next.set(adapter.identity(row), row);
  return next;
}

/**
 * Adds the newest accepted facts to what this device has seen. A row that a
 * correction removed keeps the facts it had just before.
 */
export function rememberFacts(
  previous: CapturedFacts,
  snapshot: Snapshot,
): CapturedFacts {
  return {
    team: remember('team', previous.team, snapshot),
    settlement: remember('settlement', previous.settlement, snapshot),
  };
}

export type MissingIdentity<K extends RestorableKind = RestorableKind> =
  K extends RestorableKind
    ? {
        kind: K;
        id: string;
        /** The open week's choices that use it. */
        neededBy: StagedReference[];
        /** Its accepted facts, when this device saw them. */
        captured: Rows[K] | null;
      }
    : never;

/** The missing identities of one kind, e.g. items to restore before caches. */
export function missingOfKind<K extends RestorableKind>(
  identities: readonly MissingIdentity[],
  kind: K,
): MissingIdentity<K>[] {
  return identities.filter(
    (identity): identity is MissingIdentity<K> => identity.kind === kind,
  );
}

/**
 * The restorable identities the open week's staged choices use but the
 * militia lacks, in the order the week first needs them. Carried context is
 * never broken by a saved correction, so it is not listed.
 */
export function missingIdentities(
  references: readonly StagedReference[],
  captured: CapturedFacts,
): MissingIdentity[] {
  const found = new Map<string, MissingIdentity>();
  for (const reference of references) {
    if (reference.phase === null) continue;
    for (const { kind, id } of reference.missing) {
      if (!isRestorable(kind)) continue;
      const key = `${kind}:${id}`;
      const entry =
        found.get(key) ??
        ({
          kind,
          id,
          neededBy: [],
          captured: captured[kind].get(id) ?? null,
        } as MissingIdentity);
      entry.neededBy.push(reference);
      found.set(key, entry);
    }
  }
  return [...found.values()];
}

/** The row that restores a missing identity: its captured facts, or blank. */
export function restoredRow<K extends RestorableKind>(
  missing: MissingIdentity<K>,
): Rows[K] {
  const adapter: Adapter<K> = adapters[missing.kind as K];
  return (missing.captured as Rows[K] | null) ?? adapter.blank(missing.id);
}

/** Whether a section's rows already hold the identity. */
export function holdsIdentity(
  kind: RestorableKind,
  rows: readonly RestorableRow[],
  id: string,
) {
  const identity = adapters[kind].identity as (row: RestorableRow) => string;
  return rows.some((row) => identity(row) === id);
}
