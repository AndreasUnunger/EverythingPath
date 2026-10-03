import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { useSheetEntryForm } from './use-sheet-entry-form';
import type { SheetEntryInput } from './use-character-sheet-entries';

test('Spell Effects prefill caster level and blank overrides restore the default while saving formulas', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [
      {
        target: 'ac.other',
        bonusType: 'deflection',
        value: { formula: '1 + floor(@casterLevel / 6)' },
      },
    ],
    casterLevel: 12,
  };
  const view = renderHook(() => useSheetEntryForm({ value, save }));
  expect(view.result.current.form.getValues('casterLevel')).toBe('12');
  act(() => view.result.current.form.setValue('casterLevel', ''));
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith({ ...value, casterLevel: 6 });
});

test('remote changes retain dirty classification fields and a maintenance refusal retains the draft', async () => {
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [],
    casterLevel: 6,
  };
  const save = vi
    .fn()
    .mockRejectedValue(
      new ConvexError({ code: 'MAINTENANCE', message: 'paused' }),
    );
  const view = renderHook(({ value }) => useSheetEntryForm({ value, save }), {
    initialProps: { value },
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '12', {
      shouldDirty: true,
    }),
  );
  view.rerender({ value: { ...value, casterLevel: 8 } });
  expect(view.result.current.form.getValues('casterLevel')).toBe('12');
  expect(view.result.current.hasRemoteChange).toBe(true);
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('casterLevel')).toBe('12');
});

test('the caster level save echo stays quiet while a later remote change is announced', async () => {
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [],
    casterLevel: 6,
  };
  const view = renderHook(
    ({ value }) => useSheetEntryForm({ value, save: async () => null }),
    { initialProps: { value } },
  );
  act(() =>
    view.result.current.form.setValue('casterLevel', '12', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  view.rerender({ value: { ...value, casterLevel: 12 } });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({ value: { ...value, casterLevel: 8 } });
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('saving an unchanged Character Sheet Entry keeps its current state without writing', async () => {
  const value: SheetEntryInput = {
    name: 'Recorded Spell',
    detail: { kind: 'spell' },
    modifiers: [],
  };
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ value, save }));
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).not.toHaveBeenCalled();
  expect(view.result.current.status.kind).toBe('idle');
});

test('a newly saved entry waits for its query echo without writing the same draft again', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ save }));
  act(() => {
    view.result.current.adjustmentForm.setValue('name', 'Potion', {
      shouldDirty: true,
    });
    view.result.current.removeModifier(0);
    view.result.current.form.setValue('kind', 'item', { shouldDirty: true });
    view.result.current.form.setValue('consumable', true, {
      shouldDirty: true,
    });
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith({
    name: 'Potion',
    modifiers: [],
    detail: { kind: 'item', consumable: true },
  });
});

test('changing only an entry classification saves it once and keeps its name and modifiers', async () => {
  const value: SheetEntryInput = {
    name: 'Potion',
    detail: { kind: 'item', consumable: false },
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 2 }],
  };
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ value, save }));
  act(() =>
    view.result.current.form.setValue('consumable', true, {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledWith({
    ...value,
    detail: { kind: 'item', consumable: true },
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledTimes(1);
});

test('a blank caster level accepts its own echo before the save reply and keeps subsequent saves unchanged', async () => {
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [],
    casterLevel: 12,
  };
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const save = vi.fn().mockReturnValue(pending);
  const view = renderHook(({ value }) => useSheetEntryForm({ value, save }), {
    initialProps: { value },
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '', { shouldDirty: true }),
  );
  let saving: Promise<unknown> | undefined;
  await act(async () => {
    saving = view.result.current.save();
  });
  view.rerender({ value: { ...value, casterLevel: 6 } });
  await act(async () => {
    complete?.();
    await saving;
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  expect(view.result.current.form.getValues('casterLevel')).toBe('6');
  expect(view.result.current.form.formState.isDirty).toBe(false);
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledTimes(1);
});

test('a newer caster-level draft survives an earlier save echo and reply', async () => {
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [],
    casterLevel: 12,
  };
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const save = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(null);
  const view = renderHook(({ value }) => useSheetEntryForm({ value, save }), {
    initialProps: { value },
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '', { shouldDirty: true }),
  );
  let saving: Promise<unknown> | undefined;
  await act(async () => {
    saving = view.result.current.save();
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '8', {
      shouldDirty: true,
    }),
  );
  view.rerender({ value: { ...value, casterLevel: 6 } });
  await act(async () => {
    complete?.();
    await saving;
  });
  expect(view.result.current.form.getValues('casterLevel')).toBe('8');
  expect(view.result.current.form.formState.isDirty).toBe(true);
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith({ ...value, casterLevel: 8 });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledTimes(2);
});
