import { expect, test } from 'vitest';
import { newMilitiaSetup, type MilitiaSetup } from './canonical-setup';
import {
  SETUP_ENVELOPE_VERSION,
  readSetupEnvelope,
  retireSetupEnvelope,
  setupEnvelopeKey,
  withCurrentCharacterFacts,
  writeSetupEnvelope,
  type SetupEnvelope,
  type SetupScope,
  type SetupStorage,
} from './setup-envelope';

function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  } satisfies SetupStorage & { map: Map<string, string> };
}
const scope: SetupScope = {
  accountId: 'user_a',
  organizationId: 'org_a',
  campaignId: 'campaign_a',
};
const character = (characterId: string, level: number) => ({
  characterId,
  level,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  isActive: true,
});

// Unfinished values as the form holds them: malformed and empty numbers,
// an unnamed team and a queued effect with a malformed week.
function unfinished(): MilitiaSetup {
  const values = newMilitiaSetup('Security');
  values.mode = 'existing';
  values.phase = 'event';
  const raw = values as unknown as {
    state: {
      week: unknown;
      militiaSnapshot: { rank: unknown; treasuryCopper: unknown };
      context: { queuedEffects: unknown[] };
    };
  };
  raw.state.militiaSnapshot.rank = 'four';
  raw.state.militiaSnapshot.treasuryCopper = null;
  raw.state.week = '';
  values.state.militiaSnapshot.roster.teams.push({
    teamId: 'scouts',
    name: '',
    teamType: 'defenders',
    status: 'active',
    rewardCapExempt: false,
    managerCharacterId: null,
    notes: '',
  });
  raw.state.context.queuedEffects.push({
    effectId: 'effect',
    sourceId: '',
    startsWeek: '9x',
    endsWeek: 9,
    effect: { kind: 'event_chance', value: 'minus five' },
  });
  return values;
}
const envelope = (values: MilitiaSetup = unfinished()): SetupEnvelope => ({
  version: SETUP_ENVELOPE_VERSION,
  scope,
  values,
  step: 'teams',
  visited: ['startingPoint', 'week', 'teams'],
  initializationId: 'attempt-1',
  submitted: null,
});

test('[setup.resume.round-trip] unfinished values, step, mode and attempt identity survive a reload', () => {
  const storage = memoryStorage();
  expect(writeSetupEnvelope(storage, envelope())).toBe(true);
  const restored = readSetupEnvelope(storage, scope);
  expect(restored).toEqual({ kind: 'restored', envelope: envelope() });
  if (restored.kind !== 'restored') throw new Error('not restored');
  expect(restored.envelope.values.mode).toBe('existing');
  expect(restored.envelope.values.state.militiaSnapshot.rank).toBe('four');
  expect(restored.envelope.values.state.militiaSnapshot.treasuryCopper).toBe(
    null,
  );
});

test('[setup.resume.submitted] a start sent before a reload keeps its source; an unreadable one is forgotten', () => {
  const storage = memoryStorage();
  const submitted = newMilitiaSetup('Loyalty');
  writeSetupEnvelope(storage, { ...envelope(), submitted });
  expect(readSetupEnvelope(storage, scope)).toEqual({
    kind: 'restored',
    envelope: { ...envelope(), submitted },
  });
  writeSetupEnvelope(storage, {
    ...envelope(),
    submitted: unfinished(),
  });
  expect(readSetupEnvelope(storage, scope)).toEqual({
    kind: 'restored',
    envelope: envelope(),
  });
});

test('[setup.resume.scope] another account, organization or campaign never sees the unfinished setup', () => {
  const storage = memoryStorage();
  writeSetupEnvelope(storage, envelope());
  for (const other of [
    { ...scope, accountId: 'user_b' },
    { ...scope, organizationId: 'org_b' },
    { ...scope, campaignId: 'campaign_b' },
  ])
    expect(readSetupEnvelope(storage, other)).toEqual({ kind: 'fresh' });
  // An envelope copied under another scope's key is refused, not restored.
  const other = { ...scope, campaignId: 'campaign_b' };
  storage.setItem(
    setupEnvelopeKey(other),
    storage.getItem(setupEnvelopeKey(scope))!,
  );
  expect(readSetupEnvelope(storage, other)).toEqual({ kind: 'discarded' });
  expect(readSetupEnvelope(storage, scope).kind).toBe('restored');
});

