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
    const next: Row = { ...current, ...patch, _id: current._id };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        delete (next as Record<string, unknown>)[key];
      }
    }
    rows[index] = next;
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
  cacheRows = [],
  marketplaceRows = [],
  orderRows = [],
  personStatuses = [],
  characters = [],
  teamRows = [],
  teamStates = [],
}: {
  weekState: Row;
  eventStates?: Row[];
  militiaOverrides?: Record<string, unknown>;
  settlementStates?: Row[];
  cacheRows?: Row[];
  marketplaceRows?: Row[];
  orderRows?: Row[];
  personStatuses?: Row[];
  characters?: Row[];
  teamRows?: Row[];
  teamStates?: Row[];
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
    militiaCache: cacheRows,
    militiaOrder: orderRows,
    militiaMarketplace: marketplaceRows,
    militiaCharacterStatus: personStatuses,
    militiaTeam: teamRows,
    militiaTeamState: teamStates,
  });

  return {
    ctx: { db } as unknown as { db: FakeDb },
    db,
  };
}

let commitCurrentPhase: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let goToPreviousWeek: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let saveWeekBoardState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let getWeekBoardState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let getWeekBoardReferenceData: {
  handler: (ctx: unknown, args: unknown) => Promise<unknown>;
};
let getWeekBoardTrackedState: {
  handler: (ctx: unknown, args: unknown) => Promise<unknown>;
};
let getWeekBoardLiveState: {
  handler: (ctx: unknown, args: unknown) => Promise<unknown>;
};

