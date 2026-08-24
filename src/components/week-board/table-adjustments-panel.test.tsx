import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableAdjustmentsPanel } from '~/components/week-board/table-adjustments-panel';

describe('TableAdjustmentsPanel', () => {
  afterEach(cleanup);

  it('requires a numeric value and a reason', async () => {
    render(
      <TableAdjustmentsPanel
        adjustments={[]}
        settlementKeys={['Longshadow']}
        onChangeAction={vi.fn(async () => undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Adjustment' }));

    expect(await screen.findByText('Enter a numeric value.')).toBeInTheDocument();
    expect(
      screen.getByText('Enter the table reason for this change.'),
    ).toBeInTheDocument();
  });

  it('emits a typed adjustment', async () => {
    const onChangeAction = vi.fn(async () => undefined);
    render(
      <TableAdjustmentsPanel
        adjustments={[]}
        settlementKeys={['Longshadow']}
        onChangeAction={onChangeAction}
      />,
    );

    fireEvent.change(screen.getByLabelText('Numeric value'), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: 'Narrative reward' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Adjustment' }));

    await waitFor(() => {
      expect(onChangeAction).toHaveBeenCalledWith([
        {
          kind: 'militia_value',
          field: 'treasury',
          operation: 'add',
          value: 12,
          reason: 'Narrative reward',
        },
      ]);
    });
  });
});
