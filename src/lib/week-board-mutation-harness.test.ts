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
    return {
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
        const rows =
          this.tables[table]?.filter((row: Row) =>
            conditions.every((condition) => row[condition.field] === condition.value),
          ) ?? [];
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

  getRows(table: string) {
    return this.tables[table] ?? [];
  }
}

function createBaseHarness({
  weekState,
  eventStates = [],
}: {
  weekState: Row;
  eventStates?: Row[];
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
      },
    ],
    character: [],
    militiaWeekState: [weekState],
    militiaEventState: eventStates,
    militiaSettlementState: [],
  });

  return {
    ctx: { db } as unknown as { db: FakeDb },
    db,
  };
}

let commitCurrentPhase: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let saveWeekBoardState: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };

beforeAll(async () => {
  const module = await import('../../convex/weekBoard');
  commitCurrentPhase = module.commitCurrentPhase as never;
  saveWeekBoardState = module.saveWeekBoardState as never;
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
});

describe('weekBoard saveWeekBoardState collaboration harness', () => {
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
});
