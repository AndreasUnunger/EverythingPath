import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamLedger } from './team-ledger';

const mockCharacterLedgerQuery = vi.fn();
const mockMilitiaQuery = vi.fn();
const mockUseMutation = vi.fn();

const mutationFns = {
  upsertMilitiaTeamState: vi.fn(),
  assignTeamManager: vi.fn(),
};

vi.mock('~/lib/sharedQueries', () => ({
  characterLedgerQuery: (...args: unknown[]) => mockCharacterLedgerQuery(...args),
  militiaQuery: (...args: unknown[]) => mockMilitiaQuery(...args),
}));

vi.mock('convex/react', () => ({
  useMutation: (ref: unknown) => mockUseMutation(ref),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    militia: {
      upsertMilitiaTeamState: 'militia.upsertMilitiaTeamState',
      assignTeamManager: 'militia.assignTeamManager',
    },
  },
}));

vi.mock('~/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

describe('TeamLedger', () => {
  function openLedger() {
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  }

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockMilitiaQuery.mockReturnValue({
      data: {
        _id: 'militia_1',
        teams: [
          {
            id: 'moles',
            name: 'Moles',
            type: 'Espionage',
            tier: 1,
            size: 3,
            grantedActions: ['secureCache'],
            status: 'active',
            unavailableUntilWeek: undefined,
            notes: undefined,
            managerSource: undefined,
            managerCharacterId: undefined,
            managerName: undefined,
            managerKind: undefined,
            managerCharisma: undefined,
            manager: undefined,
          },
        ],
      },
      isLoading: false,
    });
    mockCharacterLedgerQuery.mockReturnValue({
      data: [
        {
          _id: 'char_1',
          name: 'Aubrin',
          description: '',
          kind: 'pc',
          level: 4,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 16,
          isActive: true,
        },
      ],
      isLoading: false,
    });

    mockUseMutation.mockImplementation((ref: unknown) => {
      if (ref === 'militia.upsertMilitiaTeamState') {
        return mutationFns.upsertMilitiaTeamState;
      }
      if (ref === 'militia.assignTeamManager') {
        return mutationFns.assignTeamManager;
      }
      return vi.fn();
    });

    mutationFns.upsertMilitiaTeamState.mockResolvedValue(undefined);
    mutationFns.assignTeamManager.mockResolvedValue({ warnings: [] });
  });

  it('adds a team roster entry and manager in one form', async () => {
    render(
      <TeamLedger
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Team' })[0]!);
    const dialog = await screen.findByRole('dialog');
    const selects = within(dialog).getAllByTestId('mock-select');
    fireEvent.change(selects[0]!, { target: { value: 'spies' } });
    fireEvent.change(selects[1]!, { target: { value: 'missing' } });
    fireEvent.change(selects[2]!, { target: { value: 'character' } });
    fireEvent.change(within(dialog).getAllByTestId('mock-select')[3]!, {
      target: { value: 'char_1' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Unavailable until week' }), {
      target: { value: '8' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mutationFns.upsertMilitiaTeamState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        teamId: 'spies',
        inRoster: true,
        status: 'missing',
        unavailableUntilWeek: 8,
        notes: undefined,
      });
      expect(mutationFns.assignTeamManager).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        teamId: 'spies',
        managerSource: 'character',
        managerCharacterId: 'char_1',
        managerName: undefined,
        managerKind: undefined,
        managerCharisma: undefined,
      });
    });
  });

  it('shows zod/rhf validation when freeform manager name is empty', async () => {
    render(
      <TeamLedger
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByText('Edit'));
    const dialog = await screen.findByRole('dialog');
    const selects = within(dialog).getAllByTestId('mock-select');
    fireEvent.change(selects[2]!, { target: { value: 'freeform' } });
    fireEvent.click(within(dialog).getByText('Save'));

    expect(await within(dialog).findByText('Manager name is required')).toBeInTheDocument();
    expect(mutationFns.assignTeamManager).not.toHaveBeenCalled();
  });

  it('assigns a freeform manager with trimmed values', async () => {
    render(
      <TeamLedger
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByText('Edit'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getAllByTestId('mock-select')[2]!, {
      target: { value: 'freeform' },
    });
    const textInputs = within(dialog).getAllByRole('textbox');
    fireEvent.change(textInputs[1]!, { target: { value: '  Quartermaster  ' } });
    fireEvent.change(within(dialog).getAllByTestId('mock-select')[3]!, {
      target: { value: 'other_npc' },
    });
    fireEvent.change(textInputs[2]!, { target: { value: '14' } });
    fireEvent.click(within(dialog).getByText('Save'));

    await waitFor(() => {
      expect(mutationFns.assignTeamManager).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        teamId: 'moles',
        managerSource: 'freeform',
        managerCharacterId: undefined,
        managerName: 'Quartermaster',
        managerKind: 'other_npc',
        managerCharisma: 14,
      });
    });
  });

  it('removes a team from the roster', async () => {
    render(
      <TeamLedger
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mutationFns.upsertMilitiaTeamState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        teamId: 'moles',
        inRoster: false,
        status: 'active',
      });
    });
  });
});
