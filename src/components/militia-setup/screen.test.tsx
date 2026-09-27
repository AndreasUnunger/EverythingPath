import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { newMilitiaSetup, type MilitiaSetup } from '~/lib/canonical-setup';
import { MISSING_CHARACTER_MESSAGE } from '~/lib/setup-characters';
import {
  readSetupEnvelope,
  setupEnvelopeKey,
  type SetupScope,
} from '~/lib/setup-envelope';
import type { SetupCharacter } from './roster';
import { MilitiaSetupScreen } from './screen';

type Options = {
  name: string;
  started: boolean;
  characters: SetupCharacter[];
} | null;
const backend = vi.hoisted(() => ({
  options: undefined as unknown,
  // The authorized character read; by default the options' characters with
  // their records' kinds.
  records: undefined as unknown,
  workspace: undefined as unknown,
  initialize: (() => undefined) as (args: unknown) => unknown,
  createCharacter: (() => undefined) as (args: unknown) => unknown,
  router: { push: (href: string) => href, replace: (href: string) => href },
}));
vi.mock('@convex/_generated/api', () => ({
  api: {
    canonicalSetup: { options: 'options', initialize: 'initialize' },
    canonicalDraftPersistence: { workspace: 'workspace' },
    character: {
      createCharacter: 'createCharacter',
      listByCampaign: 'records',
    },
  },
}));
vi.mock('convex/react', () => ({
  useQuery: (ref: string, args: unknown) =>
    args === 'skip'
      ? undefined
      : ref === 'options'
        ? backend.options
        : ref === 'records'
          ? backend.records === 'loading'
            ? undefined
            : (backend.records ?? recordsOf(backend.options))
          : backend.workspace,
  useMutation: (ref: string) =>
    ref === 'initialize'
      ? (args: unknown) => backend.initialize(args)
      : (args: unknown) => backend.createCharacter(args),
}));
vi.mock('next/navigation', () => ({ useRouter: () => backend.router }));
function recordsOf(options: unknown) {
  return (options as Options | undefined)?.characters.map((character) => ({
    _id: character.characterId,
    kind: character.kind,
  }));
}

const campaignId = 'campaign_a' as Id<'campaign'>;
const scope: SetupScope = {
  accountId: 'user_a',
  organizationId: 'org_a',
  campaignId,
};
const mira: SetupCharacter = {
  characterId: 'mira',
  name: 'Mira',
  kind: 'pc',
  level: 3,
  strength: 10,
  dexterity: 12,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 16,
  isActive: true,
};
const push = vi.fn();
const replace = vi.fn();
const initialize = vi.fn();
const createCharacter = vi.fn();
function setOptions(options: Options | undefined) {
  backend.options = options;
}
beforeEach(() => {
  window.localStorage.clear();
  setOptions({ name: 'Ironfang', started: false, characters: [] });
  backend.records = undefined;
  backend.workspace = undefined;
  backend.initialize = initialize;
  backend.createCharacter = createCharacter;
  backend.router = { push, replace };
});
const originalMatchMedia = window.matchMedia;
afterEach(() => {
  cleanup();
  window.matchMedia = originalMatchMedia;
});
// Tablet width until the returned function narrows or widens the window.
function mockWidth() {
  const listeners = new Set<() => void>();
  let matches = true;
  window.matchMedia = vi.fn(() => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return (wide: boolean) => {
    matches = wide;
    act(() => listeners.forEach((listener) => listener()));
  };
}

const screenFor = (
  props: Partial<Parameters<typeof MilitiaSetupScreen>[0]> = {},
) => (
  <MilitiaSetupScreen
    accountId={scope.accountId}
    organizationId={scope.organizationId}
    campaignId={campaignId}
    {...props}
  />
);
const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));
const textbox = (name: string) => screen.getByRole('textbox', { name });
const fill = (name: string, value: string) =>
  fireEvent.change(textbox(name), { target: { value } });
const openStep = (name: string) =>
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Setup steps' })).getByRole(
      'button',
      { name },
    ),
  );
const chooseEvent = () => {
  openStep('Week');
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Open phase' })).getByRole(
      'button',
      { name: 'event' },
    ),
  );
};
const start = () => {
  openStep('Review & start');
  click('Start militia week');
};
const stored = () => readSetupEnvelope(window.localStorage, scope);
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const key = { campaignId, militiaId: 'militia', draftId: 'draft' };

