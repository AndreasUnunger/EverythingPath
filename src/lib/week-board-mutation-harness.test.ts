import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
}));

vi.mock('../../convex/user', () => ({
  hasAccessToOrg: vi.fn(async () => true),
}));

type Row = { _id: string; [key: string]: unknown };

class FakeDb {
  private tables: Record<string, Row[]>;
  public patches: Array<{ table: string; id: string; patch: Record<string, unknown> }> =
    [];
  public inserts: Array<{ table: string; doc: Record<string, unknown> }> = [];
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
    this.patches.push({ table, id, patch });
  }

  async insert(table: string, doc: Record<string, unknown>) {
    const next: Row = { ...doc, _id: `${table}-${this.nextId++}` } as Row;
    this.tables[table] ??= [];
    this.tables[table].push(next);
    this.inserts.push({ table, doc: next });
    return next._id;
  }

  async delete(table: string, id: string) {
    const rows = this.tables[table] ?? [];
    const index = rows.findIndex((row) => row._id === id);
    if (index < 0) throw new Error(`Row not found: ${table}/${id}`);
    rows.splice(index, 1);
  }

  getRows(table: string) {
    return this.tables[table] ?? [];
  }
}

function createBaseHarness({
  weekState,
  eventStates = [],
  militiaOverrides = {},
  settlementStates = [],
  personStatuses = [],
  characters = [],
}: {
  weekState: Row;
  eventStates?: Row[];
  militiaOverrides?: Record<string, unknown>;
  settlementStates?: Row[];
  personStatuses?: Row[];
  characters?: Row[];
}) {
  const db = new FakeDb({
    campaign: [{ _id: 'c1', organizationId: 'org1' }],
    militia: [
      {
        _id: 'm1',
        campaignId: 'c1',
        rank: 2,
        training: 10,
        treasury: 20,
        notoriety: 30,
        highestBoonReached: 2,
        ...militiaOverrides,
      },
    ],
    character: characters,
    militiaWeekState: [weekState],
    militiaEventState: eventStates,
    militiaSettlementState: settlementStates,
    militiaCache: [],
    militiaOrder: [],
    militiaMarketplace: [],
    militiaCharacterStatus: personStatuses,
    militiaTeam: [],
    militiaTeamState: [],
  });

  return {
    ctx: { db } as unknown as { db: FakeDb },
    db,
  };
}

let commitCurrentPhase: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let saveWeekBoardState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let getWeekBoardState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };

beforeAll(async () => {
  const module = await import('../../convex/weekBoard');
  commitCurrentPhase = module.commitCurrentPhase as never;
  saveWeekBoardState = module.saveWeekBoardState as never;
  getWeekBoardState = module.getWeekBoardState as never;
});