beforeAll(async () => {
  const module = await import('../../convex/weekBoard');
  commitCurrentPhase = module.commitCurrentPhase as never;
  goToPreviousWeek = module.goToPreviousWeek as never;
  saveWeekBoardState = module.saveWeekBoardState as never;
  getWeekBoardState = module.getWeekBoardState as never;
  getWeekBoardReferenceData = module.getWeekBoardReferenceData as never;
  getWeekBoardTrackedState = module.getWeekBoardTrackedState as never;
  getWeekBoardLiveState = module.getWeekBoardLiveState as never;
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

  it('does not dismiss a team on a failed Dismiss Team check', async () => {
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
        stagedActivityActionIds: ['dismiss_team'],
        activityTeamOperations: {
          recruits: [],
          dismissals: [{ slotIndex: 0, teamId: 'patrons' }],
          upgrades: [],
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {
          dismissTeamCheckTotal: 9,
          dismissTeamNotorietyIncreaseTotal: 4,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      teamRows: [{ _id: 'team-1', militiaId: 'm1', teamId: 'patrons' }],
      teamStates: [
        {
          _id: 'team-state-1',
          militiaId: 'm1',
          teamId: 'patrons',
          status: 'active',
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militiaTeam')).toContainEqual(
      expect.objectContaining({ teamId: 'patrons' }),
    );
    expect(db.getRows('militia')[0]?.notoriety).toBe(34);
  });

  it('does not recruit a team on a failed Recruit Team check', async () => {
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
        stagedActivityActionIds: ['recruit_team'],
        activityTeamOperations: {
          recruits: [{ slotIndex: 0, teamId: 'patrons' }],
          dismissals: [],
          upgrades: [],
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {
          recruitTeamCheckTotal: 9,
          recruitTeamNotorietyIncreaseTotal: 6,
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

    expect(db.getRows('militiaTeam')).toHaveLength(0);
    expect(db.getRows('militia')[0]?.notoriety).toBe(36);
  });

  it('applies Lie Low notoriety reduction on week close', async () => {
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
        stagedActivityActionIds: ['lie_low'],
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      teamRows: [
        { _id: 'team-1', militiaId: 'm1', teamId: 'patrons' },
        { _id: 'team-2', militiaId: 'm1', teamId: 'informants' },
      ],
      teamStates: [
        {
          _id: 'team-state-1',
          militiaId: 'm1',
          teamId: 'patrons',
          status: 'active',
        },
        {
          _id: 'team-state-2',
          militiaId: 'm1',
          teamId: 'informants',
          status: 'active',
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militia')[0]?.notoriety).toBe(28);
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

  it('retrieves the discovered cache when Cache Discovered mitigation succeeds', async () => {
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
          cacheDiscoveredMitigationTotal: 12,
        },
        upkeepRollTotals: { attritionTotal: 0 },
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
      label: 'Saved cache',
      cacheClass: 'minor',
      location: 'Old well',
      contentsSummary: 'Potions',
      status: 'hidden',
      isSecureLocation: false,
      createdWeek: 2,
      updatedWeek: 2,
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militiaCache')[0]).toEqual(
      expect.objectContaining({
        status: 'retrieved',
        retrievedWeek: 3,
        updatedWeek: 3,
      }),
    );
  });

  it('uses Theft mitigation to reduce treasury loss to ten percent', async () => {
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
          theftMitigationTotal: 20,
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {},
        eventRollTotals: {
          eventChanceTotal: 40,
          eventTriggerRollTotal: 1,
          eventPercentileTotal: 73,
        },
        lockVersion: 1,
      },
      militiaOverrides: {
        treasury: 100,
      },
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militia')[0]?.treasury).toBe(90);
  });

  it('ends persistent Theft after a successful Reduce Danger action', async () => {
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
        stagedActivityActionIds: ['reduce_danger'],
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {
          reduceDangerCheckTotal: 15,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      eventStates: [
        {
          _id: 'event-1',
          militiaId: 'm1',
          weekNumber: 2,
          eventType: 'theft',
          isPersistent: true,
          startedWeek: 2,
          resolved: false,
        },
        {
          _id: 'event-2',
          militiaId: 'm1',
          weekNumber: 2,
          eventType: 'rivalry',
          isPersistent: true,
          startedWeek: 2,
          resolved: false,
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militiaEventState')).toContainEqual(
      expect.objectContaining({
        _id: 'event-1',
        eventType: 'theft',
        resolved: true,
        isPersistent: false,
        endedWeek: 3,
      }),
    );
    expect(db.getRows('militiaEventState')).toContainEqual(
      expect.objectContaining({
        _id: 'event-2',
        eventType: 'rivalry',
        resolved: false,
        isPersistent: true,
      }),
    );
  });

  it('counts slot-specific modifiers when clearing persistent Theft with Reduce Danger', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [
          {
            kind: 'team_check_modifier',
            appliesWeek: 3,
            teamId: 'defenders',
            modifierTotal: 2,
            sourceEventType: 'turn_around',
          },
        ],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['reduce_danger'],
        stagedActivityTeamIds: ['defenders'],
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {
          reduceDangerCheckTotal: 13,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      eventStates: [
        {
          _id: 'event-1',
          militiaId: 'm1',
          weekNumber: 2,
          eventType: 'theft',
          isPersistent: true,
          startedWeek: 2,
          resolved: false,
        },
      ],
      teamRows: [{ _id: 'team-1', militiaId: 'm1', teamId: 'defenders' }],
      teamStates: [
        {
          _id: 'team-state-1',
          militiaId: 'm1',
          teamId: 'defenders',
          status: 'active',
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militiaEventState')).toContainEqual(
      expect.objectContaining({
        _id: 'event-1',
        eventType: 'theft',
        resolved: true,
        isPersistent: false,
        endedWeek: 3,
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
    const settlement = db
      .getRows('militiaSettlementState')
      .find((row) => row._id === 's1');
    expect(settlement?.refugeActiveUntilWeek).toBeUndefined();
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
      reduceDangerTargets: [],
      spreadPropagandaTargets: [],
      strikeTeams: [],
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

  it('merges sparse autosave patches without clearing untouched nested state', async () => {
    const db = new FakeDb({
      campaign: [{ _id: 'c1', organizationId: 'org1' }],
      militia: [
        {
          _id: 'm1',
          campaignId: 'c1',
          rank: 4,
          training: 12,
          treasury: 80,
          notoriety: 20,
          highestBoonReached: 2,
        },
      ],
      militiaWeekState: [
        {
          _id: 'ws1',
          militiaId: 'm1',
          weekNumber: 3,
          phase: 'activity',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
          lastPersistentBuyoffWeek: 0,
          stagedActivityActionIds: ['special_order', 'secure_cache'],
          stagedActivityTeamIds: [null, null],
          activityTeamOperations: { recruits: [], dismissals: [], upgrades: [] },
          activityOfficerOperations: { changes: [] },
          activityAssetOperations: {
            refuges: [],
            caches: [
              {
                slotIndex: 1,
                mode: 'place',
                label: 'Old cache',
                cacheClass: 'minor',
                location: 'Windmill',
                contentsSummary: 'Supplies',
                isSecureLocation: false,
                checkTotal: 18,
              },
            ],
            orders: [
              {
                slotIndex: 0,
                description: 'Old order',
                costPaid: 25,
                deliveryDays: 7,
              },
            ],
            marketplaces: [],
            covertActions: [],
            rescues: [],
            restorations: [],
          },
          upkeepTeamOperations: { disabledRecoveries: [], missingChecks: [] },
          eventMitigations: {
            turncoatSelectedTeamId: 'moles',
            rivalrySelectedTeamIds: ['patrons'],
          },
          weekWarnings: [],
          upkeepRollTotals: {},
          activityRollTotals: {
            earnGoldCheckTotal: 19,
          },
          eventRollTotals: {
            eventChanceTotal: 35,
            guaranteedChosen: 'first',
          },
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
          orders: [
            {
              slotIndex: 0,
              description: 'New order',
              costPaid: '40',
              deliveryDays: '5',
            },
          ],
        },
        eventMitigations: {
          turncoatSelectedTeamId: null,
        },
        activityRollTotals: {
          specialActionCostTotal: '12',
        },
        eventRollTotals: {
          guaranteedChosen: null,
        },
      },
    });

    const state = db.getRows('militiaWeekState')[0];
    expect(state?.activityAssetOperations).toEqual({
      refuges: [],
      reduceDangerTargets: [],
      spreadPropagandaTargets: [],
      strikeTeams: [],
      caches: [
        {
          slotIndex: 1,
          mode: 'place',
          label: 'Old cache',
          cacheClass: 'minor',
          location: 'Windmill',
          contentsSummary: 'Supplies',
          isSecureLocation: false,
          checkTotal: 18,
        },
      ],
      orders: [
        {
          slotIndex: 0,
          description: 'New order',
          notes: undefined,
          costPaid: 40,
          deliveryDays: 5,
        },
      ],
      marketplaces: [],
      covertActions: [],
      rescues: [],
      restorations: [],
    });
    expect(state?.eventMitigations).toEqual({
      turncoatSelectedTeamId: undefined,
      rivalrySelectedTeamIds: ['patrons'],
    });
    expect(state?.activityRollTotals).toEqual({
      earnGoldCheckTotal: 19,
      specialActionCostTotal: 12,
    });
    expect(state?.eventRollTotals).toEqual({
      eventChanceTotal: 35,
      guaranteedChosen: undefined,
    });
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

  it('rolls back all committed week state changes from the saved snapshot', async () => {
    const stagedActivityActionIds = [
      'recruit_team',
      'change_officer_role',
      'activate_refuge',
      'secure_cache',
      'special_order',
      'covert_action',
    ];

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
        stagedActivityActionIds,
        stagedActivityTeamIds: [null, null, null, null, null, null],
        activityTeamOperations: {
          recruits: [{ slotIndex: 0, teamId: 'patrons' }],
          dismissals: [],
          upgrades: [],
        },
        activityOfficerOperations: {
          changes: [{ slotIndex: 1, role: 'strategist', characterId: 'char2' }],
        },
        activityAssetOperations: {
          refuges: [{ slotIndex: 2, settlementKey: 'Longshadow' }],
          caches: [
            {
              slotIndex: 3,
              mode: 'place',
              label: 'North Cache',
              cacheClass: 'minor',
              location: 'Barn',
              contentsSummary: 'Food and blankets',
              checkTotal: 20,
            },
          ],
          orders: [
            {
              slotIndex: 4,
              description: 'Healing kits',
              costPaid: 75,
              deliveryDays: 14,
            },
          ],
          marketplaces: [],
          covertActions: [
            {
              slotIndex: 5,
              mode: 'place_contact',
              displayName: 'Agent Vale',
              personKind: 'other_npc',
              siteName: 'Citadel',
            },
          ],
          rescues: [],
          restorations: [],
        },
        upkeepTeamOperations: {
          disabledRecoveries: [],
          missingChecks: [],
        },
        eventMitigations: {},
        weekWarnings: [],
        upkeepRollTotals: {
          attritionTotal: 3,
        },
        activityRollTotals: {
          recruitTeamCheckTotal: 10,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      militiaOverrides: {
        rank: 19,
        training: 4000,
        treasury: 1000,
        notoriety: 12,
      },
      settlementStates: [
        {
          _id: 'set1',
          militiaId: 'm1',
          settlementKey: 'Longshadow',
          reputation: 'Friendly',
          isSecured: false,
        },
      ],
      characters: [
        {
          _id: 'char2',
          campaignId: 'c1',
          name: 'Talandra',
          level: 10,
          isActive: true,
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    const advancedWeekState = db.getRows('militiaWeekState')[0];
    expect(advancedWeekState?.weekNumber).toBe(4);
    expect(advancedWeekState?.phase).toBe('upkeep');
    expect((advancedWeekState?.rollbackHistory as unknown[])?.length).toBe(1);
    expect(db.getRows('militiaTeam')).toHaveLength(1);
    expect(db.getRows('militiaCache')).toHaveLength(1);
    expect(db.getRows('militiaOrder')).toHaveLength(1);
    expect(db.getRows('militiaCharacterStatus')).toHaveLength(1);

    const result = await goToPreviousWeek.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(result).toEqual({ weekNumber: 3, phase: 'week_closed' });

    const militia = db.getRows('militia')[0];
    expect(militia?.training).toBe(4000);
    expect(militia?.treasury).toBe(1000);
    expect(militia?.notoriety).toBe(12);
    expect(militia?.strategist).toBeUndefined();

    const weekState = db.getRows('militiaWeekState')[0];
    expect(weekState?.weekNumber).toBe(3);
    expect(weekState?.phase).toBe('week_closed');
    expect(weekState?.stagedActivityActionIds).toEqual(stagedActivityActionIds);
    expect((weekState?.rollbackHistory as unknown[]) ?? []).toEqual([]);

    expect(db.getRows('militiaTeam')).toEqual([]);
    expect(db.getRows('militiaTeamState')).toEqual([]);
    expect(db.getRows('militiaCache')).toEqual([]);
    expect(db.getRows('militiaOrder')).toEqual([]);
    expect(db.getRows('militiaMarketplace')).toEqual([]);
    expect(db.getRows('militiaCharacterStatus')).toEqual([]);

    expect(db.getRows('militiaSettlementState')).toEqual([
      {
        _id: 'set1',
        militiaId: 'm1',
        settlementKey: 'Longshadow',
        reputation: 'Friendly',
        isSecured: false,
      },
    ]);
  });

  it('remaps recreated row ids when rolling back a saved snapshot', async () => {
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
        stagedActivityActionIds: [null, null, null],
        stagedActivityTeamIds: [null, null, null],
        activityTeamOperations: {
          recruits: [],
          dismissals: [],
          upgrades: [],
        },
        activityOfficerOperations: {
          changes: [],
        },
        activityAssetOperations: {
          refuges: [],
          reduceDangerTargets: [],
          spreadPropagandaTargets: [],
          strikeTeams: [],
          caches: [{ slotIndex: 0, mode: 'retrieve', cacheId: 'cache-1' }],
          orders: [],
          marketplaces: [],
          covertActions: [],
          rescues: [
            {
              slotIndex: 1,
              targetSource: 'tracked',
              targetStatusId: 'person-1',
              destinationType: 'hq',
            },
          ],
          restorations: [
            {
              slotIndex: 2,
              targetSource: 'tracked',
              targetStatusId: 'person-1',
              mode: 'custom',
              customCostTotal: 25,
            },
          ],
        },
        upkeepTeamOperations: {
          disabledRecoveries: [],
          missingChecks: [],
        },
        eventMitigations: {
          marketDayMarketplaceId: 'market-1',
        },
        weekWarnings: [],
        upkeepRollTotals: {
          attritionTotal: 0,
        },
        activityRollTotals: {
          restoreCharacterCostTotal: 25,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      cacheRows: [
        {
          _id: 'cache-1',
          militiaId: 'm1',
          label: 'North Cache',
          cacheClass: 'minor',
          location: 'Barn',
          contentsSummary: 'Food and blankets',
          status: 'hidden',
          isSecureLocation: true,
          createdWeek: 2,
          updatedWeek: 2,
        },
      ],
      marketplaceRows: [
        {
          _id: 'market-1',
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
        },
      ],
      orderRows: [
        {
          _id: 'order-1',
          militiaId: 'm1',
          description: 'Healing kits',
          costPaid: 75,
          deliveryDays: 14,
          orderedWeek: 2,
          dueWeek: 4,
          status: 'ordered',
          sourceAction: 'broker_market',
          marketplaceId: 'market-1',
        },
      ],
      personStatuses: [
        {
          _id: 'person-1',
          militiaId: 'm1',
          displayName: 'Agent Vale',
          personKind: 'other_npc',
          status: 'hidden',
          locationType: 'site',
          siteName: 'Citadel',
          hiddenSinceWeek: 2,
          sourceAction: 'covert_action',
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    await db.delete('militiaCache', 'cache-1');
    await db.delete('militiaMarketplace', 'market-1');
    await db.delete('militiaOrder', 'order-1');
    await db.delete('militiaCharacterStatus', 'person-1');

    const result = await goToPreviousWeek.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(result).toEqual({ weekNumber: 3, phase: 'week_closed' });

    const restoredCache = db.getRows('militiaCache')[0];
    const restoredMarketplace = db.getRows('militiaMarketplace')[0];
    const restoredOrder = db.getRows('militiaOrder')[0];
    const restoredTrackedPerson = db.getRows('militiaCharacterStatus')[0];
    const restoredWeekState = db.getRows('militiaWeekState')[0] as
      | (Row & {
          activityAssetOperations?: {
            caches?: Array<{ cacheId?: string }>;
            rescues?: Array<{ targetStatusId?: string }>;
            restorations?: Array<{ targetStatusId?: string }>;
          };
          eventMitigations?: { marketDayMarketplaceId?: string };
        })
      | undefined;

    expect(restoredCache?._id).not.toBe('cache-1');
    expect(restoredMarketplace?._id).not.toBe('market-1');
    expect(restoredOrder?._id).not.toBe('order-1');
    expect(restoredTrackedPerson?._id).not.toBe('person-1');

    expect(restoredOrder?.marketplaceId).toBe(restoredMarketplace?._id);
    expect(
      restoredWeekState?.activityAssetOperations?.caches?.[0]?.cacheId,
    ).toBe(restoredCache?._id);
    expect(
      restoredWeekState?.activityAssetOperations?.rescues?.[0]?.targetStatusId,
    ).toBe(restoredTrackedPerson?._id);
    expect(
      restoredWeekState?.activityAssetOperations?.restorations?.[0]?.targetStatusId,
    ).toBe(restoredTrackedPerson?._id);
    expect(restoredWeekState?.eventMitigations?.marketDayMarketplaceId).toBe(
      restoredMarketplace?._id,
    );
  });

  it('returns reference data from the split week-board query', async () => {
    const { ctx } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 3,
        phase: 'activity',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null],
        stagedActivityTeamIds: [null, null],
        lockVersion: 1,
      },
      militiaOverrides: {
        strategist: 'char2',
      },
      settlementStates: [
        {
          _id: 'set2',
          militiaId: 'm1',
          settlementKey: 'Longshadow',
          reputation: 'Indifferent',
          isSecured: false,
        },
        {
          _id: 'set1',
          militiaId: 'm1',
          settlementKey: 'Brellin',
          reputation: 'Friendly',
          isSecured: true,
        },
      ],
      teamRows: [
        {
          _id: 'team2',
          militiaId: 'm1',
          teamId: 'spies',
          managerSource: 'character',
          managerCharacterId: 'char1',
        },
        {
          _id: 'team1',
          militiaId: 'm1',
          teamId: 'defenders',
          managerSource: 'freeform',
          managerName: 'Captain Vara',
          managerKind: 'other_npc',
          managerCharisma: 14,
        },
      ],
      teamStates: [
        {
          _id: 'state2',
          militiaId: 'm1',
          teamId: 'spies',
          status: 'active',
        },
        {
          _id: 'state1',
          militiaId: 'm1',
          teamId: 'defenders',
          status: 'disabled',
          unavailableUntilWeek: 5,
          notes: 'Recovering',
        },
      ],
      characters: [
        {
          _id: 'char1',
          campaignId: 'c1',
          name: 'Sel',
          kind: 'pc',
          level: 6,
          charisma: 16,
          strength: 10,
          dexterity: 12,
          constitution: 12,
          intelligence: 10,
          wisdom: 10,
        },
        {
          _id: 'char2',
          campaignId: 'c1',
          name: 'Tavia',
          kind: 'officer_npc',
          level: 4,
          charisma: 12,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 12,
        },
        {
          _id: 'char3',
          campaignId: 'c1',
          name: 'Archived Scout',
          kind: 'pc',
          level: 7,
          charisma: 18,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          isActive: false,
        },
      ],
    });

    const result = (await getWeekBoardReferenceData.handler(ctx, {
      campaignId: 'c1',
      organizationId: 'org1',
    })) as Record<string, unknown>;

    expect(result.militiaId).toBe('m1');
    expect(result.settlementKeys).toEqual(['Brellin', 'Longshadow']);
    expect(result.highestPcLevel).toBe(6);
    expect(result.assignableCharacters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: 'char1', name: 'Sel' }),
        expect.objectContaining({ _id: 'char2', name: 'Tavia' }),
      ]),
    );
    expect((result.assignableCharacters as Array<{ _id: string }>).map((character) => character._id)).not.toContain(
      'char3',
    );
    expect(result.teams).toEqual([
      expect.objectContaining({
        teamId: 'defenders',
        status: 'disabled',
        unavailableUntilWeek: 5,
        manager: expect.objectContaining({
          displayName: 'Captain Vara',
          maxTeams: 1,
        }),
      }),
      expect.objectContaining({
        teamId: 'spies',
        status: 'active',
        manager: expect.objectContaining({
          displayName: 'Sel',
          characterId: 'char1',
          charismaBonus: 3,
        }),
      }),
    ]);
    expect(result.officerAssignments).toEqual(
      expect.objectContaining({ strategist: 'char2' }),
    );
  });

  it('returns tracked state from the split week-board query', async () => {
    const { ctx } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 4,
        phase: 'event',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 1,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: [null, null],
        stagedActivityTeamIds: [null, null],
        lockVersion: 1,
      },
      settlementStates: [
        {
          _id: 'set2',
          militiaId: 'm1',
          settlementKey: 'Longshadow',
          reputation: 'Indifferent',
          isSecured: false,
          temporaryShift: -2,
          refugeActiveUntilWeek: 5,
          refugeActivatedWeek: 4,
        },
        {
          _id: 'set1',
          militiaId: 'm1',
          settlementKey: 'Brellin',
          reputation: 'Friendly',
          isSecured: true,
          temporaryShift: 1,
        },
      ],
      cacheRows: [
        {
          _id: 'cache2',
          militiaId: 'm1',
          label: 'Zeta Cache',
          cacheClass: 'major',
          location: 'Ruins',
          contentsSummary: 'Armor',
          status: 'hidden',
          isSecureLocation: true,
          createdWeek: 3,
          updatedWeek: 4,
        },
        {
          _id: 'cache1',
          militiaId: 'm1',
          label: 'Alpha Cache',
          cacheClass: 'minor',
          location: 'Barn',
          contentsSummary: 'Food',
          status: 'retrieved',
          isSecureLocation: false,
          createdWeek: 2,
          updatedWeek: 3,
          retrievedWeek: 4,
        },
      ],
      marketplaceRows: [
        {
          _id: 'market2',
          militiaId: 'm1',
          label: 'Late Market',
          sourceAction: 'activate_black_market',
          teamId: 'black_marketeers',
          availabilityTier: 'small_city',
          availabilityThreshold: 90,
          saleValuePercent: 55,
          contrabandAllowed: true,
          createdWeek: 4,
          activeUntilWeek: 5,
        },
        {
          _id: 'market1',
          militiaId: 'm1',
          label: 'Early Market',
          sourceAction: 'broker_market',
          teamId: 'merchants',
          availabilityTier: 'small_town',
          availabilityThreshold: 75,
          saleValuePercent: 50,
          contrabandAllowed: false,
          createdWeek: 3,
          activeUntilWeek: 4,
        },
      ],
      orderRows: [
        {
          _id: 'order2',
          militiaId: 'm1',
          description: 'Late Order',
          orderedWeek: 4,
          dueWeek: 5,
          status: 'pending',
        },
        {
          _id: 'order1',
          militiaId: 'm1',
          description: 'Early Order',
          orderedWeek: 3,
          dueWeek: 4,
          status: 'delivered',
        },
      ],
      personStatuses: [
        {
          _id: 'person2',
          militiaId: 'm1',
          displayName: 'Zora',
          personKind: 'other_npc',
          status: 'hidden',
          locationType: 'site',
          siteName: 'Mill',
        },
        {
          _id: 'person1',
          militiaId: 'm1',
          displayName: 'Aric',
          personKind: 'pc',
          status: 'captured',
          locationType: 'settlement',
          settlementKey: 'Brellin',
        },
      ],
      eventStates: [
        {
          _id: 'evt1',
          militiaId: 'm1',
          eventType: 'theft',
          isPersistent: true,
          startedWeek: 2,
          resolved: false,
        },
        {
          _id: 'evt2',
          militiaId: 'm1',
          eventType: 'rivalry',
          isPersistent: true,
          startedWeek: 1,
          resolved: true,
        },
      ],
    });

    const result = (await getWeekBoardTrackedState.handler(ctx, {
      campaignId: 'c1',
      organizationId: 'org1',
    })) as {
      settlements: Array<{ settlementKey: string }>;
      caches: Array<{ label: string }>;
      marketplaces: Array<{ label: string }>;
      orders: Array<{ description: string }>;
      trackedPeople: Array<{ displayName: string }>;
      activePersistentEvents: Array<{
        _id: string;
        eventType: string;
        startedWeek: number;
      }>;
    };

    expect(result.settlements.map((settlement) => settlement.settlementKey)).toEqual([
      'Brellin',
      'Longshadow',
    ]);
    expect(result.caches.map((cache) => cache.label)).toEqual([
      'Alpha Cache',
      'Zeta Cache',
    ]);
    expect(result.marketplaces.map((marketplace) => marketplace.label)).toEqual([
      'Early Market',
      'Late Market',
    ]);
    expect(result.orders.map((order) => order.description)).toEqual([
      'Early Order',
      'Late Order',
    ]);
    expect(result.trackedPeople.map((person) => person.displayName)).toEqual([
      'Aric',
      'Zora',
    ]);
    expect(result.activePersistentEvents).toEqual([
      expect.objectContaining({
        _id: 'evt1',
        eventType: 'theft',
        startedWeek: 2,
      }),
    ]);
  });

  it('applies Guarantee Event notoriety and base Turncoat training loss', async () => {
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
        stagedActivityActionIds: ['guarantee_event'],
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {
          guaranteeEventNotorietyIncreaseTotal: 4,
        },
        eventMitigations: {
          turncoatTrainingLossTotal: 5,
        },
        eventRollTotals: {
          guaranteedFirstPercentileTotal: 58,
          guaranteedSecondPercentileTotal: 12,
          guaranteedChosen: 'first',
        },
        lockVersion: 1,
      },
      militiaOverrides: {
        rank: 2,
        training: 20,
        treasury: 100,
        notoriety: 10,
      },
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militia')[0]).toEqual(
      expect.objectContaining({
        training: 15,
        treasury: 80,
        notoriety: 14,
      }),
    );
  });

  it('applies Reduce Danger, Spread Propaganda, and Strike Team week-close effects', async () => {
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
        stagedActivityActionIds: [
          'reduce_danger',
          'spread_propaganda',
          'strike_team',
        ],
        stagedActivityTeamIds: [null, null, 'rangers'],
        activityAssetOperations: {
          refuges: [],
          reduceDangerTargets: [{ slotIndex: 0, settlementKey: 'Longshadow' }],
          spreadPropagandaTargets: [
            { slotIndex: 1, settlementKey: 'Longshadow' },
          ],
          strikeTeams: [
            {
              slotIndex: 2,
              mode: 'combat_support',
              location: 'South gate',
            },
          ],
          caches: [],
          orders: [],
          marketplaces: [],
          covertActions: [],
          rescues: [],
          restorations: [],
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {
          reduceDangerCheckTotal: 15,
          spreadPropagandaCheckTotal: 20,
        },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
      },
      militiaOverrides: { rank: 4, treasury: 500 },
      settlementStates: [
        {
          _id: 'settlement-1',
          militiaId: 'm1',
          settlementKey: 'Longshadow',
          reputation: 'Indifferent',
          isSecured: true,
          temporaryShift: -1,
        },
      ],
      teamRows: [{ _id: 'team-1', militiaId: 'm1', teamId: 'rangers' }],
      teamStates: [
        { _id: 'team-state-1', militiaId: 'm1', teamId: 'rangers', status: 'active' },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militiaSettlementState')[0]).toEqual(
      expect.objectContaining({
        reputation: 'Friendly',
        temporaryShift: 1,
      }),
    );
    expect(db.getRows('militiaWeekState')[0]?.queuedEffects).toContainEqual(
      expect.objectContaining({
        kind: 'table_note',
        appliesWeek: 5,
        strikeTeamMode: 'combat_support',
        location: 'South gate',
      }),
    );
  });

  it('blocks Secure Cache while Double Agent is active', async () => {
    const { ctx, db } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 4,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [
          {
            kind: 'activity_action_block',
            appliesWeek: 4,
            blockedActionId: 'secure_cache',
          },
        ],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: ['secure_cache'],
        activityAssetOperations: {
          refuges: [],
          caches: [
            {
              slotIndex: 0,
              mode: 'place',
              label: 'Hidden food',
              cacheClass: 'minor',
              location: 'Old barn',
              contentsSummary: 'Rations',
              checkTotal: 25,
            },
          ],
          orders: [],
          marketplaces: [],
          covertActions: [],
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
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militiaCache')).toEqual([]);
  });

  it('uses effective modified success for Covert Action notoriety suppression', async () => {
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
        stagedActivityActionIds: ['covert_action', 'reduce_danger'],
        activityAssetOperations: {
          refuges: [],
          reduceDangerTargets: [{ slotIndex: 1, settlementKey: 'Longshadow' }],
          spreadPropagandaTargets: [],
          strikeTeams: [],
          caches: [],
          orders: [],
          marketplaces: [],
          covertActions: [
            {
              slotIndex: 0,
              mode: 'augment_action',
              followupSlotIndex: 1,
            },
          ],
          rescues: [],
          restorations: [],
        },
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {
          reduceDangerCheckTotal: 13,
          reduceDangerNotorietyIncreaseTotal: 4,
        },
        eventRollTotals: {
          eventChanceTotal: 100,
          eventTriggerRollTotal: 1,
          eventPercentileTotal: 44,
        },
        lockVersion: 1,
      },
      militiaOverrides: {
        notoriety: 10,
      },
      settlementStates: [
        {
          _id: 'settlement-1',
          militiaId: 'm1',
          settlementKey: 'Longshadow',
          reputation: 'Hostile',
          isSecured: true,
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militia')[0]?.notoriety).toBe(10);
    expect(db.getRows('militiaSettlementState')[0]).toEqual(
      expect.objectContaining({ temporaryShift: 1 }),
    );
  });

  it('keeps team status maps current across multiple same-week events', async () => {
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
        upkeepRollTotals: { attritionTotal: 0 },
        activityRollTotals: {},
        eventMitigations: {
          sicknessSelectedTeamId: 'patrons',
          turnAroundBoostTeamId: 'patrons',
        },
        eventRollTotals: {
          eventChanceTotal: 100,
          eventTriggerRollTotal: 1,
          eventPercentileTotal: 52,
          rollTwiceFirstTotal: 94,
          rollTwiceSecondTotal: 30,
        },
        lockVersion: 1,
      },
      teamRows: [{ _id: 'team-1', militiaId: 'm1', teamId: 'patrons' }],
      teamStates: [
        {
          _id: 'team-state-1',
          militiaId: 'm1',
          teamId: 'patrons',
          status: 'active',
        },
      ],
    });

    await commitCurrentPhase.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1' as never,
    });

    expect(db.getRows('militiaTeamState')[0]).toEqual(
      expect.objectContaining({
        teamId: 'patrons',
        status: 'active',
      }),
    );
    expect(db.getRows('militiaWeekState')[0]?.queuedEffects).not.toContainEqual(
      expect.objectContaining({
        kind: 'team_check_modifier',
        teamId: 'patrons',
      }),
    );
  });

  describe('effective activity check modifier matrix', () => {
    it.each([
      {
        name: 'Hidden Agenda applies +2 to Secrecy checks for Activate Black Market',
        weekState: {
          stagedActivityActionIds: ['activate_black_market'],
          stagedActivityTeamIds: ['blackMarketeers'],
          activityRollTotals: { activateBlackMarketCheckTotal: 18 },
          eventRollTotals: {
            eventChanceTotal: 100,
            eventTriggerRollTotal: 1,
            eventPercentileTotal: 44,
          },
        },
        setup: {
          militiaOverrides: { treasury: 500 },
          teamRows: [
            { _id: 'team-1', militiaId: 'm1', teamId: 'blackMarketeers' },
          ],
          teamStates: [
            {
              _id: 'team-state-1',
              militiaId: 'm1',
              teamId: 'blackMarketeers',
              status: 'active',
            },
          ],
        },
        assert: (db: FakeDb) => {
          expect(db.getRows('militiaMarketplace')).toHaveLength(1);
        },
      },
      {
        name: 'Found Fire queued modifier applies +2 to Security checks for Reduce Danger',
        weekState: {
          stagedActivityActionIds: ['reduce_danger'],
          queuedEffects: [
            {
              kind: 'organization_check_modifier',
              appliesWeek: 4,
              checkType: 'security',
              modifierTotal: 2,
              sourceEventType: 'found_fire',
            },
          ],
          activityAssetOperations: {
            reduceDangerTargets: [{ slotIndex: 0, settlementKey: 'Longshadow' }],
          },
          activityRollTotals: { reduceDangerCheckTotal: 13 },
        },
        setup: {
          settlementStates: [
            {
              _id: 'settlement-1',
              militiaId: 'm1',
              settlementKey: 'Longshadow',
              reputation: 'Hostile',
              isSecured: true,
            },
          ],
        },
        assert: (db: FakeDb) => {
          expect(db.getRows('militiaSettlementState')[0]).toEqual(
            expect.objectContaining({ temporaryShift: 1 }),
          );
        },
      },
      {
        name: 'High Morale queued modifier applies +2 to Loyalty checks for Spread Propaganda',
        weekState: {
          stagedActivityActionIds: ['spread_propaganda'],
          queuedEffects: [
            {
              kind: 'organization_check_modifier',
              appliesWeek: 4,
              checkType: 'loyalty',
              modifierTotal: 2,
              sourceEventType: 'high_morale',
            },
          ],
          activityAssetOperations: {
            spreadPropagandaTargets: [
              { slotIndex: 0, settlementKey: 'Longshadow' },
            ],
          },
          activityRollTotals: { spreadPropagandaCheckTotal: 18 },
        },
        setup: {
          militiaOverrides: { treasury: 500 },
          settlementStates: [
            {
              _id: 'settlement-1',
              militiaId: 'm1',
              settlementKey: 'Longshadow',
              reputation: 'Indifferent',
              isSecured: true,
            },
          ],
        },
        assert: (db: FakeDb) => {
          expect(db.getRows('militiaSettlementState')[0]).toEqual(
            expect.objectContaining({ reputation: 'Friendly' }),
          );
        },
      },
      {
        name: 'Turn Around team modifier applies +2 only to the assigned team action',
        weekState: {
          stagedActivityActionIds: ['spread_propaganda'],
          stagedActivityTeamIds: ['propagandists'],
          queuedEffects: [
            {
              kind: 'team_check_modifier',
              appliesWeek: 4,
              teamId: 'propagandists',
              modifierTotal: 2,
              sourceEventType: 'turn_around',
            },
          ],
          activityAssetOperations: {
            spreadPropagandaTargets: [
              { slotIndex: 0, settlementKey: 'Longshadow' },
            ],
          },
          activityRollTotals: { spreadPropagandaCheckTotal: 18 },
        },
        setup: {
          militiaOverrides: { treasury: 500 },
          settlementStates: [
            {
              _id: 'settlement-1',
              militiaId: 'm1',
              settlementKey: 'Longshadow',
              reputation: 'Indifferent',
              isSecured: true,
            },
          ],
          teamRows: [
            { _id: 'team-1', militiaId: 'm1', teamId: 'propagandists' },
          ],
          teamStates: [
            {
              _id: 'team-state-1',
              militiaId: 'm1',
              teamId: 'propagandists',
              status: 'active',
            },
          ],
        },
        assert: (db: FakeDb) => {
          expect(db.getRows('militiaSettlementState')[0]).toEqual(
            expect.objectContaining({ reputation: 'Friendly' }),
          );
        },
      },
      {
        name: 'Week of Serenity applies +5 to all organization checks',
        weekState: {
          stagedActivityActionIds: ['dismiss_team'],
          queuedEffects: [
            { kind: 'week_of_serenity_checks_bonus', appliesWeek: 4 },
          ],
          activityTeamOperations: {
            dismissals: [{ slotIndex: 0, teamId: 'patrons' }],
          },
          activityRollTotals: { dismissTeamCheckTotal: 5 },
        },
        setup: {
          teamRows: [{ _id: 'team-1', militiaId: 'm1', teamId: 'patrons' }],
          teamStates: [
            {
              _id: 'team-state-1',
              militiaId: 'm1',
              teamId: 'patrons',
              status: 'active',
            },
          ],
        },
        assert: (db: FakeDb) => {
          expect(db.getRows('militiaTeam')).toHaveLength(0);
        },
      },
      {
        name: 'Week of Pain applies -1 to all organization checks',
        weekState: {
          stagedActivityActionIds: ['secure_cache'],
          queuedEffects: [{ kind: 'week_of_pain_checks_penalty', appliesWeek: 4 }],
          activityAssetOperations: {
            caches: [
              {
                slotIndex: 0,
                mode: 'place',
                label: 'Border stash',
                cacheClass: 'minor',
                location: 'Windmill',
                contentsSummary: 'Rations',
                checkTotal: 15,
              },
            ],
          },
        },
        setup: {},
        assert: (db: FakeDb) => {
          expect(db.getRows('militiaCache')[0]).toEqual(
            expect.objectContaining({ status: 'pending_return' }),
          );
        },
      },
      {
        name: 'Double Agent persistent penalty applies -2 to Secrecy recruitment',
        weekState: {
          stagedActivityActionIds: ['recruit_team'],
          activityTeamOperations: {
            recruits: [{ slotIndex: 0, teamId: 'moles' }],
          },
          activityRollTotals: { recruitTeamCheckTotal: 15 },
        },
        setup: {
          eventStates: [
            {
              _id: 'event-1',
              militiaId: 'm1',
              weekNumber: 3,
              eventType: 'double_agent',
              isPersistent: true,
              startedWeek: 3,
              resolved: false,
            },
          ],
        },
        assert: (db: FakeDb) => {
          expect(
            db.getRows('militiaTeam').some((team) => team.teamId === 'moles'),
          ).toBe(false);
        },
      },
      {
        name: 'Low Morale persistent penalty applies -2 to Loyalty checks',
        weekState: {
          stagedActivityActionIds: ['spread_propaganda'],
          activityAssetOperations: {
            spreadPropagandaTargets: [
              { slotIndex: 0, settlementKey: 'Longshadow' },
            ],
          },
          activityRollTotals: { spreadPropagandaCheckTotal: 20 },
        },
        setup: {
          militiaOverrides: { treasury: 500 },
          settlementStates: [
            {
              _id: 'settlement-1',
              militiaId: 'm1',
              settlementKey: 'Longshadow',
              reputation: 'Indifferent',
              isSecured: true,
            },
          ],
          eventStates: [
            {
              _id: 'event-1',
              militiaId: 'm1',
              weekNumber: 3,
              eventType: 'low_morale',
              isPersistent: true,
              startedWeek: 3,
              resolved: false,
            },
          ],
        },
        assert: (db: FakeDb) => {
          expect(db.getRows('militiaSettlementState')[0]).toEqual(
            expect.objectContaining({ reputation: 'Indifferent' }),
          );
        },
      },
      {
        name: 'team modifier does not apply to a different assigned team',
        weekState: {
          stagedActivityActionIds: ['spread_propaganda'],
          stagedActivityTeamIds: ['spies'],
          queuedEffects: [
            {
              kind: 'team_check_modifier',
              appliesWeek: 4,
              teamId: 'propagandists',
              modifierTotal: 2,
              sourceEventType: 'turn_around',
            },
          ],
          activityAssetOperations: {
            spreadPropagandaTargets: [
              { slotIndex: 0, settlementKey: 'Longshadow' },
            ],
          },
          activityRollTotals: { spreadPropagandaCheckTotal: 18 },
        },
        setup: {
          militiaOverrides: { treasury: 500 },
          settlementStates: [
            {
              _id: 'settlement-1',
              militiaId: 'm1',
              settlementKey: 'Longshadow',
              reputation: 'Indifferent',
              isSecured: true,
            },
          ],
          teamRows: [{ _id: 'team-1', militiaId: 'm1', teamId: 'spies' }],
          teamStates: [
            {
              _id: 'team-state-1',
              militiaId: 'm1',
              teamId: 'spies',
              status: 'active',
            },
          ],
        },
        assert: (db: FakeDb) => {
          expect(db.getRows('militiaSettlementState')[0]).toEqual(
            expect.objectContaining({ reputation: 'Indifferent' }),
          );
        },
      },
    ])('$name', async ({ weekState, setup, assert }) => {
      const {
        activityTeamOperations,
        activityAssetOperations,
        activityRollTotals,
        ...baseWeekState
      } = weekState;
      const mergedWeekState: Row = {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 4,
        phase: 'week_closed',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        upkeepRollTotals: { attritionTotal: 0 },
        eventRollTotals: {
          eventChanceTotal: 10,
          eventTriggerRollTotal: 99,
        },
        lockVersion: 1,
        ...baseWeekState,
      };
      mergedWeekState.activityTeamOperations = {
        recruits: [],
        dismissals: [],
        upgrades: [],
        ...activityTeamOperations,
      };
      mergedWeekState.activityAssetOperations = {
        refuges: [],
        reduceDangerTargets: [],
        spreadPropagandaTargets: [],
        strikeTeams: [],
        caches: [],
        orders: [],
        marketplaces: [],
        covertActions: [],
        rescues: [],
        restorations: [],
        ...activityAssetOperations,
      };
      mergedWeekState.activityRollTotals = {
        ...activityRollTotals,
      };

      const { ctx, db } = createBaseHarness({
        weekState: mergedWeekState,
        eventStates: setup.eventStates,
        militiaOverrides: setup.militiaOverrides,
        settlementStates: setup.settlementStates,
        teamRows: setup.teamRows,
        teamStates: setup.teamStates,
      });

      await commitCurrentPhase.handler(ctx, {
        organizationId: 'org1',
        militiaId: 'm1' as never,
      });

      assert(db);
    });
  });

  it('returns live state from the split week-board query', async () => {
    const { ctx } = createBaseHarness({
      weekState: {
        _id: 'ws1',
        militiaId: 'm1',
        weekNumber: 6,
        phase: 'activity',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 2,
        stagedActivityActionIds: ['change_officer_role', 'earn_gold'],
        stagedActivityTeamIds: [null, 'merchants'],
        activityTeamOperations: {
          recruits: [],
          dismissals: [],
          upgrades: [],
        },
        activityOfficerOperations: {
          changes: [
            {
              slotIndex: 0,
              role: 'strategist',
              characterId: 'char2',
            },
          ],
        },
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          marketplaces: [],
          covertActions: [],
          rescues: [],
          restorations: [],
        },
        upkeepTeamOperations: {
          disabledRecoveries: [],
          missingChecks: [],
        },
        eventMitigations: {},
        weekWarnings: [],
        upkeepRollTotals: {},
        activityRollTotals: {},
        eventRollTotals: {},
        lockVersion: 1,
      },
      militiaOverrides: {
        strategist: undefined,
      },
    });

    const result = (await getWeekBoardLiveState.handler(ctx, {
      campaignId: 'c1',
      organizationId: 'org1',
    })) as Record<string, unknown>;

    expect(result.maxActions).toBe(3);
    expect(result.persistentBuyoff).toEqual({
      cost: 40,
      weeksRemaining: 0,
      canBuyoffNow: true,
    });
    expect((result.state as Record<string, unknown>).stagedActivityActionIds).toEqual([
      'change_officer_role',
      'earn_gold',
    ]);
    expect((result.state as Record<string, unknown>).stagedActivityTeamIds).toEqual([
      null,
      'merchants',
    ]);
  });
});