test('[setup.state.loading] Setup shows its layout skeleton with a loading status until options resolve', () => {
  setOptions(undefined);
  const { rerender } = render(screenFor());
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading militia setup…',
  );
  expect(screen.queryByRole('navigation', { name: 'Setup steps' })).toBeNull();
  // The account is still loading: the same skeleton, and no data is read.
  rerender(screenFor({ accountId: null }));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading militia setup…',
  );
});

test('[setup.started.initial] a first visit to a started militia shows the two-link page and retires a stale envelope', async () => {
  // An unfinished setup left in this browser before another player started.
  const { unmount } = render(screenFor());
  fill('Rank', '7');
  expect(stored().kind).toBe('restored');
  unmount();
  setOptions({ name: 'Ironfang', started: true, characters: [] });
  backend.workspace = { week: 8 };
  const { rerender } = render(screenFor());
  expect(screen.getByRole('status')).toHaveTextContent(
    'This militia is already set up.',
  );
  expect(screen.getByRole('link', { name: 'Open week 8' })).toHaveAttribute(
    'href',
    '/campaigns/campaign_a/week',
  );
  expect(screen.getByRole('link', { name: 'Open militia' })).toHaveAttribute(
    'href',
    '/campaigns/campaign_a/militia',
  );
  expect(screen.queryByRole('textbox', { name: 'Rank' })).toBeNull();
  await waitFor(() => expect(stored()).toEqual({ kind: 'fresh' }));
  rerender(screenFor());
  expect(push).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

test('[setup.resume.reload] unfinished and invalid input, mode and open step survive leaving and returning, without submitting', async () => {
  const { unmount } = render(screenFor());
  click('Existing militia');
  fill('Rank', 'four');
  fill('Treasury (copper)', '');
  openStep('Teams');
  click('Add team');
  fill('Team name', 'Scouts');
  unmount();
  render(screenFor());
  expect(
    screen.getByRole('heading', { level: 2, name: 'Teams' }),
  ).toBeVisible();
  expect(textbox('Team name')).toHaveValue('Scouts');
  openStep('Starting point');
  expect(
    screen.getByRole('button', { name: 'Existing militia' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(textbox('Rank')).toHaveValue('four');
  expect(textbox('Treasury (copper)')).toHaveValue('');
  expect(
    await screen.findByText('Enter a valid whole number for Rank.'),
  ).toBeVisible();
  expect(initialize).not.toHaveBeenCalled();
});

test('[setup.resume.scope] another account, organization or campaign starts from its own defaults', () => {
  const { unmount } = render(screenFor());
  fill('Rank', '6');
  unmount();
  for (const other of [
    { accountId: 'user_b' },
    { organizationId: 'org_b' },
    { campaignId: 'campaign_b' as Id<'campaign'> },
  ]) {
    const { unmount: leave } = render(screenFor(other));
    expect(textbox('Rank')).toHaveValue('1');
    leave();
  }
  render(screenFor());
  expect(textbox('Rank')).toHaveValue('6');
});

test('[setup.resume.corrupt] a damaged envelope is replaced by defaults with a short notice', async () => {
  window.localStorage.setItem(setupEnvelopeKey(scope), '{"version":1,');
  render(screenFor());
  expect(
    screen.getByText('Your earlier entries could not be restored.'),
  ).toBeVisible();
  expect(textbox('Treasury (copper)')).toHaveValue('1000');
  await waitFor(() => expect(stored()).toEqual({ kind: 'fresh' }));
  fill('Rank', '2');
  expect(stored().kind).toBe('restored');
});

test('[setup.resume.unavailable] a browser without storage still enters and starts setup', async () => {
  initialize.mockResolvedValue(key);
  render(screenFor({ storage: null }));
  expect(
    screen.getByText(
      "Your entries won't be kept if you reload or leave this page.",
    ),
  ).toBeVisible();
  fill('Rank', '2');
  start();
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith(
      '/campaigns/campaign_a/week?phase=upkeep',
    ),
  );
});

test('[setup.race.external] another player finishing opens the accepted week and retires this form', async () => {
  const { rerender } = render(screenFor());
  fill('Rank', '3');
  expect(stored().kind).toBe('restored');
  setOptions({ name: 'Ironfang', started: true, characters: [] });
  rerender(screenFor());
  expect(screen.getByRole('status')).toHaveTextContent(
    'Another player started the militia. Opening the week…',
  );
  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith('/campaigns/campaign_a/week'),
  );
  expect(stored()).toEqual({ kind: 'fresh' });
  expect(initialize).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test('[setup.race.own-first-observation] own start opens the requested phase once even when the started observation arrives first', async () => {
  const result = deferred<typeof key>();
  initialize.mockReturnValue(result.promise);
  const { rerender } = render(screenFor());
  chooseEvent();
  start();
  const pending = await screen.findByRole('button', {
    name: 'Starting militia…',
  });
  fireEvent.click(pending);
  // This player's own write is observed before its result.
  setOptions({ name: 'Ironfang', started: true, characters: [] });
  rerender(screenFor());
  expect(replace).not.toHaveBeenCalled();
  await act(async () => result.resolve(key));
  expect(push).toHaveBeenCalledExactlyOnceWith(
    '/campaigns/campaign_a/week?phase=event',
  );
  expect(initialize).toHaveBeenCalledOnce();
  expect(stored()).toEqual({ kind: 'fresh' });
  // The page keeps Start disabled while the week opens.
  expect(
    screen.getByRole('button', { name: 'Starting militia…' }),
  ).toBeDisabled();
  rerender(screenFor());
  expect(replace).not.toHaveBeenCalled();
});

test('[setup.race.own-first-result] own start opens the requested phase once when its result arrives first', async () => {
  initialize.mockResolvedValue(key);
  const { rerender } = render(screenFor());
  chooseEvent();
  start();
  await waitFor(() => expect(push).toHaveBeenCalledOnce());
  setOptions({ name: 'Ironfang', started: true, characters: [] });
  rerender(screenFor());
  expect(push).toHaveBeenCalledExactlyOnceWith(
    '/campaigns/campaign_a/week?phase=event',
  );
  expect(replace).not.toHaveBeenCalled();
});

test('[setup.race.lost] a start rejected because another player won follows the accepted week', async () => {
  const result = deferred<typeof key>();
  initialize.mockReturnValue(result.promise);
  const { rerender } = render(screenFor());
  chooseEvent();
  start();
  await screen.findByRole('button', { name: 'Starting militia…' });
  setOptions({ name: 'Ironfang', started: true, characters: [] });
  rerender(screenFor());
  await act(async () =>
    result.reject(
      new ConvexError(
        'Militia setup is already complete. Open the current week.',
      ),
    ),
  );
  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith('/campaigns/campaign_a/week'),
  );
  expect(push).not.toHaveBeenCalled();
  expect(stored()).toEqual({ kind: 'fresh' });
});

test('[setup.start.identity] a failed start keeps entries and every retry, even after a reload, reuses one attempt identity', async () => {
  initialize
    .mockRejectedValueOnce(
      new ConvexError('Campaign editing is paused for maintenance.'),
    )
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(key);
  const { unmount } = render(screenFor());
  fill('Rank', '2');
  start();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Campaign editing is paused for maintenance.',
  );
  expect(push).not.toHaveBeenCalled();
  click('Start militia week');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your entries are retained.',
  );
  unmount();
  render(screenFor());
  expect(
    screen.getByRole('heading', { level: 2, name: 'Review & start' }),
  ).toBeVisible();
  click('Start militia week');
  await waitFor(() => expect(push).toHaveBeenCalledOnce());
  const calls = initialize.mock.calls.map(
    ([args]) =>
      args as {
        campaignId: string;
        initializationId: string;
        setup: MilitiaSetup;
      },
  );
  expect(calls).toHaveLength(3);
  expect(new Set(calls.map((call) => call.initializationId)).size).toBe(1);
  for (const call of calls) {
    expect(call.campaignId).toBe(campaignId);
    expect(call.setup.state.militiaSnapshot.rank).toBe(2);
  }
});

test('[setup.start.scope-change] leaving during a start never navigates the next page', async () => {
  const result = deferred<typeof key>();
  initialize.mockReturnValue(result.promise);
  const { rerender } = render(screenFor());
  start();
  await screen.findByRole('button', { name: 'Starting militia…' });
  // The player switches campaign while the start is in flight.
  rerender(screenFor({ campaignId: 'campaign_b' as Id<'campaign'> }));
  await act(async () => result.resolve(key));
  expect(push).not.toHaveBeenCalled();
  expect(textbox('Rank')).toHaveValue('1');
  // The started campaign's envelope is retired; campaign B keeps its own.
  expect(stored()).toEqual({ kind: 'fresh' });
});

test('[setup.characters.inline] Add character keeps its values on failure and the new record arrives without touching setup entries', async () => {
  createCharacter
    .mockRejectedValueOnce(new Error('Character name is taken'))
    .mockResolvedValueOnce('mira');
  const { rerender } = render(screenFor());
  fill('Rank', '4');
  openStep('People & officers');
  click('Add character');
  const dialog = await screen.findByRole('dialog', { name: 'New Character' });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Mira' },
  });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'CHA' }), {
    target: { value: '16' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(
    await within(dialog).findByText('Character name is taken'),
  ).toBeVisible();
  expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue(
    'Mira',
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(createCharacter).toHaveBeenLastCalledWith({
    organizationId: 'org_a',
    character: expect.objectContaining({
      campaignId,
      name: 'Mira',
      charisma: 16,
      kind: 'pc',
    }),
  });
  // The record arrives through options; it is offered, not added.
  setOptions({ name: 'Ironfang', started: false, characters: [mira] });
  rerender(screenFor());
  expect(screen.getByRole('button', { name: 'Add Mira' })).toBeVisible();
  expect(screen.queryByRole('group', { name: 'Mira' })).toBeNull();
  openStep('Starting point');
  expect(textbox('Rank')).toHaveValue('4');
  expect(initialize).not.toHaveBeenCalled();
});

test('[setup.characters.dialog-survives] the Add character dialog keeps its values across a breakpoint change and when reopened', async () => {
  const resize = mockWidth();
  render(screenFor());
  openStep('People & officers');
  click('Add character');
  const name = () =>
    within(screen.getByRole('dialog', { name: 'New Character' })).getByRole(
      'textbox',
      { name: 'Name' },
    );
  fireEvent.change(name(), { target: { value: 'Mira' } });
  resize(false);
  expect(name()).toHaveValue('Mira');
  resize(true);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  openStep('Teams');
  openStep('People & officers');
  click('Add character');
  expect(name()).toHaveValue('Mira');
  expect(createCharacter).not.toHaveBeenCalled();
});

// A start whose result never arrived because the page reloaded.
async function reloadDuringStart() {
  initialize.mockReturnValueOnce(new Promise(() => undefined));
  const { unmount } = render(screenFor());
  chooseEvent();
  start();
  await screen.findByRole('button', { name: 'Starting militia…' });
  unmount();
  const [[sent]] = initialize.mock.calls as [[{ initializationId: string }]];
  return sent;
}

test('[setup.race.unacknowledged-own] a start sent before a reload that turns out accepted opens its requested phase', async () => {
  const sent = await reloadDuringStart();
  initialize.mockResolvedValueOnce(key);
  const { rerender } = render(screenFor());
  expect(
    screen.getByRole('heading', { level: 2, name: 'Review & start' }),
  ).toBeVisible();
  // The earlier start lands after the reload.
  setOptions({ name: 'Ironfang', started: true, characters: [] });
  rerender(screenFor());
  await waitFor(() =>
    expect(push).toHaveBeenCalledExactlyOnceWith(
      '/campaigns/campaign_a/week?phase=event',
    ),
  );
  expect(initialize).toHaveBeenLastCalledWith(sent);
  expect(replace).not.toHaveBeenCalled();
  expect(stored()).toEqual({ kind: 'fresh' });
});

test('[setup.race.unacknowledged-other] when another player won instead, the resent start is refused and the page follows their week', async () => {
  const sent = await reloadDuringStart();
  initialize.mockRejectedValueOnce(
    new ConvexError(
      'Militia setup is already complete. Open the current week.',
    ),
  );
  const { rerender } = render(screenFor());
  setOptions({ name: 'Ironfang', started: true, characters: [] });
  rerender(screenFor());
  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith('/campaigns/campaign_a/week'),
  );
  expect(initialize).toHaveBeenLastCalledWith(sent);
  expect(push).not.toHaveBeenCalled();
  expect(stored()).toEqual({ kind: 'fresh' });
});

