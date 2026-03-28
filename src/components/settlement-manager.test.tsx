import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettlementManager } from './settlement-manager';

const mockSettlementLedgerQuery = vi.fn();
const mockMilitiaQuery = vi.fn();
const mockUseMutation = vi.fn();

const mutationFns = {
  upsertSettlementState: vi.fn(),
  deleteSettlementState: vi.fn(),
};

vi.mock('~/lib/sharedQueries', () => ({
  settlementLedgerQuery: (...args: unknown[]) => mockSettlementLedgerQuery(...args),
  militiaQuery: (...args: unknown[]) => mockMilitiaQuery(...args),
}));

vi.mock('convex/react', () => ({
  useMutation: (ref: unknown) => mockUseMutation(ref),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    militia: {
      upsertSettlementState: 'militia.upsertSettlementState',
      deleteSettlementState: 'militia.deleteSettlementState',
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

describe('SettlementManager', () => {
  function openLedger() {
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  }

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockSettlementLedgerQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockMilitiaQuery.mockReturnValue({
      data: {
        _id: 'militia_1',
      },
    });

    mockUseMutation.mockImplementation((ref: unknown) => {
      if (ref === 'militia.upsertSettlementState') {
        return mutationFns.upsertSettlementState;
      }
      if (ref === 'militia.deleteSettlementState') {
        return mutationFns.deleteSettlementState;
      }

      return vi.fn();
    });

    mutationFns.upsertSettlementState.mockResolvedValue(undefined);
    mutationFns.deleteSettlementState.mockResolvedValue(undefined);
  });

  it('shows zod/rhf validation when saving with empty settlement name', async () => {
    render(
      <SettlementManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByText('Add Settlement'));
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Settlement name is required')).toBeInTheDocument();
    expect(mutationFns.upsertSettlementState).not.toHaveBeenCalled();
  });

  it('creates a settlement with trimmed name and selected fields', async () => {
    render(
      <SettlementManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByText('Add Settlement'));

    fireEvent.change(screen.getByRole('textbox', { name: 'Settlement name' }), {
      target: { value: ' Longshadow ' },
    });

    const selects = screen.getAllByTestId('mock-select');
    fireEvent.change(selects[0]!, { target: { value: 'Friendly' } });
    fireEvent.change(selects[1]!, { target: { value: 'secured' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mutationFns.upsertSettlementState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        settlementId: undefined,
        settlementKey: 'Longshadow',
        reputation: 'Friendly',
        isSecured: true,
      });
    });
  });

  it('loads existing settlement data for editing', async () => {
    mockSettlementLedgerQuery.mockReturnValue({
      data: [
        {
          _id: 'settlement_1',
          settlementKey: 'Longshadow',
          reputation: 'Indifferent',
          isSecured: false,
        },
      ],
      isLoading: false,
    });

    render(
      <SettlementManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByText('Edit'));

    const nameInput = screen.getByRole('textbox', { name: 'Settlement name' });
    expect(nameInput).toHaveValue('Longshadow');

    fireEvent.change(nameInput, { target: { value: 'Longshadow Keep' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mutationFns.upsertSettlementState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        settlementId: 'settlement_1',
        settlementKey: 'Longshadow Keep',
        reputation: 'Indifferent',
        isSecured: false,
      });
    });
  });

  it('deletes a settlement record', async () => {
    mockSettlementLedgerQuery.mockReturnValue({
      data: [
        {
          _id: 'settlement_1',
          settlementKey: 'Longshadow',
          reputation: 'Indifferent',
          isSecured: false,
        },
      ],
      isLoading: false,
    });

    render(
      <SettlementManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mutationFns.deleteSettlementState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        settlementId: 'settlement_1',
      });
    });
  });
});
