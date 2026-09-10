import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CanonicalCampaignContextEditor } from './canonical-campaign-context-editor';
import { emptyCampaignContext } from '~/lib/canonical-campaign-context';

afterEach(cleanup);

test('[context.form] ledger retains zero, blocks malformed money and saves advisory incomplete context', async () => {
  const save = vi.fn().mockResolvedValue(0);
  render(
    <CanonicalCampaignContextEditor
      context={emptyCampaignContext()}
      revision={null}
      onSave={save}
      characters={[]}
      teams={[]}
    />,
  );
  fireEvent.change(screen.getByLabelText('Treasury (copper)'), {
    target: { value: 'bad' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save campaign facts' }));
  await screen.findByText('Review the highlighted fields before saving.');
  expect(
    screen.getByText('Enter a number for Treasury (copper).'),
  ).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Treasury (copper)'), {
    target: { value: '0' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save campaign facts' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      { ...emptyCampaignContext(), treasuryCopper: 0 },
      null,
    ),
  );
  expect(
    screen.getByText('Complete the week-start facts before preparing a week.'),
  ).toBeVisible();
});

test('[context.ui-receipt] receipt needs an entered day and stays separate from due-day delivery', async () => {
  const save = vi.fn().mockResolvedValue(0);
  const context = {
    ...emptyCampaignContext(),
    items: [{ itemId: 'item', name: 'Sword', valueCopper: 1 }],
    orders: [
      {
        orderId: 'order',
        itemId: 'item',
        settlementId: null,
        orderedDay: 6,
        dueDay: 7,
        priceCopper: 1,
        receipt: null,
        receiptStatus: 'unreceived' as const,
        source: 'special_order' as const,
        orderedWeek: 1,
        dueActivityWeek: null,
        deliveryDays: 1,
        expedited: true,
        enchantment: null,
        notes: '',
      },
    ],
  };
  render(
    <CanonicalCampaignContextEditor
      context={context}
      revision={null}
      onSave={save}
      characters={[]}
      teams={[]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'received' }));
  expect(screen.getByLabelText('Received day')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Save campaign facts' }));
  await screen.findByText('Review the highlighted fields before saving.');
  expect(screen.getByText('Received day is required')).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Received day'), {
    target: { value: 'abc' },
  });
  await screen.findByText('Enter a number for Received day.');
  fireEvent.change(screen.getByLabelText('Received day'), {
    target: { value: '' },
  });
  await screen.findByText('Received day is required');
  fireEvent.change(screen.getByLabelText('Received day'), {
    target: { value: '8' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save campaign facts' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    orders: [
      {
        dueDay: 7,
        priceCopper: 1,
        receiptStatus: 'received',
        receipt: { receivedDay: 8 },
      },
    ],
  });
  fireEvent.click(screen.getByRole('button', { name: 'unreceived' }));
  expect(screen.queryByLabelText('Received day')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save campaign facts' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]?.[0]).toMatchObject({
    orders: [{ receiptStatus: 'unreceived', receipt: null }],
  });
});

test('[context.ui-decimal] enchantment duration retains a decimal point during typing', async () => {
  const save = vi.fn().mockResolvedValue(0);
  const context = {
    ...emptyCampaignContext(),
    items: [{ itemId: 'item', name: 'Sword', valueCopper: 1 }],
    orders: [
      {
        orderId: 'order',
        itemId: 'item',
        settlementId: null,
        orderedDay: 0,
        dueDay: 1,
        priceCopper: 1,
        receipt: null,
        receiptStatus: 'unreceived' as const,
        source: 'special_order' as const,
        orderedWeek: 1,
        dueActivityWeek: null,
        deliveryDays: 1,
        expedited: true,
        enchantment: { costCopper: 50000, days: 0 },
        notes: '',
      },
    ],
  };
  render(
    <CanonicalCampaignContextEditor
      context={context}
      revision={null}
      onSave={save}
      characters={[]}
      teams={[]}
    />,
  );
  const input = screen.getByLabelText('Enchantment duration (days)');
  fireEvent.change(input, { target: { value: '0.' } });
  expect(input).toHaveValue('0.');
  fireEvent.change(input, { target: { value: '0.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save campaign facts' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    orders: [{ enchantment: { days: 0.5 } }],
  });
});

test('[context.ui-targets] removing a referenced item shows the error beside its event targets', async () => {
  const save = vi.fn().mockResolvedValue(0);
  const context = {
    ...emptyCampaignContext(),
    items: [{ itemId: 'item', name: 'Sword', valueCopper: 1 }],
    events: [
      {
        eventId: 'event',
        eventType: 'sickness' as const,
        startedWeek: 0,
        order: 0,
        targets: [{ kind: 'item' as const, itemId: 'item' }],
        persistent: true,
        resolved: false,
        mitigationUntilWeek: null,
        endedWeek: null,
        notes: '',
      },
    ],
  };
  render(
    <CanonicalCampaignContextEditor
      context={context}
      revision={null}
      onSave={save}
      characters={[]}
      teams={[]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove Item 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save campaign facts' }));
  const event = screen.getByRole('group', { name: 'Event 1' });
  await waitFor(() =>
    expect(event).toHaveTextContent('Choose a target in this militia'),
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'No targets' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save campaign facts' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
});

test.each(['typing', 'adding', 'selection', 'custom selection'])(
  '[context.ui-save-status] unsaved %s clears the success message',
  async (edit) => {
    const context = emptyCampaignContext();
    context.queuedEffects = [
      {
        effectId: 'effect',
        sourceId: 'source',
        startsWeek: 0,
        endsWeek: 1,
        effect: { kind: 'narrative', instruction: 'Wait' },
      },
    ];
    render(
      <CanonicalCampaignContextEditor
        context={context}
        revision={null}
        onSave={vi.fn().mockResolvedValue(0)}
        characters={[]}
        teams={[]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Save campaign facts' }),
    );
    await screen.findByText('Campaign facts saved.');
    if (edit === 'typing')
      fireEvent.change(screen.getByLabelText('Treasury (copper)'), {
        target: { value: 'abc' },
      });
    if (edit === 'adding')
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    if (edit === 'selection')
      fireEvent.click(screen.getAllByRole('button', { name: 'Yes' })[0]!);
    if (edit === 'custom selection')
      fireEvent.click(screen.getByRole('button', { name: 'event chance' }));
    expect(screen.queryByText('Campaign facts saved.')).not.toBeInTheDocument();
    if (edit === 'typing') {
      fireEvent.click(
        screen.getByRole('button', { name: 'Save campaign facts' }),
      );
      await screen.findByText('Review the highlighted fields before saving.');
      expect(
        screen.queryByText('Campaign facts saved.'),
      ).not.toBeInTheDocument();
    }
  },
);
