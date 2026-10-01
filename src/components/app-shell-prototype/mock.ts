// PROTOTYPE — in-memory mock data for the app-shell prototype. No persistence;
// a reload resets everything. Signed-in user is Andreas (u1).
import { useSyncExternalStore } from 'react';

export const ME = 'u1';

export type Org = { id: string; name: string };
export type Campaign = {
  id: string;
  name: string;
  orgId: string;
  description: string;
  /** null = the campaign has no militia. */
  militia: { week: number; finishedWeeks: number } | null;
};
export type Status = 'militia-only' | 'full';
export type Character = {
  id: string;
  name: string;
  /** Class line of a Full Character ("Wizard"); undefined for Militia-only. */
  className?: string;
  level: number;
  ownerId: string;
  campaignId?: string;
  status: Status;
  onRoster: boolean;
  officer?: string;
  /** A barely-started sheet (base scores and level only). */
  minimal?: boolean;
};

const users: Record<string, string> = {
  u1: 'Andreas',
  u2: 'Mira',
  u3: 'Jonas',
};

export const orgs: Org[] = [
  { id: 'o1', name: 'Thursday Table' },
  { id: 'o2', name: 'Lodge of Ash' },
];

export const campaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'Kingmaker',
    orgId: 'o1',
    description: 'Carving a barony out of the Stolen Lands.',
    militia: { week: 12, finishedWeeks: 11 },
  },
  {
    id: 'c2',
    name: 'Rise of the Runelords',
    orgId: 'o1',
    description: 'Sandpoint, goblins, and something older under the hills.',
    militia: null,
  },
  {
    id: 'c3',
    name: 'Skull & Shackles',
    orgId: 'o2',
    description: 'Press-ganged aboard the Wormwood.',
    militia: { week: 4, finishedWeeks: 3 },
  },
];

const initialCharacters: Character[] = [
  // No campaign
  {
    id: 'ch1',
    name: 'Ilsa Varn',
    className: 'Wizard',
    level: 3,
    ownerId: 'u1',
    status: 'full',
    onRoster: false,
  },
  {
    id: 'ch2',
    name: 'Brother Tobin',
    className: 'Cleric',
    level: 1,
    ownerId: 'u1',
    status: 'full',
    onRoster: false,
    minimal: true,
  },
  // Kingmaker
  {
    id: 'ch3',
    name: 'Valeros',
    className: 'Fighter',
    level: 6,
    ownerId: 'u1',
    campaignId: 'c1',
    status: 'full',
    onRoster: true,
    officer: 'Marshal',
  },
  {
    id: 'ch4',
    name: 'Seelah',
    className: 'Paladin',
    level: 6,
    ownerId: 'u2',
    campaignId: 'c1',
    status: 'full',
    onRoster: true,
  },
  {
    id: 'ch5',
    name: 'Kesten Garess',
    level: 5,
    ownerId: 'u1',
    campaignId: 'c1',
    status: 'militia-only',
    onRoster: true,
    officer: 'General',
  },
  {
    id: 'ch6',
    name: 'Amiri',
    level: 4,
    ownerId: 'u2',
    campaignId: 'c1',
    status: 'militia-only',
    onRoster: true,
  },
  {
    id: 'ch7',
    name: 'Linzi',
    level: 3,
    ownerId: 'u3',
    campaignId: 'c1',
    status: 'militia-only',
    onRoster: true,
  },
  {
    id: 'ch8',
    name: 'Tartuk',
    level: 2,
    ownerId: 'u3',
    campaignId: 'c1',
    status: 'militia-only',
    onRoster: false,
  },
  {
    id: 'ch9',
    name: 'Oleg Leveton',
    level: 2,
    ownerId: 'u3',
    campaignId: 'c1',
    status: 'militia-only',
    onRoster: true,
    officer: 'Quartermaster',
  },
  {
    id: 'ch10',
    name: 'Svetlana Leveton',
    level: 1,
    ownerId: 'u2',
    campaignId: 'c1',
    status: 'militia-only',
    onRoster: true,
  },
  {
    id: 'ch11',
    name: 'Jhod Kavken',
    level: 3,
    ownerId: 'u1',
    campaignId: 'c1',
    status: 'militia-only',
    onRoster: true,
  },
  {
    id: 'ch12',
    name: 'Akiros Ismort',
    level: 4,
    ownerId: 'u3',
    campaignId: 'c1',
    status: 'militia-only',
    onRoster: true,
    officer: 'Captain',
  },
  // Rise of the Runelords (no militia)
  {
    id: 'ch13',
    name: 'Merisiel',
    className: 'Rogue',
    level: 4,
    ownerId: 'u1',
    campaignId: 'c2',
    status: 'full',
    onRoster: false,
  },
  {
    id: 'ch14',
    name: 'Ezren',
    className: 'Wizard',
    level: 4,
    ownerId: 'u2',
    campaignId: 'c2',
    status: 'full',
    onRoster: false,
  },
  // Skull & Shackles
  {
    id: 'ch15',
    name: 'Jirelle',
    className: 'Swashbuckler',
    level: 3,
    ownerId: 'u1',
    campaignId: 'c3',
    status: 'full',
    onRoster: true,
  },
];

