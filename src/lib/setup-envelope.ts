import { z } from 'zod';
import { militiaSetupFieldsSchema, type MilitiaSetup } from './canonical-setup';
import { SETUP_STEP_KEYS, type SetupStepKey } from './setup-steps';

// Browser resume for an unfinished Militia Setup (#173). The form's raw
// values, open step and start-attempt identity are kept in this browser only,
// under the signed-in account, organization and campaign. Nothing here is
// shared or sent to the server.
//
// The shape is versioned so a later change can migrate stored envelopes.
// Version 1 stores the values of this shipping stage: character-record kinds
// `pc | officer_npc`, roster kinds `pc | officer_npc | other_npc` and required
// commandant Hit Dice. The Characters & officers kind migration (#180) owns
// the next version: it must read version 1 in `parseSetupEnvelope` and map
// roster kinds, Hit Dice and character facts to its shape rather than
// discarding players' unfinished setups.
export const SETUP_ENVELOPE_VERSION = 1;

export type SetupScope = {
  accountId: string;
  organizationId: string;
  campaignId: string;
};
// Where the form is: its raw values (malformed or empty numbers included),
// the open step and the steps already visited.
export type SetupProgress = {
  values: MilitiaSetup;
  step: SetupStepKey;
  visited: SetupStepKey[];
};
export type SetupEnvelope = SetupProgress & {
  version: typeof SETUP_ENVELOPE_VERSION;
  scope: SetupScope;
  /** Reused by every start attempt, so an unacknowledged start is retried idempotently. */
  initializationId: string;
};
export type SetupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type SetupRestore =
  | { kind: 'fresh' }
  | { kind: 'restored'; envelope: SetupEnvelope }
  /** Something was stored but cannot be used; retire it. */
  | { kind: 'discarded' }
  /** This browser refuses storage; setup still works without resume. */
  | { kind: 'unavailable' };

export function setupEnvelopeKey({
  accountId,
  organizationId,
  campaignId,
}: SetupScope) {
  return `everythingpath:militia-setup:${[accountId, organizationId, campaignId]
    .map(encodeURIComponent)
    .join(':')}`;
}

export function browserSetupStorage(): SetupStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const stepSchema = z.enum(SETUP_STEP_KEYS as [SetupStepKey, ...SetupStepKey[]]);
const envelopeV1Schema = z.strictObject({
  version: z.literal(1),
  scope: z.strictObject({
    accountId: z.string(),
    organizationId: z.string(),
    campaignId: z.string(),
  }),
  values: z.unknown(),
  step: stepSchema,
  visited: z.array(stepSchema),
  initializationId: z.string().trim().min(1).max(200),
});

export function parseSetupEnvelope(
  raw: unknown,
  scope: SetupScope,
): SetupEnvelope | null {
  const version =
    raw !== null && typeof raw === 'object' && 'version' in raw
      ? raw.version
      : undefined;
  switch (version) {
    case 1: {
      const parsed = envelopeV1Schema.safeParse(raw);
      if (
        !parsed.success ||
        setupEnvelopeKey(parsed.data.scope) !== setupEnvelopeKey(scope) ||
        !isEditableSetup(parsed.data.values)
      )
        return null;
      return { ...parsed.data, values: parsed.data.values };
    }
    default:
      return null;
  }
}

// Reading never changes storage, so a repeated render reads the same result.
export function readSetupEnvelope(
  storage: SetupStorage | null,
  scope: SetupScope,
): SetupRestore {
  if (!storage) return { kind: 'unavailable' };
  let stored: string | null;
  try {
    stored = storage.getItem(setupEnvelopeKey(scope));
  } catch {
    return { kind: 'unavailable' };
  }
  if (stored === null) return { kind: 'fresh' };
  let envelope: SetupEnvelope | null = null;
  try {
    envelope = parseSetupEnvelope(JSON.parse(stored), scope);
  } catch {
    // Not JSON: discarded below.
  }
  return envelope ? { kind: 'restored', envelope } : { kind: 'discarded' };
}

/** Returns false when this browser refused to keep the envelope. */
export function writeSetupEnvelope(
  storage: SetupStorage | null,
  envelope: SetupEnvelope,
) {
  if (!storage) return false;
  try {
    storage.setItem(setupEnvelopeKey(envelope.scope), JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/** Once setup has started, its unfinished envelope must never return. */
export function retireSetupEnvelope(
  storage: SetupStorage | null,
  scope: SetupScope,
) {
  try {
    storage?.removeItem(setupEnvelopeKey(scope));
  } catch {
    // Nothing more can be done; a later read discards it again.
  }
}

// Stored values must have the form's shape: every group and list where the
// editors expect it, and only choices the editors offer. Leaves may be
// unfinished (empty, malformed or out of range) because the form keeps such
// input for repair; cross-reference problems are the form's to show.
const repairableCodes = new Set([
  'too_small',
  'too_big',
  'not_multiple_of',
  'invalid_format',
  'custom',
]);
const leafTypes = new Set(['number', 'string', 'boolean']);
function isLeaf(value: unknown) {
  return value === null || typeof value !== 'object';
}
function valueAt(root: unknown, path: readonly PropertyKey[]) {
  return path.reduce<unknown>(
    (value, key) =>
      value !== null && typeof value === 'object'
        ? (value as Record<PropertyKey, unknown>)[key]
        : undefined,
    root,
  );
}
function isEditableSetup(values: unknown): values is MilitiaSetup {
  const parsed = militiaSetupFieldsSchema.safeParse(values);
  return (
    parsed.success ||
    parsed.error.issues.every((issue) => {
      if (issue.code === 'custom') return true;
      if (!isLeaf(valueAt(values, issue.path))) return false;
      return issue.code === 'invalid_type'
        ? leafTypes.has(issue.expected)
        : repairableCodes.has(issue.code);
    })
  );
}

type SetupCharacterFacts =
  MilitiaSetup['state']['militiaSnapshot']['characters'][number];
// A restored roster takes each character's current ledger facts, so a reload
// repairs a start that failed because a character changed since it was
// added. Characters no longer in the ledger stay for the player to remove.
export function withCurrentCharacterFacts(
  values: MilitiaSetup,
  characters: readonly (SetupCharacterFacts & { name: string })[],
): MilitiaSetup {
  const current = new Map(
    characters.map(({ name: _name, ...facts }) => [facts.characterId, facts]),
  );
  const snapshot = values.state.militiaSnapshot;
  return {
    ...values,
    state: {
      ...values.state,
      militiaSnapshot: {
        ...snapshot,
        characters: snapshot.characters.map(
          (character) => current.get(character.characterId) ?? character,
        ),
      },
    },
  };
}
