import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterManager } from './character-manager';

const mockCharacterLedgerQuery = vi.fn();
const mockMilitiaQuery = vi.fn();
const mockUseMutation = vi.fn();

const mutationFns = {
  createCharacter: vi.fn(),
  updateCharacter: vi.fn(),
  archiveCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  assignOfficerRole: vi.fn(),
};

vi.mock('~/lib/sharedQueries', () => ({
  characterLedgerQuery: (...args: unknown[]) =>
    mockCharacterLedgerQuery(...args),
  militiaQuery: (...args: unknown[]) => mockMilitiaQuery(...args),
}));

vi.mock('convex/react', () => ({
  useMutation: (ref: unknown) => mockUseMutation(ref),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    character: {
      createCharacter: 'character.createCharacter',
      updateCharacter: 'character.updateCharacter',
      archiveCharacter: 'character.archiveCharacter',
      deleteCharacter: 'character.deleteCharacter',
    },
    militia: {
      assignOfficerRole: 'militia.assignOfficerRole',
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
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

describe('CharacterManager', () => {
  function openLedger() {
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  }

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockCharacterLedgerQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockMilitiaQuery.mockReturnValue({
      data: {
        _id: 'militia_1',
        ambassador: undefined,
        commandant: undefined,
        marshal: undefined,
        overseer: undefined,
        spymaster: undefined,
        strategist: undefined,
      },
    });

    mockUseMutation.mockImplementation((ref: unknown) => {
      if (ref === 'character.createCharacter')
        return mutationFns.createCharacter;
      if (ref === 'character.updateCharacter')
        return mutationFns.updateCharacter;
      if (ref === 'character.archiveCharacter')
        return mutationFns.archiveCharacter;
      if (ref === 'character.deleteCharacter')
        return mutationFns.deleteCharacter;
      if (ref === 'militia.assignOfficerRole')
        return mutationFns.assignOfficerRole;
      return vi.fn();
    });

    mutationFns.assignOfficerRole.mockResolvedValue({ warnings: [] });
    mutationFns.createCharacter.mockResolvedValue(undefined);
    mutationFns.updateCharacter.mockResolvedValue(undefined);
    mutationFns.archiveCharacter.mockResolvedValue(undefined);
    mutationFns.deleteCharacter.mockResolvedValue(undefined);
  });

  it('shows zod/rhf validation when saving with empty name', async () => {
    render(
      <CharacterManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByText('Add Character'));
    fireEvent.click(screen.getByText('Save'));

    expect(
      await screen.findByText('Character name is required'),
    ).toBeInTheDocument();
    expect(mutationFns.createCharacter).not.toHaveBeenCalled();
  });

  it('differentiates empty numeric value from incorrect numeric type', async () => {
    render(
      <CharacterManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByText('Add Character'));

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs.find(
      (input) => input.getAttribute('name') === 'name',
    );
    const dexInput = inputs.find(
      (input) => input.getAttribute('name') === 'dexterity',
    );

    fireEvent.change(nameInput!, { target: { value: 'Valeria' } });
    fireEvent.change(dexInput!, { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('DEX is required')).toBeInTheDocument();

    fireEvent.change(dexInput!, { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('Save'));
    expect(
      await screen.findByText('DEX must be a whole number'),
    ).toBeInTheDocument();
  });

  it('accepts valid numeric stat fields on submit', async () => {
    render(
      <CharacterManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByText('Add Character'));

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs.find(
      (input) => input.getAttribute('name') === 'name',
    );
    const levelInput = inputs.find(
      (input) => input.getAttribute('name') === 'level',
    );
    const dexInput = inputs.find(
      (input) => input.getAttribute('name') === 'dexterity',
    );

    fireEvent.change(nameInput!, { target: { value: 'Valeria' } });
    fireEvent.change(levelInput!, { target: { value: '4' } });
    fireEvent.change(dexInput!, { target: { value: '14' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mutationFns.createCharacter).toHaveBeenCalled();
    });
    expect(
      screen.queryByText('DEX must be a whole number'),
    ).not.toBeInTheDocument();
  });
  describe('mixed-format character kinds', () => {
    function record(id: string, name: string, kind?: string) {
      return {
        _id: id,
        name,
        description: 'Keep notes',
        ...(kind ? { kind } : {}),
        level: 3,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 12,
        isActive: true,
      };
    }
    beforeEach(() => {
      mockCharacterLedgerQuery.mockReturnValue({
        data: [
          record('absent', 'Aubrin'),
          record('pc', 'Mara', 'pc'),
          record('officer', 'Ostler', 'officer_npc'),
          record('npc', 'Vessa', 'npc'),
        ],
        isLoading: false,
      });
    });
    function renderLedger() {
      render(
        <CharacterManager
          selectedCampaignId={'camp_1' as never}
          organizationId="org_1"
          canQuery
        />,
      );
      openLedger();
    }
    function row(name: string) {
      return screen.getByText(name).closest('tr')!;
    }
    function edit(name: string) {
      const button = [...row(name).querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Edit',
      )!;
      fireEvent.click(button);
    }
    function kindOptions() {
      return [
        ...screen.getByTestId('mock-select').querySelectorAll('option'),
      ].map((option) => option.value);
    }

    it('labels legacy, absent and new kinds', () => {
      renderLedger();
      expect(row('Aubrin')).toHaveTextContent('PC');
      expect(row('Mara')).toHaveTextContent('PC');
      expect(row('Ostler')).toHaveTextContent('Officer NPC');
      expect(row('Vessa')).toHaveTextContent('NPC');
      expect(row('Vessa')).not.toHaveTextContent('Officer NPC');
    });

    it('keeps a stored npc kind when an unrelated field is edited', async () => {
      renderLedger();
      edit('Vessa');
      expect(screen.getByTestId('mock-select')).toHaveValue('npc');
      expect(kindOptions()).toEqual(['pc', 'officer_npc', 'npc']);
      const select = screen.getByTestId('mock-select');
      fireEvent.change(select, { target: { value: 'pc' } });
      expect(kindOptions()).toEqual(['pc', 'officer_npc', 'npc']);
      fireEvent.change(select, { target: { value: 'npc' } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() =>
        expect(mutationFns.updateCharacter).toHaveBeenCalledWith({
          organizationId: 'org_1',
          characterId: 'npc',
          patch: expect.objectContaining({
            kind: 'npc',
            description: 'Keep notes',
          }),
        }),
      );
    });

    it('still writes only legacy kinds from new and legacy records', async () => {
      renderLedger();
      edit('Ostler');
      expect(screen.getByTestId('mock-select')).toHaveValue('officer_npc');
      expect(kindOptions()).toEqual(['pc', 'officer_npc']);
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() =>
        expect(mutationFns.updateCharacter).toHaveBeenCalledWith(
          expect.objectContaining({
            patch: expect.objectContaining({ kind: 'officer_npc' }),
          }),
        ),
      );
      fireEvent.click(screen.getByText('Add Character'));
      expect(screen.getByTestId('mock-select')).toHaveValue('pc');
      expect(kindOptions()).toEqual(['pc', 'officer_npc']);
    });
  });

  it('restores archived characters without offering destructive deletion', async () => {
    mockCharacterLedgerQuery.mockReturnValue({
      data: [
        {
          _id: 'arch_1',
          name: 'Old Scout',
          description: '',
          kind: 'officer_npc',
          level: 2,
          strength: 10,
          dexterity: 12,
          constitution: 10,
          intelligence: 9,
          wisdom: 11,
          charisma: 8,
          isActive: false,
        },
      ],
      isLoading: false,
    });

    render(
      <CharacterManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByText('Show Archived'));
    expect(screen.getByText('Old Scout (Level 2)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Un-archive'));
    expect(mutationFns.archiveCharacter).toHaveBeenCalledWith({
      organizationId: 'org_1',
      characterId: 'arch_1',
      isActive: true,
    });

    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
  });
});
