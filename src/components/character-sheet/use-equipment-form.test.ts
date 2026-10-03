import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useEquipmentForm } from './use-equipment-form';

test('enhancement distinguishes empty and invalid values and keeps a failed draft for retry', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValue(null);
  const view = renderHook(() => useEquipmentForm({ value: {}, save }));
  for (const [raw, message] of [
    ['', 'Enhancement is required'],
    ['many', 'Enhancement must be a whole number of 0 or more'],
    ['1.5', 'Enhancement must be a whole number of 0 or more'],
  ]) {
    act(() => view.result.current.form.setValue('enhancement', raw ?? ''));
    await act(async () => {
      await view.result.current.save();
    });
    expect(view.result.current.form.formState.errors.enhancement?.message).toBe(
      message,
    );
  }
  expect(save).not.toHaveBeenCalled();
  act(() =>
    view.result.current.form.setValue('enhancement', '2', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('enhancement')).toBe('2');
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith({
    enhancement: 2,
    masterwork: false,
    material: null,
  });
});

test.each(['before', 'after'])(
  'accepted equipment values are pristine when their echo arrives %s acknowledgement',
  async (echo) => {
    let complete: (() => void) | undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const view = renderHook(
      ({ enhancement, material }) =>
        useEquipmentForm({ value: { enhancement, material }, save }),
      {
        initialProps: { enhancement: 0, material: '' },
      },
    );
    act(() => {
      view.result.current.form.setValue('enhancement', '02', {
        shouldDirty: true,
      });
      view.result.current.form.setValue('material', '  mithral  ', {
        shouldDirty: true,
      });
    });
    let saving: Promise<'saved' | 'failed'> | undefined;
    await act(async () => {
      saving = view.result.current.save();
    });
    if (echo === 'before')
      view.rerender({ enhancement: 2, material: 'mithral' });
    await act(async () => {
      complete?.();
      await saving;
    });
    if (echo === 'after')
      view.rerender({ enhancement: 2, material: 'mithral' });
    expect(view.result.current.form.getValues()).toEqual({
      enhancement: '2',
      material: 'mithral',
      masterwork: false,
    });
    expect(view.result.current.form.formState.isDirty).toBe(false);
    expect(view.result.current.hasRemoteChange).toBe(false);
  },
);

test('a newer invalid draft survives an accepted equipment save', async () => {
  let complete: (() => void) | undefined;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const view = renderHook(
    ({ enhancement }) => useEquipmentForm({ value: { enhancement }, save }),
    { initialProps: { enhancement: 1 } },
  );
  act(() =>
    view.result.current.form.setValue('enhancement', '2', {
      shouldDirty: true,
    }),
  );
  let saving: Promise<'saved' | 'failed'> | undefined;
  await act(async () => {
    saving = view.result.current.save();
  });
  act(() =>
    view.result.current.form.setValue('enhancement', '2.0', {
      shouldDirty: true,
    }),
  );
  view.rerender({ enhancement: 2 });
  await act(async () => {
    complete?.();
    await saving;
  });
  expect(view.result.current.form.getValues('enhancement')).toBe('2.0');
  expect(view.result.current.form.formState.isDirty).toBe(true);
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.enhancement?.message).toBe(
    'Enhancement must be a whole number of 0 or more',
  );
  expect(save).toHaveBeenCalledTimes(1);
});

test('remote equipment changes refresh pristine fields while retaining dirty fields with a notice', () => {
  const view = renderHook(
    ({ enhancement, material }) =>
      useEquipmentForm({
        value: { enhancement, material },
        save: async () => null,
      }),
    {
      initialProps: { enhancement: 0, material: '' },
    },
  );
  act(() =>
    view.result.current.form.setValue('enhancement', '2', {
      shouldDirty: true,
    }),
  );
  view.rerender({ enhancement: 3, material: 'darkwood' });
  expect(view.result.current.form.getValues()).toEqual({
    enhancement: '2',
    material: 'darkwood',
    masterwork: false,
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
});
