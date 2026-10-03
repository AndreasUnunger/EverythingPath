import { act, renderHook } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { expect, test, vi } from 'vitest';
import { useAttackRoutineForm } from './use-attack-routine-form';

const value: Parameters<typeof useAttackRoutineForm>[0]['value'] = {
  name: 'Longsword',
  weaponEntryId: 'sword',
  hands: 'one',
  mode: 'melee',
};

test('routine fields persist immediately and an empty name stays local with its field error', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  await act(async () => {
    expect(await view.result.current.change('name', '')).toBe(false);
  });
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Routine name is required',
  );
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    expect(await view.result.current.change('hands', 'two')).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({ hands: 'two' });
  expect(view.result.current.statusFor('hands')).toEqual({ kind: 'saved' });
  expect(view.result.current.form.getValues('name')).toBe('');
  await act(async () => {
    await view.result.current.change('name', 'Sword in two hands');
  });
  expect(save).toHaveBeenLastCalledWith({ name: 'Sword in two hands' });
});

test('quick edits are saved in order without discarding a newer draft', async () => {
  let complete: (() => void) | undefined;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue(null);
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  let first: Promise<boolean> | undefined;
  let second: Promise<boolean> | undefined;
  await act(async () => {
    first = view.result.current.change('name', 'Sword');
  });
  await act(async () => {
    second = view.result.current.change('name', 'Sword strike');
  });
  expect(view.result.current.form.getValues('name')).toBe('Sword strike');
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => {
    complete?.();
    await first;
    await second;
  });
  expect(save.mock.calls).toEqual([
    [{ name: 'Sword' }],
    [{ name: 'Sword strike' }],
  ]);
  expect(view.result.current.form.getValues('name')).toBe('Sword strike');
  expect(view.result.current.form.formState.isDirty).toBe(false);
});

test('older replies cannot acknowledge a newer pending or invalid field draft', async () => {
  const completions: (() => void)[] = [];
  const save = vi.fn(
    () => new Promise<void>((resolve) => completions.push(resolve)),
  );
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  let first: Promise<boolean> | undefined;
  let second: Promise<boolean> | undefined;
  await act(async () => {
    first = view.result.current.change('name', 'Sword');
  });
  await act(async () => {
    second = view.result.current.change('name', 'Sword strike');
  });
  await act(async () => {
    completions[0]?.();
    await first;
  });
  expect(view.result.current.statusFor('name')).toEqual({ kind: 'saving' });
  await act(async () => {
    await view.result.current.change('name', '');
  });
  await act(async () => {
    completions[1]?.();
    await second;
  });
  expect(view.result.current.form.getValues('name')).toBe('');
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Routine name is required',
  );
  expect(view.result.current.statusFor('name')).toEqual({ kind: 'idle' });
});

test('a refused change keeps the draft, remote changes refresh other fields, and retry sends only that field', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(
      new ConvexError('Routine changed. Reload its current values.'),
    )
    .mockResolvedValue(null);
  const view = renderHook(
    ({ incoming }) => useAttackRoutineForm({ value: incoming, save }),
    { initialProps: { incoming: value } },
  );
  await act(async () => {
    expect(await view.result.current.change('name', 'My strike')).toBe(false);
  });
  view.rerender({ incoming: { ...value, name: 'Other strike', hands: 'two' } });
  expect(view.result.current.form.getValues()).toEqual({
    ...value,
    name: 'My strike',
    hands: 'two',
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.statusFor('name').kind).toBe('error');
  await act(async () => {
    expect(await view.result.current.retry('name')).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({ name: 'My strike' });
});

test('an incoming change during a save becomes the baseline without losing a newer remote field', async () => {
  let complete: (() => void) | undefined;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const view = renderHook(
    ({ incoming }) => useAttackRoutineForm({ value: incoming, save }),
    { initialProps: { incoming: value } },
  );
  let pending: Promise<boolean> | undefined;
  await act(async () => {
    pending = view.result.current.change('name', 'Sword');
  });
  view.rerender({ incoming: { ...value, name: 'Other strike', hands: 'two' } });
  await act(async () => {
    complete?.();
    await pending;
  });
  expect(view.result.current.form.getValues()).toEqual({
    ...value,
    name: 'Sword',
    hands: 'two',
  });
  expect(view.result.current.form.formState.defaultValues).toEqual({
    ...value,
    name: 'Other strike',
    hands: 'two',
  });
  expect(view.result.current.form.getFieldState('name').isDirty).toBe(true);
  expect(view.result.current.form.getFieldState('hands').isDirty).toBe(false);
  expect(view.result.current.hasRemoteChange).toBe(true);
});