test('[setup.start.changed-source] a changed retry after an unacknowledged start keeps the identity, and its refusal follows the accepted week', async () => {
  const sent = await reloadDuringStart();
  const refused = deferred<typeof key>();
  initialize.mockReturnValueOnce(refused.promise);
  const { rerender } = render(screenFor());
  openStep('Starting point');
  fill('Rank', '3');
  start();
  await screen.findByRole('button', { name: 'Starting militia…' });
  const [, [retry]] = initialize.mock.calls as [
    unknown,
    [{ initializationId: string; setup: MilitiaSetup }],
  ];
  expect(retry.initializationId).toBe(sent.initializationId);
  expect(retry.setup.state.militiaSnapshot.rank).toBe(3);
  // The server keeps the first source for that identity.
  setOptions({ name: 'Ironfang', started: true, characters: [] });
  rerender(screenFor());
  await act(async () =>
    refused.reject(
      new ConvexError(
        'Militia setup is already complete. Open the current week.',
      ),
    ),
  );
  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith('/campaigns/campaign_a/week'),
  );
  expect(initialize).toHaveBeenCalledTimes(2);
  expect(push).not.toHaveBeenCalled();
});

// An unfinished setup #173 stored before PC/NPC kinds: legacy roster kinds,
// one disagreeing with its record, a malformed rank, zero and explicit Hit
// Dice overrides, and a person whose character is not in this campaign.
const ostler: SetupCharacter = {
  ...mira,
  characterId: 'ostler',
  name: 'Ostler',
  kind: 'npc',
};
const facts = ({ name: _name, kind: _kind, ...rest }: SetupCharacter) => rest;
function storeVersionOne(submitted: MilitiaSetup | null = null) {
  const values = newMilitiaSetup('Loyalty');
  (values.state.militiaSnapshot as { rank: unknown }).rank = 'four';
  values.state.militiaSnapshot.characters.push(facts(mira), facts(ostler), {
    ...facts(mira),
    characterId: 'gone',
  });
  values.state.militiaSnapshot.roster.people.push(
    { characterId: 'mira', kind: 'other_npc', hitDice: 0 },
    { characterId: 'ostler', kind: 'officer_npc', hitDice: 5 },
    { characterId: 'gone', kind: 'other_npc', hitDice: null },
  );
  values.state.militiaSnapshot.roster.officers.push({
    role: 'commandant',
    characterId: 'ostler',
  });
  window.localStorage.setItem(
    setupEnvelopeKey(scope),
    JSON.stringify({
      version: 1,
      scope,
      values,
      step: 'people',
      visited: ['startingPoint', 'people'],
      initializationId: 'attempt-v1',
      submitted,
    }),
  );
}
const kinds = () =>
  screen
    .getAllByRole('group', { name: 'Kind' })
    .map((group) => group.textContent?.replace(/^Kind/, ''));

