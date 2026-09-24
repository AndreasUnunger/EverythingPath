import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
  query: (config: unknown) => config,
}));

const mockHasAccessToOrg = vi.fn();

vi.mock('../../convex/user', () => ({
  hasAccessToOrg: (...args: unknown[]) => mockHasAccessToOrg(...args),
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
          async unique() {
            if (rows.length > 1) throw new Error('Query returned more than one row.');
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

function createHarness({
  campaigns = [{ _id: 'c1', organizationId: 'org1' }],
  militiaRows = [{ _id: 'm1', campaignId: 'c1' }],
  teamRows = [{ _id: 't1', militiaId: 'm1', teamId: 'moles' }],
  teamStates = [],
  characters = [],
  overrideNotes = [],
}: {
  campaigns?: Row[];
  militiaRows?: Row[];
  teamRows?: Row[];
  teamStates?: Row[];
  characters?: Row[];
  overrideNotes?: Row[];
} = {}) {
  const db = new FakeDb({
    campaign: campaigns,
    militia: militiaRows,
    militiaTeam: teamRows,
    militiaTeamState: teamStates,
    character: characters,
    militiaOverrideNote: overrideNotes,
  });

  return {
    ctx: { db } as unknown as { db: FakeDb },
    db,
  };
}

let getMilitia: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };
let assignTeamManager: { handler: (ctx: unknown, args: unknown) => Promise<unknown> };

beforeAll(async () => {
  const module = await import('../../convex/militia');
  getMilitia = module.getMilitia as never;
  assignTeamManager = module.assignTeamManager as never;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockHasAccessToOrg.mockResolvedValue({
    user: {
      tokenIdentifier: 'user_1',
    },
  });
});

describe('militia team manager harness', () => {
  it('returns manager-enriched militia teams from the query', async () => {
    const { ctx } = createHarness({
      teamRows: [
        {
          _id: 't1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'character',
          managerCharacterId: 'char_1',
        },
        {
          _id: 't2',
          militiaId: 'm1',
          teamId: 'informants',
          managerSource: 'character',
          managerCharacterId: 'char_1',
        },
      ],
      teamStates: [
        {
          _id: 'ts1',
          militiaId: 'm1',
          teamId: 'moles',
          status: 'disabled',
          unavailableUntilWeek: 5,
          notes: 'Recovering',
        },
      ],
      characters: [
        {
          _id: 'char_1',
          campaignId: 'c1',
          name: 'Aubrin',
          kind: 'pc',
          charisma: 10,
          isActive: true,
        },
      ],
    });

    const result = (await getMilitia.handler(ctx, {
      campaignId: 'c1',
      organizationId: 'org1',
    })) as {
      teams: Array<{
        id: string;
        status?: string;
        unavailableUntilWeek?: number;
        notes?: string;
        manager?: { displayName: string; managedTeamCount: number; warnings: string[] };
        managerSource?: string;
        managerCharacterId?: string;
      }>;
    } | null;

    const moles = result?.teams.find((team) => team.id === 'moles');
    expect(moles).toEqual(
      expect.objectContaining({
        status: 'disabled',
        unavailableUntilWeek: 5,
        notes: 'Recovering',
        managerSource: 'character',
        managerCharacterId: 'char_1',
        manager: expect.objectContaining({
          displayName: 'Aubrin',
          managedTeamCount: 2,
          warnings: ['Managing 2 teams exceeds the normal limit of 1.'],
        }),
      }),
    );
  });

  it('returns null from getMilitia when access is denied', async () => {
    mockHasAccessToOrg.mockResolvedValueOnce(false);
    const { ctx } = createHarness();

    await expect(
      getMilitia.handler(ctx, {
        campaignId: 'c1',
        organizationId: 'org1',
      }),
    ).resolves.toBeNull();
  });

  it('assigns a character manager, returns warnings, and records override notes', async () => {
    const { ctx, db } = createHarness({
      teamRows: [
        {
          _id: 't1',
          militiaId: 'm1',
          teamId: 'moles',
        },
        {
          _id: 't2',
          militiaId: 'm1',
          teamId: 'informants',
          managerSource: 'character',
          managerCharacterId: 'char_1',
        },
      ],
      characters: [
        {
          _id: 'char_1',
          campaignId: 'c1',
          name: 'Aubrin',
          kind: 'pc',
          charisma: 10,
          isActive: true,
        },
      ],
    });

    const result = (await assignTeamManager.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      teamId: 'moles',
      managerSource: 'character',
      managerCharacterId: 'char_1',
    })) as {
      warnings: Array<{ code: string; message: string }>;
      manager: { displayName: string; managedTeamCount: number };
    };

    expect(result.manager).toEqual(
      expect.objectContaining({
        displayName: 'Aubrin',
        managedTeamCount: 2,
      }),
    );
    expect(result.warnings).toEqual([
      {
        code: 'team_manager_warning',
        message: 'Managing 2 teams exceeds the normal limit of 1.',
      },
    ]);
    expect(db.patches).toContainEqual({
      table: 'militiaTeam',
      id: 't1',
      patch: {
        managerSource: 'character',
        managerCharacterId: 'char_1',
        managerName: undefined,
        managerKind: undefined,
        managerCharisma: undefined,
      },
    });
    expect(db.getRows('militiaOverrideNote')).toContainEqual(
      expect.objectContaining({
        militiaId: 'm1',
        fieldPath: 'team.moles.manager',
        warningCode: 'team_manager_warning',
        actorUserId: 'user_1',
      }),
    );
  });

  it('assigns a trimmed freeform manager and records an explicit reason note', async () => {
    const { ctx, db } = createHarness();

    const result = (await assignTeamManager.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      teamId: 'moles',
      managerSource: 'freeform',
      managerName: '  Quartermaster  ',
      managerKind: 'other_npc',
      managerCharisma: 14,
      reason: 'Legacy campaign setup',
    })) as {
      warnings: Array<{ code: string; message: string }>;
      manager: { displayName: string; charismaBonus: number };
    };

    expect(result.warnings).toEqual([]);
    expect(result.manager).toEqual(
      expect.objectContaining({
        displayName: 'Quartermaster',
        charismaBonus: 2,
      }),
    );
    expect(db.patches).toContainEqual({
      table: 'militiaTeam',
      id: 't1',
      patch: {
        managerSource: 'freeform',
        managerCharacterId: undefined,
        managerName: 'Quartermaster',
        managerKind: 'other_npc',
        managerCharisma: 14,
      },
    });
    expect(db.getRows('militiaOverrideNote')).toContainEqual(
      expect.objectContaining({
        militiaId: 'm1',
        fieldPath: 'team.moles.manager',
        warningCode: 'team_manager_override_reason',
        reason: 'Legacy campaign setup',
        actorUserId: 'user_1',
      }),
    );
  });

  it('clears a manager assignment', async () => {
    const { ctx, db } = createHarness({
      teamRows: [
        {
          _id: 't1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'freeform',
          managerName: 'Quartermaster',
          managerKind: 'other_npc',
          managerCharisma: 14,
        },
      ],
    });

    const result = (await assignTeamManager.handler(ctx, {
      organizationId: 'org1',
      militiaId: 'm1',
      teamId: 'moles',
    })) as { warnings: Array<unknown>; manager: unknown };

    expect(result).toEqual({
      warnings: [],
      manager: null,
    });
    expect(db.patches).toContainEqual({
      table: 'militiaTeam',
      id: 't1',
      patch: {
        managerSource: undefined,
        managerCharacterId: undefined,
        managerName: undefined,
        managerKind: undefined,
        managerCharisma: undefined,
      },
    });
  });

  it('rejects all invalid manager assignment branches', async () => {
    const baseCharacters = [
      {
        _id: 'char_1',
        campaignId: 'c1',
        name: 'Aubrin',
        kind: 'pc',
        charisma: 12,
        isActive: true,
      },
      {
        _id: 'char_2',
        campaignId: 'c2',
        name: 'Outsider',
        kind: 'pc',
        charisma: 12,
        isActive: true,
      },
      {
        _id: 'char_3',
        campaignId: 'c1',
        name: 'Archived',
        kind: 'pc',
        charisma: 12,
        isActive: false,
      },
    ];

    const cases = [
      {
        name: 'no organization access',
        harness: () => {
          mockHasAccessToOrg.mockResolvedValueOnce(false);
          return createHarness({ characters: baseCharacters });
        },
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
        },
        message: 'You do not have access to this org',
      },
      {
        name: 'missing militia',
        harness: () => createHarness({ militiaRows: [], characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
        },
        message: 'Militia not found',
      },
      {
        name: 'campaign organization mismatch',
        harness: () =>
          createHarness({
            campaigns: [{ _id: 'c1', organizationId: 'other-org' }],
            characters: baseCharacters,
          }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
        },
        message: 'No campaign exists for this organization',
      },
      {
        name: 'team missing from militia roster',
        harness: () => createHarness({ teamRows: [], characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
        },
        message: 'Team not found in militia roster',
      },
      {
        name: 'character source without character id',
        harness: () => createHarness({ characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'character',
        },
        message: 'Manager character is required',
      },
      {
        name: 'character id not found',
        harness: () => createHarness({ characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'character',
          managerCharacterId: 'char_missing',
        },
        message: 'Character not found',
      },
      {
        name: 'character from wrong campaign',
        harness: () => createHarness({ characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'character',
          managerCharacterId: 'char_2',
        },
        message: 'Manager character must belong to the same campaign as the militia',
      },
      {
        name: 'archived character manager',
        harness: () => createHarness({ characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'character',
          managerCharacterId: 'char_3',
        },
        message: 'Cannot assign an archived character as team manager',
      },
      {
        name: 'freeform without name',
        harness: () => createHarness({ characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'freeform',
          managerKind: 'pc',
          managerCharisma: 12,
        },
        message: 'Manager name is required',
      },
      {
        name: 'freeform without kind',
        harness: () => createHarness({ characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'freeform',
          managerName: 'Quartermaster',
          managerCharisma: 12,
        },
        message: 'Manager type is required',
      },
      {
        name: 'freeform without charisma',
        harness: () => createHarness({ characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'freeform',
          managerName: 'Quartermaster',
          managerKind: 'pc',
        },
        message: 'Manager Charisma is required',
      },
      {
        name: 'freeform with non-finite charisma',
        harness: () => createHarness({ characters: baseCharacters }),
        args: {
          organizationId: 'org1',
          militiaId: 'm1',
          teamId: 'moles',
          managerSource: 'freeform',
          managerName: 'Quartermaster',
          managerKind: 'pc',
          managerCharisma: Number.NaN,
        },
        message: 'Manager Charisma is required',
      },
    ] as const;

    for (const testCase of cases) {
      const { ctx } = testCase.harness();
      await expect(assignTeamManager.handler(ctx, testCase.args)).rejects.toThrow(
        testCase.message,
      );
    }
  });
});
