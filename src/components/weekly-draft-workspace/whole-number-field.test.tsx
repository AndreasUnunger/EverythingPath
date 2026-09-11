import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { WholeNumberField } from './whole-number-field';
test('[rules.P81.digits] digit entry rejects invalid text, keeps zero, and emits an explicit clear with styled required feedback', async () => {
  const save = vi.fn();
  const view = render(
    <WholeNumberField
      label="Attrition die"
      value={12}
      required
      onValue={save}
    />,
  );
  const input = screen.getByLabelText('Attrition die');
  for (const invalid of ['-1', '1.5', '1e2', ' 4', '4 ', 'x', '１２']) {
    fireEvent.change(input, { target: { value: invalid } });
    expect(input).toHaveValue('12');
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Use digits only.');
  }
  fireEvent.change(input, { target: { value: '0' } });
  expect(save).toHaveBeenLastCalledWith(0);
  view.rerender(
    <WholeNumberField
      label="Attrition die"
      value={0}
      required
      onValue={save}
    />,
  );
  expect(input).toHaveValue('0');
  fireEvent.change(input, { target: { value: '' } });
  expect(save).toHaveBeenLastCalledWith(null);
  view.rerender(
    <WholeNumberField
      label="Attrition die"
      value={null}
      required
      onValue={save}
    />,
  );
  fireEvent.blur(input);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'A value is required.',
  );
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAttribute('type', 'text');
});
