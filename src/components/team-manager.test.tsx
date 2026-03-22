import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamManager } from './teamManager';

const mockCharacterLedgerQuery = vi.fn();
const mockMilitiaQuery = vi.fn();
const mockUseMutation = vi.fn();

const mutationFns = {
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

describe('TeamManager', () => {
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
      if (ref === 'militia.assignTeamManager') {
        return mutationFns.assignTeamManager;
      }
      return vi.fn();
    });

    mutationFns.assignTeamManager.mockResolvedValue({ warnings: [] });
  });

  it('shows zod/rhf validation when freeform manager name is empty', async () => {
    render(
      <TeamManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    fireEvent.click(screen.getByText('Edit Manager'));

    const selects = screen.getAllByTestId('mock-select');
    fireEvent.change(selects[0]!, { target: { value: 'freeform' } });
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Manager name is required')).toBeInTheDocument();
    expect(mutationFns.assignTeamManager).not.toHaveBeenCalled();
  });

  it('assigns a character ledger manager', async () => {
    render(
      <TeamManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    fireEvent.click(screen.getByText('Edit Manager'));

    const selects = screen.getAllByTestId('mock-select');
    fireEvent.change(selects[0]!, { target: { value: 'character' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('mock-select')).toHaveLength(2);
    });
    fireEvent.change(screen.getAllByTestId('mock-select')[1]!, {
      target: { value: 'char_1' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mutationFns.assignTeamManager).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        teamId: 'moles',
        managerSource: 'character',
        managerCharacterId: 'char_1',
        managerName: undefined,
        managerKind: undefined,
        managerCharisma: undefined,
      });
    });
  });

  it('surfaces advisory warnings returned from manager assignment', async () => {
    mutationFns.assignTeamManager.mockResolvedValueOnce({
      warnings: [
        {
          message: 'Managing 2 teams exceeds the normal limit of 1.',
        },
      ],
    });

    render(
      <TeamManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    fireEvent.click(screen.getByText('Edit Manager'));

    const selects = screen.getAllByTestId('mock-select');
    fireEvent.change(selects[0]!, { target: { value: 'character' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('mock-select')).toHaveLength(2);
    });
    fireEvent.change(screen.getAllByTestId('mock-select')[1]!, {
      target: { value: 'char_1' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(
      await screen.findByText('Managing 2 teams exceeds the normal limit of 1.'),
    ).toBeInTheDocument();
  });
});
