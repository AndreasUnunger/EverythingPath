import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
}));

const mockHasAccessToOrg = vi.fn();

vi.mock('../../convex/user', () => ({
  hasAccessToOrg: (...args: unknown[]) => mockHasAccessToOrg(...args),
}));

type Row = { _id: string; [key: string]: unknown };

class FakeDb {
  private tables: Record<string, Row[]>;
  private nextId = 1;

  constructor(initial: Record<string, Row[]>) {
    this.tables = Object.fromEntries(
      Object.entries(initial).map(([table, rows]) => [
        table,
        rows.map((row) => ({ ...row })),
      ]),
    );
  }

  async get(table: string, id: string) {
    return this.tables[table]?.find((row) => row._id === id) ?? null;
  }

  query(table: string) {
    const allRows = this.tables[table] ?? [];
    return {
      async collect() {
        return allRows.map((row: Row) => ({ ...row }));
      },
      withIndex: (
        _indexName: string,
        build: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
      ) => {
        const conditions: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq(field: string, value: unknown) {
            conditions.push({ field, value });
            return q;
          },
        };
        build(q);
        const rows = allRows.filter((row: Row) =>
          conditions.every((condition) => row[condition.field] === condition.value),
        );
        return {
          async collect() {
            return rows.map((row: Row) => ({ ...row }));
          },
          async first() {
            return rows[0] ? { ...rows[0] } : null;
          },
        };
      },
    };
  }

  async patch(table: string, id: string, patch: Record<string, unknown>) {
    const rows = this.tables[table] ?? [];
    const index = rows.findIndex((row) => row._id === id);
    if (index < 0) throw new Error(`Row not found: ${table}/${id}`);
    const current = rows[index];
    if (!current) throw new Error(`Row not found: ${table}/${id}`);
    rows[index] = { ...current, ...patch, _id: current._id };
  }

  async insert(table: string, doc: Record<string, unknown>) {
    const next: Row = { ...doc, _id: `${table}-${this.nextId++}` } as Row;
    this.tables[table] ??= [];
    this.tables[table].push(next);
    return next._id;
  }

  async delete(tableOrId: string, maybeId?: string) {
    if (maybeId) {
      const rows = this.tables[tableOrId] ?? [];
      const index = rows.findIndex((row) => row._id === maybeId);
      if (index >= 0) {
        rows.splice(index, 1);
        return;
      }
      throw new Error(`Row not found: ${tableOrId}/${maybeId}`);
    }

    for (const rows of Object.values(this.tables)) {
      const index = rows.findIndex((row) => row._id === tableOrId);
      if (index >= 0) {
        rows.splice(index, 1);
        return;
      }
    }
    throw new Error(`Row not found: ${tableOrId}`);
  }

  getRows(table: string) {
    return this.tables[table] ?? [];
  }
}

function createHarness({
  campaigns = [{ _id: 'c1', organizationId: 'org1' }],
  militiaRows = [
    {
      _id: 'm1',
      campaignId: 'c1',
      name: 'Watch',
      rank: 7,
      highestBoonReached: 3,
      HQLocation: 'Longshadow',
      treasury: 100,
      notoriety: 2,
      focus: 'Security',
      training: 40,
      strategist: 'char_strat',
    },
  ],
  weekStates = [],
  teamRows = [],
  teamStates = [],
  caches = [],
  orders = [],
  trackedPeople = [],
  eventStates = [],
  characters = [],
  marketplaces = [],
}: {
  campaigns?: Row[];
  militiaRows?: Row[];
  weekStates?: Row[];
  teamRows?: Row[];
  teamStates?: Row[];
  caches?: Row[];
  orders?: Row[];
  trackedPeople?: Row[];
  eventStates?: Row[];
  characters?: Row[];
  marketplaces?: Row[];
} = {}) {
  const db = new FakeDb({
    campaign: campaigns,
    militia: militiaRows,
    militiaWeekState: weekStates,
    militiaTeam: teamRows,
    militiaTeamState: teamStates,
    militiaCache: caches,
    militiaOrder: orders,
    militiaCharacterStatus: trackedPeople,
    militiaEventState: eventStates,
    character: characters,
    militiaMarketplace: marketplaces,
  });

  return {
    ctx: { db } as unknown as { db: FakeDb },
    db,
  };
}

let getMilitiaStateSetup: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let upsertWeekContextState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let upsertMilitiaTeamState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let upsertCacheState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let upsertOrderState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let upsertTrackedPersonState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let upsertEventState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };

beforeAll(async () => {
  const module = await import('../../convex/militia');
  getMilitiaStateSetup = module.getMilitiaStateSetup as never;
  upsertWeekContextState = module.upsertWeekContextState as never;
  upsertMilitiaTeamState = module.upsertMilitiaTeamState as never;
  upsertCacheState = module.upsertCacheState as never;
  upsertOrderState = module.upsertOrderState as never;
  upsertTrackedPersonState = module.upsertTrackedPersonState as never;
  upsertEventState = module.upsertEventState as never;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockHasAccessToOrg.mockResolvedValue({
    user: {
      tokenIdentifier: 'user_1',
    },
  });
});

