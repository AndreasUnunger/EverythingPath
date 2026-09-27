import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
afterEach(cleanup);
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

test('[rules.WEEK-14.rejected-focus-loss] a rejected character keeps its styled, announced error when focus leaves while the prior valid value is retained, until valid input clears it', async () => {
  const save = vi.fn();
  const onInvalid = vi.fn();
  render(
    <WholeNumberField
      label="Check roll"
      value={20}
      required
      onValue={save}
      onInvalid={onInvalid}
    />,
  );
  const input = screen.getByRole('textbox', { name: 'Check roll' });
  fireEvent.change(input, { target: { value: '20x' } });
  expect(input).toHaveValue('20');
  expect(onInvalid).toHaveBeenLastCalledWith('Use digits only.');
  // Leaving the field (for example to press Save) must not hide the error:
  // the enclosing form still refuses to save this field.
  fireEvent.blur(input);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Use digits only.',
  );
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription(/Use digits only\./);
  expect(save).not.toHaveBeenCalled();
  // Valid input clears both the field error and the parent's invalid state.
  fireEvent.change(input, { target: { value: '7' } });
  expect(onInvalid).toHaveBeenLastCalledWith(null);
  expect(save).toHaveBeenLastCalledWith(7);
  fireEvent.blur(input);
  expect(input).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getByRole('alert')).not.toHaveTextContent('Use digits only.');
  // Ordinary required validation on focus loss is unchanged.
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.blur(input);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'A value is required.',
  );
});
