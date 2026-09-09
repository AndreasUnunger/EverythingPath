import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CampaignSelector from './campaign-selector';

it('keeps the campaign menu open when the dashboard renders new data', () => {
  const select = vi.fn();
  const { rerender } = render(
    <CampaignSelector
      campaigns={undefined}
      selectedCampaign={undefined}
      setSelectedCampaign={select}
    />,
  );
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Active campaign' }), {
    key: 'ArrowDown',
  });
  expect(screen.getByRole('listbox')).toBeVisible();
  rerender(
    <CampaignSelector
      campaigns={[]}
      selectedCampaign={undefined}
      setSelectedCampaign={select}
    />,
  );
  expect(screen.getByRole('listbox')).toBeVisible();
});