describe('militia state harness', () => {
  it('returns default week context when no week state exists', async () => {
    const { ctx } = createHarness();

    const result = (await getMilitiaStateSetup.handler(ctx, {
      campaignId: 'c1',
      organizationId: 'org1',
    })) as {
      currentWeekState: { weekNumber: number; phase: string; queuedEffects: unknown[] };
      teamStates: unknown[];
    } | null;

    expect(result?.currentWeekState).toEqual({
      weekNumber: 1,
      phase: 'activity',
      isFirstWeek: true,
      skippedUpkeepThisWeek: true,
      uneventfulBonusCarry: 0,
      lastPersistentBuyoffWeek: 0,
      queuedEffects: [],
    });
    expect(result?.teamStates).toEqual([]);
  });

  it('creates week context with strategist-adjusted slot defaults', async () => {
    const { ctx, db } = createHarness();

    await upsertWeekContextState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      weekNumber: 8,
      phase: 'event',
      isFirstWeek: false,
      skippedUpkeepThisWeek: false,
      uneventfulBonusCarry: 3,
      lastPersistentBuyoffWeek: 6,
      queuedEffects: [
        {
          kind: 'auto_event_roll_once',
          appliesWeek: 9,
        },
      ],
    });

    const weekState = db.getRows('militiaWeekState')[0];
    expect(weekState).toEqual(
      expect.objectContaining({
        weekNumber: 8,
        phase: 'event',
        uneventfulBonusCarry: 3,
        queuedEffects: [{ kind: 'auto_event_roll_once', appliesWeek: 9 }],
      }),
    );
    expect((weekState?.stagedActivityActionIds as unknown[])?.length).toBe(4);
    expect((weekState?.stagedActivityTeamIds as unknown[])?.length).toBe(4);
  });

  it('upserts and removes a team roster state entry', async () => {
    const { ctx, db } = createHarness();

    await upsertMilitiaTeamState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      teamId: 'spies',
      inRoster: true,
      status: 'missing',
      unavailableUntilWeek: 10,
      notes: 'Captured on raid',
    });

    expect(db.getRows('militiaTeam')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ militiaId: 'm1', teamId: 'spies' }),
      ]),
    );
    expect(db.getRows('militiaTeamState')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          militiaId: 'm1',
          teamId: 'spies',
          status: 'missing',
          unavailableUntilWeek: 10,
          notes: 'Captured on raid',
        }),
      ]),
    );

    await upsertMilitiaTeamState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      teamId: 'spies',
      inRoster: false,
      status: 'active',
    });

    expect(db.getRows('militiaTeam')).toEqual([]);
    expect(db.getRows('militiaTeamState')).toEqual([]);
  });

  it('upserts cache and order state directly', async () => {
    const { ctx, db } = createHarness({
      marketplaces: [
        {
          _id: 'market_1',
          militiaId: 'm1',
          label: 'South Gate Market',
        },
      ],
    });

    await upsertCacheState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      label: 'Reserve #1',
      cacheClass: 'major',
      location: 'Old quarry',
      contentsSummary: 'arms and rations',
      status: 'hidden',
      isSecureLocation: true,
      createdWeek: 4,
      updatedWeek: 6,
    });

    await upsertOrderState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      description: 'Wands',
      deliveryDays: 5,
      orderedWeek: 6,
      dueWeek: 7,
      status: 'pending',
      sourceAction: 'broker_market',
      marketplaceId: 'market_1',
    });

    expect(db.getRows('militiaCache')[0]).toEqual(
      expect.objectContaining({
        label: 'Reserve #1',
        cacheClass: 'major',
        isSecureLocation: true,
      }),
    );
    expect(db.getRows('militiaOrder')[0]).toEqual(
      expect.objectContaining({
        description: 'Wands',
        sourceAction: 'broker_market',
        marketplaceId: 'market_1',
      }),
    );
  });

  it('upserts a manual tracked person', async () => {
    const { ctx, db } = createHarness({
      characters: [
        {
          _id: 'char_1',
          campaignId: 'c1',
          name: 'Aubrin',
        },
      ],
    });

    await upsertTrackedPersonState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      displayName: ' Aubrin Guarded ',
      personKind: 'pc',
      status: 'hidden',
      locationType: 'settlement',
      settlementKey: 'Longshadow',
      sourceAction: 'manual',
      characterId: 'char_1',
    });

    expect(db.getRows('militiaCharacterStatus')[0]).toEqual(
      expect.objectContaining({
        displayName: 'Aubrin Guarded',
        status: 'hidden',
        settlementKey: 'Longshadow',
        sourceAction: 'manual',
        characterId: 'char_1',
      }),
    );
  });

  it('patches an existing event state entry', async () => {
    const { ctx, db } = createHarness({
      eventStates: [
        {
          _id: 'event_1',
          militiaId: 'm1',
          weekNumber: 5,
          eventType: 'rivalry',
          isPersistent: true,
          startedWeek: 5,
          resolved: false,
        },
      ],
    });

    await upsertEventState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      eventStateId: 'event_1',
      weekNumber: 5,
      eventType: 'rivalry',
      isPersistent: true,
      startedWeek: 5,
      mitigationUntilWeek: 8,
      resolved: false,
    });

    expect(db.getRows('militiaEventState')[0]).toEqual(
      expect.objectContaining({
        _id: 'event_1',
        mitigationUntilWeek: 8,
        eventType: 'rivalry',
      }),
    );
  });
});