describe('weekBoard commitCurrentPhase harness', () => {
  it('moves event phase to persistent when unresolved persistent events exist', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 2,
        phase: 'event',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null],
        lockVersion: 1,
      },
      eventStates: [
        {
          _id: 'e1',
          militiaId: 'm1',
          weekNumber: 1,
          eventType: 'theft',
          isPersistent: true,
          startedWeek: 1,
          resolved: false,
        },
      ],
    });

    const result = await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(result).toEqual({ nextPhase: 'persistent', weekNumber: 2 });
    const patch = db.patches.find(
      (entry) => entry.table === 'militiaWeekState' && entry.id === 'ws1',
    );
    expect(patch?.patch.phase).toBe('persistent');
  });

  it('moves event phase to week_closed when no unresolved persistent events exist', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 2,
        phase: 'event',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null],
        lockVersion: 1,
      },
    });

    const result = await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(result).toEqual({ nextPhase: 'week_closed', weekNumber: 2 });
    const patch = db.patches.find(
      (entry) => entry.table === 'militiaWeekState' && entry.id === 'ws1',
    );
    expect(patch?.patch.phase).toBe('week_closed');
  });

  it('advances week_closed to next week and applies militia patch', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['drill_militia', 'earn_gold'],
        upkeepRollTotals: {
          attritionTotal: 2,
        },
        activityRollTotals: {
          drillMilitiaTrainingGainTotal: 1,
          earnGoldTotal: 4,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });

    const result = await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(result).toEqual({ nextPhase: 'upkeep', weekNumber: 4 });

    const militia = db.getRows('militia')[0];
    expect(militia?.training).toBe(9);
    expect(militia?.treasury).toBe(4);
    expect(militia?.notoriety).toBe(30);

    const weekPatch = db.patches.find(
      (entry) => entry.table === 'militiaWeekState' && entry.id === 'ws1',
    )?.patch;
    expect(weekPatch?.phase).toBe('upkeep');
    expect(weekPatch?.weekNumber).toBe(4);
    expect(weekPatch?.isFirstWeek).toBe(false);
    expect(weekPatch?.skippedUpkeepThisWeek).toBe(false);
    expect(weekPatch?.uneventfulBonusCarry).toBe(2);
    expect(weekPatch?.upkeepRollTotals).toEqual({});
    expect(weekPatch?.activityRollTotals).toEqual({});
    expect(weekPatch?.eventRollTotals).toEqual({});
    expect(weekPatch?.stagedActivityActionIds).toEqual([null, null]);
  });

  it('deducts team costs for recruit and upgrade operations on week close', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['recruit_team', 'upgrade_team'],
        activityTeamOperations: {
          recruits: [{ slotIndex: 0, teamId: 'patrons' }],
          dismissals: [],
          upgrades: [{ slotIndex: 1, fromTeamId: 'patrons', toTeamId: 'merchants' }],
        },
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });
    await db.insert('militiaTeam', { militiaId: 'm1', teamId: 'patrons' });
    await db.insert('militiaTeamState', {
      militiaId: 'm1',
      teamId: 'patrons',
      status: 'active',
    });
    await db.patch('militia', 'm1', { treasury: 300 });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const militia = db.getRows('militia')[0];
    expect(militia?.treasury).toBe(250);
    const teams = db.getRows('militiaTeam');
    expect(teams.some((team) => team.teamId === 'merchants')).toBe(true);
  });

  it('applies staged change_officer_role operations on week close', async () => {
    const db = new FakeDb({
      campaign: [{ _id: 'c1', organizationId: 'org1' }],
      militia: [
        {
          _id: 'm1',
          campaignId: 'c1',
          rank: 2,
          training: 10,
          treasury: 20,
          notoriety: 30,
          highestBoonReached: 2,
          commandant: undefined,
        },
      ],
      character: [
        {
          _id: 'char1',
          campaignId: 'c1',
          ownerId: 'user1',
          name: 'Kara',
          description: '',
          level: 5,
          kind: 'pc',
          strength: 10,
          dexterity: 10,
          constitution: 10,
          wisdom: 10,
          charisma: 10,
          intelligence: 10,
          isActive: true,
        },
      ],
      militiaWeekState: [
        {
          _id: 'ws1',
          militiaId: 'm1',
          weekNumber: 2,
          phase: 'week_closed',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
          lastPersistentBuyoffWeek: 0,
          stagedActivityActionIds: ['change_officer_role', null],
          activityOfficerOperations: {
            changes: [
              {
                slotIndex: 0,
                role: 'commandant',
                characterId: 'char1',
              },
            ],
          },
          lockVersion: 1,
        },
      ],
      militiaTeam: [],
      militiaTeamState: [],
      militiaEventState: [],
      militiaSettlementState: [],
    });
    const ctx = { db } as unknown as { db: FakeDb };

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const militia = db.getRows('militia')[0];
    expect(militia?.commandant).toBe('char1');
  });

  it('resizes next week action slots when a staged officer change assigns strategist', async () => {
    const db = new FakeDb({
      campaign: [{ _id: 'c1', organizationId: 'org1' }],
      militia: [
        {
          _id: 'm1',
          campaignId: 'c1',
          rank: 2,
          training: 10,
          treasury: 20,
          notoriety: 30,
          highestBoonReached: 2,
          strategist: undefined,
        },
      ],
      character: [
        {
          _id: 'char1',
          campaignId: 'c1',
          ownerId: 'user1',
          name: 'Kara',
          description: '',
          level: 5,
          kind: 'pc',
          strength: 10,
          dexterity: 10,
          constitution: 10,
          wisdom: 10,
          charisma: 10,
          intelligence: 10,
          isActive: true,
        },
      ],
      militiaWeekState: [
        {
          _id: 'ws1',
          militiaId: 'm1',
          weekNumber: 2,
          phase: 'week_closed',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
          lastPersistentBuyoffWeek: 0,
          stagedActivityActionIds: ['change_officer_role', null],
          stagedActivityTeamIds: [null, null],
          activityOfficerOperations: {
            changes: [
              {
                slotIndex: 0,
                role: 'strategist',
                characterId: 'char1',
              },
            ],
          },
          upkeepRollTotals: {
            attritionTotal: 0,
          },
          activityRollTotals: {},
          eventRollTotals: {
            eventChanceTotal: 10,
            eventTriggerRollTotal: 99,
          },
          lockVersion: 1,
        },
      ],
      militiaTeam: [],
      militiaTeamState: [],
      militiaEventState: [],
      militiaSettlementState: [],
    });
    const ctx = { db } as unknown as { db: FakeDb };

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const militia = db.getRows('militia')[0];
    const weekState = db.getRows('militiaWeekState')[0];
    expect(militia?.strategist).toBe('char1');
    expect(weekState?.stagedActivityActionIds).toEqual([null, null, null]);
    expect(weekState?.stagedActivityTeamIds).toEqual([null, null, null]);
  });

  it('creates refuge, cache, and order records from staged asset operations on week close', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['activate_refuge', 'secure_cache'],
        activityAssetOperations: {
          refuges: [{ slotIndex: 0, settlementKey: 'Longshadow' }],
          caches: [
            {
              slotIndex: 1,
              mode: 'place',
              label: 'Temple cache',
              cacheClass: 'minor',
              location: 'Shrine cellar',
              contentsSummary: 'Potions and maps',
              isSecureLocation: true,
              checkTotal: 22,
            },
          ],
          orders: [
            {
              slotIndex: 0,
              description: 'Cloak of elvenkind',
              costPaid: 12,
              deliveryDays: 8,
              notes: 'For the scout team',
            },
          ],
        },
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });
    await db.insert('militiaSettlementState', {
      militiaId: 'm1',
      settlementKey: 'Longshadow',
      reputation: 'Indifferent',
      isSecured: false,
    });
    await db.patch('militia', 'm1', { rank: 6, treasury: 60 });
    await db.patch('militiaWeekState', 'ws1', {
      stagedActivityActionIds: ['activate_refuge', 'special_order', 'secure_cache'],
      activityAssetOperations: {
        refuges: [{ slotIndex: 0, settlementKey: 'Longshadow' }],
        caches: [
          {
            slotIndex: 2,
            mode: 'place',
            label: 'Temple cache',
            cacheClass: 'minor',
            location: 'Shrine cellar',
            contentsSummary: 'Potions and maps',
            isSecureLocation: true,
            checkTotal: 22,
          },
        ],
        orders: [
          {
            slotIndex: 1,
            description: 'Cloak of elvenkind',
            costPaid: 12,
            deliveryDays: 8,
            notes: 'For the scout team',
          },
        ],
      },
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const militia = db.getRows('militia')[0];
    expect(militia?.treasury).toBe(48);

    const settlement = db.getRows('militiaSettlementState')[0];
    expect(settlement).toEqual(
      expect.objectContaining({
        settlementKey: 'Longshadow',
        refugeActiveUntilWeek: 4,
        refugeActivatedWeek: 3,
      }),
    );

    const cache = db.getRows('militiaCache')[0];
    expect(cache).toEqual(
      expect.objectContaining({
        label: 'Temple cache',
        status: 'hidden',
        createdWeek: 3,
        updatedWeek: 3,
      }),
    );

    const order = db.getRows('militiaOrder')[0];
    expect(order).toEqual(
      expect.objectContaining({
        description: 'Cloak of elvenkind',
        status: 'pending',
        dueWeek: 5,
        costPaid: 12,
      }),
    );
  });

  it('creates a brokered marketplace and pending delivery record on week close', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['broker_market', null],
        stagedActivityTeamIds: ['merchants', null],
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          marketplaces: [
            {
              slotIndex: 0,
              label: 'South Gate Market',
              purchaseSummary: 'Healing potions',
              notes: 'Town commons',
            },
          ],
          covertActions: [],
          rescues: [],
          restorations: [],
        },
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const marketplace = db.getRows('militiaMarketplace')[0];
    expect(marketplace).toEqual(
      expect.objectContaining({
        label: 'South Gate Market',
        sourceAction: 'broker_market',
        teamId: 'merchants',
        availabilityTier: 'small_town',
        availabilityThreshold: 75,
        saleValuePercent: 50,
        contrabandAllowed: false,
        createdWeek: 3,
        activeUntilWeek: 4,
        notes: 'Town commons',
      }),
    );

    const order = db.getRows('militiaOrder')[0];
    expect(order).toEqual(
      expect.objectContaining({
        description: 'Healing potions',
        deliveryDays: 7,
        dueWeek: 4,
        deliveredWeek: 4,
        status: 'delivered',
        sourceAction: 'broker_market',
        marketplaceId: marketplace?._id,
      }),
    );
  });

  it('creates a black market only when the staged check succeeds', async () => {
    const successHarness = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['activate_black_market', null],
        stagedActivityTeamIds: ['blackMarketeers', null],
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          marketplaces: [
            {
              slotIndex: 0,
              label: 'Shadow Exchange',
            },
          ],
          covertActions: [],
          rescues: [],
          restorations: [],
        },
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {
          activateBlackMarketCheckTotal: 20,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });

    await commitCurrentPhase.handler(successHarness.ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(successHarness.db.getRows('militiaMarketplace')[0]).toEqual(
      expect.objectContaining({
        label: 'Shadow Exchange',
        sourceAction: 'activate_black_market',
        availabilityTier: 'small_city',
        availabilityThreshold: 90,
        saleValuePercent: 55,
        contrabandAllowed: true,
      }),
    );

    const failureHarness = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['activate_black_market', null],
        stagedActivityTeamIds: ['blackMarketeers', null],
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          marketplaces: [
            {
              slotIndex: 0,
              label: 'Failed Exchange',
            },
          ],
          covertActions: [],
          rescues: [],
          restorations: [],
        },
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {
          activateBlackMarketCheckTotal: 19,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });

    await commitCurrentPhase.handler(failureHarness.ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(failureHarness.db.getRows('militiaMarketplace')).toEqual([]);
  });

  it('retrieves a hidden cache when the staged Secure Cache check meets the DC', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['secure_cache', null],
        activityAssetOperations: {
          refuges: [],
          caches: [
            {
              slotIndex: 0,
              mode: 'retrieve',
              cacheId: 'cache1',
              checkTotal: 15,
            },
          ],
          orders: [],
        },
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });
    const cacheId = await db.insert('militiaCache', {
      militiaId: 'm1',
      label: 'Tunnel stash',
      cacheClass: 'minor',
      location: 'Old tunnel',
      contentsSummary: 'Rations',
      status: 'hidden',
      isSecureLocation: false,
      createdWeek: 2,
      updatedWeek: 2,
    });
    await db.patch('militiaWeekState', 'ws1', {
      activityAssetOperations: {
        refuges: [],
        caches: [
          {
            slotIndex: 0,
            mode: 'retrieve',
            cacheId,
            checkTotal: 15,
          },
        ],
        orders: [],
      },
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const cache = db.getRows('militiaCache')[0];
    expect(cache).toEqual(
      expect.objectContaining({
        status: 'retrieved',
        retrievedWeek: 3,
        updatedWeek: 3,
      }),
    );
  });

  it('marks hidden caches lost when Cache Discovered resolves', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null],
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 40,
          eventTriggerRollTotal: 1,
          eventPercentileTotal: 61,
        },
        lockVersion: 1,
      },
    });
    await db.insert('militiaCache', {
      militiaId: 'm1',
      label: 'Burned cache',
      cacheClass: 'minor',
      location: 'Barn loft',
      contentsSummary: 'Food',
      status: 'hidden',
      isSecureLocation: false,
      createdWeek: 2,
      updatedWeek: 2,
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const cache = db.getRows('militiaCache')[0];
    expect(cache).toEqual(
      expect.objectContaining({
        status: 'lost',
        lostWeek: 3,
        updatedWeek: 3,
      }),
    );
  });

  it('applies Market Day to the selected tracked marketplace', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null],
        eventMitigations: {
          marketDayMarketplaceId: 'market-1',
        },
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 40,
          eventTriggerRollTotal: 1,
          eventPercentileTotal: 37,
        },
        lockVersion: 1,
      },
    });
    const selectedMarketplaceId = await db.insert('militiaMarketplace', {
      militiaId: 'm1',
      label: 'Longshadow Brokered Market',
      sourceAction: 'broker_market',
      teamId: 'merchants',
      availabilityTier: 'small_town',
      availabilityThreshold: 75,
      saleValuePercent: 50,
      contrabandAllowed: false,
      createdWeek: 2,
      activeUntilWeek: 4,
    });
    const otherMarketplaceId = await db.insert('militiaMarketplace', {
      militiaId: 'm1',
      label: 'Kraggodan Brokered Market',
      sourceAction: 'broker_market',
      teamId: 'fixers',
      availabilityTier: 'small_city',
      availabilityThreshold: 75,
      saleValuePercent: 50,
      contrabandAllowed: false,
      createdWeek: 2,
      activeUntilWeek: 4,
    });
    await db.patch('militiaWeekState', 'ws1', {
      eventMitigations: {
        marketDayMarketplaceId: selectedMarketplaceId,
      },
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const discounted = db
      .getRows('militiaMarketplace')
      .find((row) => row._id === selectedMarketplaceId);
    const untouched = db
      .getRows('militiaMarketplace')
      .find((row) => row._id === otherMarketplaceId);
    expect(discounted).toEqual(
      expect.objectContaining({
        marketDayDiscountPercent: 5,
        marketDayAppliedWeek: 3,
      }),
    );
    expect(untouched).not.toEqual(
      expect.objectContaining({
        marketDayDiscountPercent: 5,
        marketDayAppliedWeek: 3,
      }),
    );
  });

  it('applies Market Day twice clause to all active tracked marketplaces', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null],
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 40,
          eventTriggerRollTotal: 1,
          eventPercentileTotal: 49,
          rollTwiceFirstTotal: 37,
          rollTwiceSecondTotal: 37,
        },
        lockVersion: 1,
      },
    });
    await db.insert('militiaMarketplace', {
      militiaId: 'm1',
      label: 'Longshadow Brokered Market',
      sourceAction: 'broker_market',
      teamId: 'merchants',
      availabilityTier: 'small_town',
      availabilityThreshold: 75,
      saleValuePercent: 50,
      contrabandAllowed: false,
      createdWeek: 2,
      activeUntilWeek: 4,
    });
    await db.insert('militiaMarketplace', {
      militiaId: 'm1',
      label: 'Shadow Exchange',
      sourceAction: 'activate_black_market',
      teamId: 'blackMarketeers',
      availabilityTier: 'small_city',
      availabilityThreshold: 90,
      saleValuePercent: 55,
      contrabandAllowed: true,
      createdWeek: 2,
      activeUntilWeek: 4,
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    for (const marketplace of db.getRows('militiaMarketplace')) {
      expect(marketplace).toEqual(
        expect.objectContaining({
          marketDayDiscountPercent: 5,
          marketDayAppliedWeek: 3,
        }),
      );
    }
  });

  it('delivers pending orders when their due week is reached', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null],
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });
    await db.insert('militiaOrder', {
      militiaId: 'm1',
      description: 'Masterwork tools',
      costPaid: 55,
      deliveryDays: 7,
      orderedWeek: 3,
      dueWeek: 4,
      status: 'pending',
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const order = db.getRows('militiaOrder')[0];
    expect(order).toEqual(
      expect.objectContaining({
        status: 'delivered',
        deliveredWeek: 4,
      }),
    );
  });

  it('creates a tracked contact from Covert Action and expires old contacts on week advance', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['covert_action', null],
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          covertActions: [
            {
              slotIndex: 0,
              mode: 'place_contact',
              displayName: 'Cell watcher',
              personKind: 'other_npc',
              siteName: 'Plague House',
            },
          ],
          rescues: [],
          restorations: [],
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      personStatuses: [
        {
          _id: 'p-expired',
          militiaId: 'm1',
          displayName: 'Old contact',
          personKind: 'other_npc',
          status: 'contact',
          locationType: 'site',
          siteName: 'Old Mill',
          activeUntilWeek: 3,
          sourceAction: 'covert_action',
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const people = db.getRows('militiaCharacterStatus');
    expect(people.find((person) => person._id === 'p-expired')).toBeUndefined();
    expect(people).toContainEqual(
      expect.objectContaining({
        displayName: 'Cell watcher',
        status: 'contact',
        locationType: 'site',
        siteName: 'Plague House',
        activeUntilWeek: 4,
        sourceAction: 'covert_action',
      }),
    );
  });

  it('suppresses Notoriety from a successful action augmented by Covert Action', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['covert_action', 'earn_gold'],
        activityTeamOperations: {
          recruits: [],
          dismissals: [],
          upgrades: [],
        },
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          covertActions: [
            {
              slotIndex: 0,
              mode: 'augment_action',
            },
          ],
          rescues: [],
          restorations: [],
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {
          earnGoldCheckTotal: 18,
          earnGoldTotal: 18,
          earnGoldNotorietyIncreaseTotal: 4,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const militia = await db.get('militia', 'm1');
    expect(militia?.notoriety).toBe(30);
    expect(militia?.treasury).toBe(38);
  });

  it('rescues a tracked captured person to the selected refuge', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['rescue_character', null],
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          covertActions: [],
          rescues: [
            {
              slotIndex: 0,
              targetStatusId: 'p1',
              destinationType: 'refuge',
              destinationSettlementKey: 'Longshadow',
            },
          ],
          restorations: [],
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {
          rescueCharacterCheckTotal: 18,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      settlementStates: [
        {
          _id: 's1',
          militiaId: 'm1',
          settlementKey: 'Longshadow',
          reputation: 'Indifferent',
          isSecured: false,
          refugeActiveUntilWeek: 4,
        },
      ],
      personStatuses: [
        {
          _id: 'p1',
          militiaId: 'm1',
          displayName: 'Captured scout',
          personKind: 'pc',
          status: 'captured',
          level: 5,
          locationType: 'site',
          siteName: 'Holding cells',
          capturedSinceWeek: 2,
          sourceAction: 'manual',
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militiaCharacterStatus')).toContainEqual(
      expect.objectContaining({
        _id: 'p1',
        status: 'active',
        locationType: 'refuge',
        settlementKey: 'Longshadow',
        rescuedWeek: 3,
      }),
    );
  });

  it('applies staged Restore Character costs and marks the target recovering', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['restore_character', null],
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          covertActions: [],
          rescues: [],
          restorations: [
            {
              slotIndex: 0,
              targetStatusId: 'p1',
              mode: 'raise_dead',
            },
          ],
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      militiaOverrides: { treasury: 7000 },
      personStatuses: [
        {
          _id: 'p1',
          militiaId: 'm1',
          displayName: 'Fallen officer',
          personKind: 'officer_npc',
          status: 'captured',
          level: 6,
          locationType: 'hq',
          sourceAction: 'manual',
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militia')[0]?.treasury).toBe(875);
    expect(db.getRows('militiaCharacterStatus')).toContainEqual(
      expect.objectContaining({
        _id: 'p1',
        status: 'recovering',
        restoredWeek: 3,
        sourceAction: 'restore_character',
      }),
    );
  });

  it('captures hidden refuge occupants when Raid resolves', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 4,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null],
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          covertActions: [],
          rescues: [],
          restorations: [],
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 40,
          eventTriggerRollTotal: 1,
          eventPercentileTotal: 80,
        },
        lockVersion: 1,
      },
      settlementStates: [
        {
          _id: 's1',
          militiaId: 'm1',
          settlementKey: 'Longshadow',
          reputation: 'Indifferent',
          isSecured: false,
          refugeActiveUntilWeek: 4,
        },
      ],
      personStatuses: [
        {
          _id: 'p1',
          militiaId: 'm1',
          displayName: 'Hidden witness',
          personKind: 'other_npc',
          status: 'hidden',
          level: 1,
          locationType: 'refuge',
          settlementKey: 'Longshadow',
          hiddenSinceWeek: 3,
          sourceAction: 'manual',
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militiaCharacterStatus')).toContainEqual(
      expect.objectContaining({
        _id: 'p1',
        status: 'captured',
        capturedSinceWeek: 4,
        rescueDcOverride: 7,
        sourceAction: 'event_raid',
      }),
    );
    expect(db.getRows('militiaSettlementState')).toContainEqual(
      expect.objectContaining({
        _id: 's1',
        refugeActiveUntilWeek: undefined,
      }),
    );
  });
});