test('[setup.resume.corrupt] corrupt, unknown-version and structurally damaged envelopes are discarded', () => {
  const damaged = (change: (values: Record<string, unknown>) => void) => {
    const values = structuredClone(unfinished()) as unknown as Record<
      string,
      unknown
    >;
    change(values);
    return JSON.stringify({ ...envelope(), values });
  };
  const state = (values: Record<string, unknown>) =>
    values.state as Record<string, Record<string, unknown>>;
  for (const stored of [
    '{not json',
    'null',
    JSON.stringify({ ...envelope(), version: 99 }),
    JSON.stringify({ ...envelope(), step: 'elsewhere' }),
    JSON.stringify({ ...envelope(), visited: 'teams' }),
    JSON.stringify({ ...envelope(), initializationId: '' }),
    JSON.stringify({ ...envelope(), scope: undefined }),
    // A list replaced, a missing group, an impossible choice, an object where
    // a number belongs and an unknown key cannot be repaired in the form.
    damaged((values) => (state(values).militiaSnapshot!.roster = null)),
    damaged((values) => delete state(values).context),
    damaged((values) => (values.phase = 'lunch')),
    damaged((values) => (state(values).militiaSnapshot!.rank = { value: 1 })),
    damaged((values) => (values.extra = true)),
    damaged(
      (values) =>
        ((
          state(values).context!.queuedEffects as {
            effect: { kind: string };
          }[]
        )[0]!.effect.kind = 'bogus'),
    ),
  ]) {
    const storage = memoryStorage({ [setupEnvelopeKey(scope)]: stored });
    expect(readSetupEnvelope(storage, scope), stored).toEqual({
      kind: 'discarded',
    });
    retireSetupEnvelope(storage, scope);
    expect(storage.map.size).toBe(0);
  }
});

test('[setup.resume.unavailable] storage that refuses access is reported without failing', () => {
  const refusing: SetupStorage = {
    getItem: () => {
      throw new DOMException('denied', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError');
    },
    removeItem: () => {
      throw new DOMException('denied', 'SecurityError');
    },
  };
  expect(readSetupEnvelope(refusing, scope)).toEqual({ kind: 'unavailable' });
  expect(readSetupEnvelope(null, scope)).toEqual({ kind: 'unavailable' });
  expect(writeSetupEnvelope(refusing, envelope())).toBe(false);
  expect(writeSetupEnvelope(null, envelope())).toBe(false);
  expect(() => retireSetupEnvelope(refusing, scope)).not.toThrow();
});

test('[setup.resume.retire] a retired envelope is gone and later visits start fresh', () => {
  const storage = memoryStorage();
  writeSetupEnvelope(storage, envelope());
  writeSetupEnvelope(storage, {
    ...envelope(),
    scope: { ...scope, campaignId: 'campaign_b' },
  });
  retireSetupEnvelope(storage, scope);
  expect(readSetupEnvelope(storage, scope)).toEqual({ kind: 'fresh' });
  expect(
    readSetupEnvelope(storage, { ...scope, campaignId: 'campaign_b' }).kind,
  ).toBe('restored');
});

test('[setup.resume.characters] restored roster characters take the ledger’s current facts and keep everything else', () => {
  const values = unfinished();
  values.state.militiaSnapshot.roster.people.push(
    { characterId: 'hero', kind: 'pc', hitDice: 5 },
    { characterId: 'gone', kind: 'other_npc', hitDice: null },
  );
  values.state.militiaSnapshot.characters.push(
    character('hero', 3),
    character('gone', 2),
  );
  const refreshed = withCurrentCharacterFacts(values, [
    { ...character('hero', 6), name: 'Hero', charisma: 14 },
    { ...character('new', 1), name: 'New' },
  ]);
  expect(refreshed.state.militiaSnapshot.characters).toEqual([
    { ...character('hero', 6), charisma: 14 },
    character('gone', 2),
  ]);
  expect(refreshed.state.militiaSnapshot.roster).toEqual(
    values.state.militiaSnapshot.roster,
  );
  expect(refreshed.state.militiaSnapshot.rank).toBe('four');
});
