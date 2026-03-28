import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import { OrderStateFormCard, TrackedPersonFormCard } from './form-cards';
import {
  defaultOrderStateFormValues,
  defaultTrackedPersonFormValues,
  type OrderStateFormValues,
  type TrackedPersonFormValues,
} from './types';

function OrderStateFormHarness() {
  const form = useForm<OrderStateFormValues>({
    defaultValues: defaultOrderStateFormValues,
  });

  return (
    <OrderStateFormCard
      form={form}
      onSubmit={vi.fn(async () => undefined)}
      onCancel={vi.fn()}
      marketplaceOptions={[{ value: 'market_1', label: 'Tamran Market' }]}
    />
  );
}

function TrackedPersonFormHarness({
  defaultValues,
}: {
  defaultValues?: Partial<TrackedPersonFormValues>;
}) {
  const form = useForm<TrackedPersonFormValues>({
    defaultValues: {
      ...defaultTrackedPersonFormValues,
      ...defaultValues,
    },
  });

  return (
    <TrackedPersonFormCard
      form={form}
      onSubmit={vi.fn(async () => undefined)}
      onCancel={vi.fn()}
      characterOptions={[
        { _id: 'char_1' as never, name: 'Kara', kind: 'pc', level: 5, charisma: 14 },
      ]}
      settlementOptions={['Brellin']}
    />
  );
}

describe('OrderStateFormCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders linked marketplace select when the none option uses an empty form value', () => {
    render(<OrderStateFormHarness />);

    expect(screen.getByText('Linked marketplace')).toBeInTheDocument();
    expect(screen.getAllByText('None').length).toBeGreaterThan(0);
    expect(screen.getByText('Tamran Market')).toBeInTheDocument();
  });

  it('uses refuge-specific settlement wording for tracked people in refuges', () => {
    render(
      <TrackedPersonFormHarness
        defaultValues={{ locationType: 'refuge' }}
      />,
    );

    expect(
      screen.getByText('Settlement containing the refuge'),
    ).toBeInTheDocument();
  });

  it('removes the tracked person name field when using the character ledger source', () => {
    render(
      <TrackedPersonFormHarness
        defaultValues={{ targetSource: 'character', characterId: 'char_1' }}
      />,
    );

    expect(screen.queryByText('Tracked person name')).not.toBeInTheDocument();
    expect(screen.getByText('Character')).toBeInTheDocument();
    expect(screen.getByText('Person type')).toBeInTheDocument();
  });
});