test('[setup.resume.migrate] a version 1 envelope resumes with its records’ PC or NPC kinds, raw input and open step, without submitting', async () => {
  setOptions({ name: 'Ironfang', started: false, characters: [mira, ostler] });
  // Ostler's record still stores the legacy kind; Mira's record is a PC.
  backend.records = [
    { _id: 'mira', kind: 'pc' },
    { _id: 'ostler', kind: 'officer_npc' },
  ];
  storeVersionOne();
  render(screenFor());
  expect(
    screen.getByRole('heading', { level: 2, name: 'People & officers' }),
  ).toBeVisible();
  expect(kinds()).toEqual(['PC', 'NPC', MISSING_CHARACTER_MESSAGE]);
  expect(
    within(screen.getByRole('group', { name: 'Person 3' })).getByRole('alert'),
  ).toHaveTextContent(MISSING_CHARACTER_MESSAGE);
  expect(
    screen
      .getAllByRole('textbox', { name: 'Hit Dice' })
      .map((input) => (input as HTMLInputElement).value),
  ).toEqual(['0', '5', '']);
  expect(
    within(screen.getByRole('group', { name: 'Ostler' })).getByRole('button', {
      name: 'commandant',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  openStep('Starting point');
  expect(textbox('Rank')).toHaveValue('four');
  expect(initialize).not.toHaveBeenCalled();

  // The next change stores version 2 under the same attempt identity.
  fill('Rank', '1');
  const restored = stored();
  if (restored.kind !== 'restored') throw new Error('not restored');
  expect(
    JSON.parse(window.localStorage.getItem(setupEnvelopeKey(scope))!).version,
  ).toBe(2);
  expect(restored.envelope.initializationId).toBe('attempt-v1');
  expect(
    restored.envelope.values.state.militiaSnapshot.roster.people.map(
      (person) => person.kind,
    ),
  ).toEqual(['pc', 'npc', 'npc']);

  // The missing record blocks a start until the player removes that person.
  start();
  expect(
    await screen.findByText('1 thing to fix before starting'),
  ).toBeVisible();
  expect(initialize).not.toHaveBeenCalled();
  // The linked error opens that person's row.
  click(MISSING_CHARACTER_MESSAGE);
  await waitFor(() =>
    expect(screen.getByRole('group', { name: 'Person 3' })).toContainElement(
      document.activeElement as HTMLElement,
    ),
  );
  click('Remove Person 3');
  initialize.mockResolvedValueOnce(key);
  start();
  await waitFor(() => expect(initialize).toHaveBeenCalledOnce());
  const [[sent]] = initialize.mock.calls as [
    [{ initializationId: string; setup: MilitiaSetup }],
  ];
  expect(sent.initializationId).toBe('attempt-v1');
  expect(sent.setup.state.militiaSnapshot.roster.people).toEqual([
    { characterId: 'mira', kind: 'pc', hitDice: 0 },
    { characterId: 'ostler', kind: 'npc', hitDice: 5 },
  ]);
});

test('[setup.resume.migrate-wait] a resumed setup waits for the character records before restoring', () => {
  setOptions({ name: 'Ironfang', started: false, characters: [mira, ostler] });
  const records = [
    { _id: 'mira', kind: 'pc' },
    { _id: 'ostler', kind: 'officer_npc' },
  ];
  storeVersionOne();
  backend.records = 'loading';
  const { rerender } = render(screenFor());
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading militia setup…',
  );
  expect(screen.queryByRole('group', { name: 'Kind' })).toBeNull();
  backend.records = records;
  rerender(screenFor());
  expect(kinds()).toEqual(['PC', 'NPC', MISSING_CHARACTER_MESSAGE]);
});

test('[setup.kind.record] a person joins with their record’s kind, follows a record change and a start sends only PC or NPC', async () => {
  setOptions({ name: 'Ironfang', started: false, characters: [mira, ostler] });
  backend.records = [
    { _id: 'mira', kind: undefined },
    { _id: 'ostler', kind: 'officer_npc' },
  ];
  const { rerender } = render(screenFor());
  openStep('People & officers');
  click('Add Mira');
  click('Add Ostler');
  expect(kinds()).toEqual(['PC', 'NPC']);
  // No kind can be chosen here: only the character record sets it.
  expect(screen.queryByRole('group', { name: 'Character kind' })).toBeNull();
  // Another player makes Mira an NPC while this form is open.
  backend.records = [
    { _id: 'mira', kind: 'npc' },
    { _id: 'ostler', kind: 'officer_npc' },
  ];
  rerender(screenFor());
  expect(kinds()).toEqual(['NPC', 'NPC']);
  initialize.mockResolvedValueOnce(key);
  start();
  await waitFor(() => expect(initialize).toHaveBeenCalledOnce());
  const [[sent]] = initialize.mock.calls as [[{ setup: MilitiaSetup }]];
  expect(
    sent.setup.state.militiaSnapshot.roster.people.map((p) => p.kind),
  ).toEqual(['npc', 'npc']);
});

test('[setup.resume.migrate-unacknowledged] a version 1 start sent before the upgrade is resent verbatim and opens the militia it started', async () => {
  const submitted = newMilitiaSetup('Loyalty');
  submitted.phase = 'event';
  submitted.state.militiaSnapshot.characters.push(facts(ostler));
  submitted.state.militiaSnapshot.roster.people.push({
    characterId: 'ostler',
    kind: 'officer_npc',
    hitDice: 5,
  });
  setOptions({ name: 'Ironfang', started: false, characters: [mira, ostler] });
  storeVersionOne(submitted);
  initialize.mockResolvedValueOnce(key);
  const { rerender } = render(screenFor());
  expect(initialize).not.toHaveBeenCalled();
  // It had been accepted: the same identity and source find out.
  setOptions({ name: 'Ironfang', started: true, characters: [mira, ostler] });
  rerender(screenFor());
  await waitFor(() =>
    expect(push).toHaveBeenCalledExactlyOnceWith(
      '/campaigns/campaign_a/week?phase=event',
    ),
  );
  expect(initialize).toHaveBeenCalledExactlyOnceWith({
    campaignId,
    initializationId: 'attempt-v1',
    setup: submitted,
  });
});