// Tiny external store: the characters array is replaced on every change so
// useSyncExternalStore sees a new snapshot.
let characters: Character[] = initialCharacters;
let nextId = 100;
const listeners = new Set<() => void>();

function set(next: Character[]) {
  characters = next;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function snapshot() {
  return characters;
}

/** Subscribe to the mock store; call it in any component that reads characters. */
export function useMockStore() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

function patch(id: string, change: Partial<Character>) {
  set(characters.map((c) => (c.id === id ? { ...c, ...change } : c)));
}

// Actions

/** Add to campaign MOVES the Character; it arrives off the roster, without roles. */
export function addToCampaign(characterId: string, campaignId: string) {
  const campaign = getCampaign(campaignId);
  const character = getCharacter(characterId);
  if (!campaign || !character) return;
  patch(characterId, {
    campaignId,
    onRoster: false,
    officer: undefined,
    // Militia-only exists only in a campaign with a militia.
    status: campaign.militia ? character.status : 'full',
  });
}

/** Leaving takes it off the roster; in no campaign it is always Full. */
export function leaveCampaign(characterId: string) {
  patch(characterId, {
    campaignId: undefined,
    onRoster: false,
    officer: undefined,
    status: 'full',
  });
}

/** One-way: Militia-only → Full. */
export function buildOut(characterId: string) {
  const character = getCharacter(characterId);
  patch(characterId, {
    status: 'full',
    className: character?.className ?? 'Fighter',
  });
}

export function createCharacter(opts: {
  campaignId?: string;
  status?: Status;
}) {
  const id = `ch${nextId++}`;
  const status = opts.campaignId ? (opts.status ?? 'full') : 'full';
  set([
    ...characters,
    {
      id,
      name: `New character ${nextId - 100}`,
      className: status === 'full' ? 'Fighter' : undefined,
      level: 1,
      ownerId: ME,
      campaignId: opts.campaignId,
      status,
      onRoster: status === 'militia-only',
      minimal: true,
    },
  ]);
  return id;
}

// Queries (read the current snapshot; pair with useMockStore() to re-render)

export function getOrg(id: string) {
  return orgs.find((o) => o.id === id);
}
export function getCampaign(id: string | undefined) {
  return id ? campaigns.find((c) => c.id === id) : undefined;
}
export function getCharacter(id: string | undefined) {
  return id ? characters.find((c) => c.id === id) : undefined;
}
export function userName(id: string) {
  return users[id] ?? id;
}
export function campaignsInOrg(orgId: string) {
  return campaigns.filter((c) => c.orgId === orgId);
}
/** Every Character the signed-in user owns, across organizations. */
export function myCharacters() {
  return characters.filter((c) => c.ownerId === ME);
}
export function charactersInCampaign(campaignId: string) {
  return characters.filter((c) => c.campaignId === campaignId);
}
/** "Wizard 3" for a Full Character, "Level 5" for a Militia-only one. */
export function levelLine(character: Character) {
  return character.className
    ? `${character.className} ${character.level}`
    : `Level ${character.level}`;
}