describe('weekBoard saveWeekBoardState collaboration harness', () => {
  it('returns a strategist bonus action when strategist is directly assigned', async () => {
    const { ctx } = createBaseHarness({
      militiaOverrides: {
        strategist: 'char1',
      },
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 2,
        phase: 'activity',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null, null],
        stagedActivityTeamIds: [null, null, null],
        lockVersion: 1,
      },
    });

    const result = (await getWeekBoardState.handler(ctx, {
      campaignId: 'c1' as never,
      organizationId: 'org1',
    })) as { maxActions: number };

    expect(result.maxActions).toBe(3);
  });

  it('returns a strategist bonus action when strategist is staged via Change Officer Role', async () => {
    const { ctx } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 2,
        phase: 'activity',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['change_officer_role', null, null],
        stagedActivityTeamIds: [null, null, null],
        activityOfficerOperations: {
          changes: [
            {
              slotIndex: 0,
              role: 'strategist',
              characterId: 'char1',
            },
          ],
        },
        lockVersion: 1,
      },
    });

    const result = (await getWeekBoardState.handler(ctx, {
      campaignId: 'c1' as never,
      organizationId: 'org1',
    })) as { maxActions: number };

    expect(result.maxActions).toBe(3);
  });

  it('merges non-conflicting updates from multiple users', async () => {
    const db = new FakeDb({
      campaign: [{ _id: 'c1', organizationId: 'org1' }],
      militia: [
        {
          _id: 'm1',
          campaignId: 'c1',
          rank: 5,
          training: 10,
          treasury: 20,
          notoriety: 30,
          highestBoonReached: 2,
        },
      ],
      militiaWeekState: [
        {
          _id: 'ws1',
          militiaId: 'm1',
          weekNumber: 2,
          phase: 'activity',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
          lastPersistentBuyoffWeek: 0,
          stagedActivityActionIds: [null, null, null],
          stagedActivityTeamIds: [null, null, null],
          activityTeamOperations: { recruits: [], dismissals: [], upgrades: [] },
          upkeepTeamOperations: { disabledRecoveries: [], missingChecks: [] },
          eventMitigations: {},
          weekWarnings: [],
          upkeepRollTotals: {},
          activityRollTotals: {},
          eventRollTotals: {},
          lockVersion: 1,
        },
      ],
      militiaTeam: [{ _id: 't1', militiaId: 'm1', teamId: 'blackMarketeers' }],
      militiaTeamState: [{ _id: 'ts1', militiaId: 'm1', teamId: 'blackMarketeers', status: 'active' }],
      militiaEventState: [],
      militiaSettlementState: [],
      character: [],
    });
    const ctx = { db } as unknown as { db: FakeDb };

    await saveWeekBoardState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      patch: {
        stagedActivityActionIds: ['earn_gold', null, null],
      },
    });

    await saveWeekBoardState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      patch: {
        activityRollTotals: {
          earnGoldTotal: '7',
        },
      },
    });

    const state = db.getRows('militiaWeekState')[0];
    expect(state?.stagedActivityActionIds).toEqual(['earn_gold', null]);
    expect(state?.activityRollTotals).toEqual(
      expect.objectContaining({
        earnGoldTotal: 7,
      }),
    );
  });

  it('applies last-write-wins when multiple users update same slot', async () => {
    const db = new FakeDb({
      campaign: [{ _id: 'c1', organizationId: 'org1' }],
      militia: [
        {
          _id: 'm1',
          campaignId: 'c1',
          rank: 5,
          training: 10,
          treasury: 20,
          notoriety: 30,
          highestBoonReached: 2,
        },
      ],
      militiaWeekState: [
        {
          _id: 'ws1',
          militiaId: 'm1',
          weekNumber: 2,
          phase: 'activity',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
          lastPersistentBuyoffWeek: 0,
          stagedActivityActionIds: [null, null, null],
          stagedActivityTeamIds: [null, null, null],
          activityTeamOperations: { recruits: [], dismissals: [], upgrades: [] },
          upkeepTeamOperations: { disabledRecoveries: [], missingChecks: [] },
          eventMitigations: {},
          weekWarnings: [],
          upkeepRollTotals: {},
          activityRollTotals: {},
          eventRollTotals: {},
          lockVersion: 1,
        },
      ],
      militiaTeam: [
        { _id: 't1', militiaId: 'm1', teamId: 'blackMarketeers' },
        { _id: 't2', militiaId: 'm1', teamId: 'fixers' },
      ],
      militiaTeamState: [
        { _id: 'ts1', militiaId: 'm1', teamId: 'blackMarketeers', status: 'active' },
        { _id: 'ts2', militiaId: 'm1', teamId: 'fixers', status: 'active' },
      ],
      militiaEventState: [],
      militiaSettlementState: [],
      character: [],
    });
    const ctx = { db } as unknown as { db: FakeDb };

    await saveWeekBoardState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      patch: {
        stagedActivityActionIds: ['earn_gold', null, null],
      },
    });

    await saveWeekBoardState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      patch: {
        stagedActivityActionIds: ['broker_market', null, null],
      },
    });

    const state = db.getRows('militiaWeekState')[0];
    expect(state?.stagedActivityActionIds).toEqual(['broker_market', null]);
  });

  it('keeps strict constraints under multi-user staging attempts', async () => {
    const db = new FakeDb({
      campaign: [{ _id: 'c1', organizationId: 'org1' }],
      militia: [
        {
          _id: 'm1',
          campaignId: 'c1',
          rank: 5,
          training: 10,
          treasury: 20,
          notoriety: 30,
          highestBoonReached: 2,
        },
      ],
      militiaWeekState: [
        {
          _id: 'ws1',
          militiaId: 'm1',
          weekNumber: 2,
          phase: 'activity',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
          lastPersistentBuyoffWeek: 0,
          stagedActivityActionIds: [null, null, null],
          stagedActivityTeamIds: [null, null, null],
          activityTeamOperations: { recruits: [], dismissals: [], upgrades: [] },
          upkeepTeamOperations: { disabledRecoveries: [], missingChecks: [] },
          eventMitigations: {},
          weekWarnings: [],
          upkeepRollTotals: {},
          activityRollTotals: {},
          eventRollTotals: {},
          lockVersion: 1,
        },
      ],
      militiaTeam: [{ _id: 't1', militiaId: 'm1', teamId: 'blackMarketeers' }],
      militiaTeamState: [{ _id: 'ts1', militiaId: 'm1', teamId: 'blackMarketeers', status: 'active' }],
      militiaEventState: [],
      militiaSettlementState: [],
      character: [],
    });
    const ctx = { db } as unknown as { db: FakeDb };

    await saveWeekBoardState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      patch: {
        stagedActivityActionIds: ['drill_militia', null, null],
      },
    });

    await expect(
      saveWeekBoardState.handler(ctx, {
        organizationId: 'org1',
        militiaId: 'm1',
        patch: {
          stagedActivityActionIds: ['drill_militia', 'drill_militia', null],
        },
      }),
    ).rejects.toThrow(/Drill Militia can be staged at most once per Activity phase/);
  });

  it('parses and trims staged asset operations when saving week board state', async () => {
    const db = new FakeDb({
      campaign: [{ _id: 'c1', organizationId: 'org1' }],
      militia: [
        {
          _id: 'm1',
          campaignId: 'c1',
          rank: 6,
          training: 10,
          treasury: 20,
          notoriety: 30,
          highestBoonReached: 2,
        },
      ],
      militiaWeekState: [
        {
          _id: 'ws1',
          militiaId: 'm1',
          weekNumber: 2,
          phase: 'activity',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
          lastPersistentBuyoffWeek: 0,
          stagedActivityActionIds: ['activate_refuge', 'secure_cache', 'special_order'],
          stagedActivityTeamIds: [null, null, null],
          activityTeamOperations: { recruits: [], dismissals: [], upgrades: [] },
          activityOfficerOperations: { changes: [] },
          activityAssetOperations: {
            refuges: [],
            caches: [],
            orders: [],
            covertActions: [],
            rescues: [],
            restorations: [],
          },
          upkeepTeamOperations: { disabledRecoveries: [], missingChecks: [] },
          eventMitigations: {},
          weekWarnings: [],
          upkeepRollTotals: {},
          activityRollTotals: {},
          eventRollTotals: {},
          lockVersion: 1,
        },
      ],
      militiaTeam: [],
      militiaTeamState: [],
      militiaEventState: [],
      militiaSettlementState: [],
      militiaCache: [],
      militiaOrder: [],
      character: [],
    });
    const ctx = { db } as unknown as { db: FakeDb };

    await saveWeekBoardState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      patch: {
        activityAssetOperations: {
          refuges: [{ slotIndex: 0, settlementKey: ' Longshadow ' }],
          caches: [
            {
              slotIndex: 1,
              mode: 'place',
              label: ' Temple cache ',
              cacheClass: 'minor',
              location: ' Shrine cellar ',
              contentsSummary: ' Potions ',
              isSecureLocation: true,
              checkTotal: ' 21 ',
            },
          ],
          orders: [
            {
              slotIndex: 2,
              description: ' Cloak of resistance ',
              notes: ' Scout gear ',
              costPaid: ' 1000 ',
              deliveryDays: ' 14 ',
            },
          ],
          marketplaces: [],
        },
      },
    });

    const state = db.getRows('militiaWeekState')[0];
    expect(state?.activityAssetOperations).toEqual({
      refuges: [{ slotIndex: 0, settlementKey: 'Longshadow' }],
      caches: [
        {
          slotIndex: 1,
          mode: 'place',
          label: 'Temple cache',
          cacheClass: 'minor',
          location: 'Shrine cellar',
          contentsSummary: 'Potions',
          isSecureLocation: true,
          checkTotal: 21,
        },
      ],
      marketplaces: [],
      covertActions: [],
      orders: [
        {
          slotIndex: 2,
          description: 'Cloak of resistance',
          notes: 'Scout gear',
          costPaid: 1000,
          deliveryDays: 14,
        },
      ],
      rescues: [],
      restorations: [],
    });
    expect(state?.weekWarnings).toEqual([
      {
        code: 'refuge_requires_tracked_settlement',
        message:
          'Activate Refuge requires a tracked settlement in the ledger. Add "Longshadow" there first.',
      },
    ]);
  });

  it('keeps a third staged action when strategist is already staged for the week', async () => {
    const db = new FakeDb({
      campaign: [{ _id: 'c1', organizationId: 'org1' }],
      militia: [
        {
          _id: 'm1',
          campaignId: 'c1',
          rank: 2,
          training: 10,
          treasury: 20,
          notoriety: 30,
          highestBoonReached: 2,
        },
      ],
      militiaWeekState: [
        {
          _id: 'ws1',
          militiaId: 'm1',
          weekNumber: 2,
          phase: 'activity',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
          lastPersistentBuyoffWeek: 0,
          stagedActivityActionIds: ['change_officer_role', null, null],
          stagedActivityTeamIds: [null, null, null],
          activityOfficerOperations: {
            changes: [
              {
                slotIndex: 0,
                role: 'strategist',
                characterId: 'char1',
              },
            ],
          },
          activityTeamOperations: { recruits: [], dismissals: [], upgrades: [] },
          upkeepTeamOperations: { disabledRecoveries: [], missingChecks: [] },
          eventMitigations: {},
          weekWarnings: [],
          upkeepRollTotals: {},
          activityRollTotals: {},
          eventRollTotals: {},
          lockVersion: 1,
        },
      ],
      militiaTeam: [],
      militiaTeamState: [],
      militiaEventState: [],
      militiaSettlementState: [],
      character: [],
    });
    const ctx = { db } as unknown as { db: FakeDb };

    await saveWeekBoardState.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      patch: {
        stagedActivityActionIds: [
          'change_officer_role',
          'drill_militia',
          'guarantee_event',
        ],
      },
    });

    const state = db.getRows('militiaWeekState')[0];
    expect(state?.stagedActivityActionIds).toEqual([
      'change_officer_role',
      'drill_militia',
      'guarantee_event',
    ]);
  });

  it('does not allow Activate Refuge to create a settlement during week close', async () => {
    const { ctx } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['activate_refuge', null],
        activityAssetOperations: {
          refuges: [{ slotIndex: 0, settlementKey: 'Longshadow' }],
          caches: [],
          orders: [],
          covertActions: [],
          rescues: [],
          restorations: [],
        },
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
    });

    await expect(
      commitCurrentPhase.handler(ctx, {
        organizationId: 'org1',
        militiaId: 'm1' as never,
      }),
    ).rejects.toThrow(/Activate Refuge requires an existing tracked settlement: Longshadow/);
  });
});
