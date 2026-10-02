import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ConvexError } from 'convex/values';
import { useBaseScoresForm, useClassLevelForm } from './use-sheet-forms';

test('a missing HP choice stays blank and can be saved; malformed HP has a field error', async () => {
  let persisted: number | null = 8;
  const view = renderHook(() =>
    useClassLevelForm({
      hpGained: null,
      save: async (hp) => {
        persisted = hp;
      },
    }),
  );
  expect(view.result.current.form.getValues('hpGained')).toBe('');
  act(() =>
    view.result.current.form.setValue('hpGained', 'oops', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  await waitFor(() =>
    expect(view.result.current.form.formState.errors.hpGained?.message).toBe(
      'Hit points must be a number',
    ),
  );
  expect(persisted).toBe(8);
  act(() =>
    view.result.current.form.setValue('hpGained', '', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.hpGained).toBeUndefined();
  expect(view.result.current.form.getValues('hpGained')).toBe('');
});

test('base score errors distinguish empty and malformed without blocking unusual scores', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  const saved: Partial<typeof scores>[] = [];
  const view = renderHook(() =>
    useBaseScoresForm({
      scores,
      save: async (changes) => {
        saved.push(changes);
      },
    }),
  );
  act(() => {
    view.result.current.form.setValue('strength', '', { shouldDirty: true });
    view.result.current.form.setValue('dexterity', 'twelve', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.strength?.message).toBe(
    'Strength is required',
  );
  expect(view.result.current.form.formState.errors.dexterity?.message).toBe(
    'Dexterity must be a number',
  );
  expect(saved).toEqual([]);
  act(() => {
    view.result.current.form.setValue('strength', '-2', { shouldDirty: true });
    view.result.current.form.setValue('dexterity', '10', { shouldDirty: true });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(saved).toEqual([{ strength: -2 }]);
});

test('remote scores update pristine fields while retaining dirty inputs and field errors', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  let saved = {};
  const view = renderHook(
    ({ scores }) =>
      useBaseScoresForm({
        scores,
        save: async (changes) => {
          saved = changes;
        },
      }),
    { initialProps: { scores } },
  );
  act(() =>
    view.result.current.form.setValue('strength', 'bad', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  view.rerender({ scores: { ...scores, strength: 14, dexterity: 16 } });
  expect(view.result.current.form.getValues('strength')).toBe('bad');
  expect(view.result.current.form.getValues('dexterity')).toBe('16');
  expect(view.result.current.form.formState.errors.strength?.message).toBe(
    'Strength must be a number',
  );
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() =>
    view.result.current.form.setValue('strength', '18', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(saved).toEqual({ strength: 18 });
});

test('a save settling after a remote update keeps the remote scores and newer local edits', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  let accept: (() => void) | undefined;
  let writes = 0;
  const view = renderHook(
    ({ scores }) =>
      useBaseScoresForm({
        scores,
        save: () => {
          writes++;
          return new Promise<void>((resolve) => {
            accept = resolve;
          });
        },
      }),
    { initialProps: { scores } },
  );
  act(() =>
    view.result.current.form.setValue('strength', '14', { shouldDirty: true }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({ scores: { ...scores, dexterity: 16 } });
  act(() =>
    view.result.current.form.setValue('strength', '18', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toBe(1);
  await act(async () => {
    accept?.();
    await pending;
  });
  expect(view.result.current.form.getValues('strength')).toBe('18');
  expect(view.result.current.form.getValues('dexterity')).toBe('16');
  expect(view.result.current.form.formState.dirtyFields.strength).toBe(true);
  expect(view.result.current.form.formState.dirtyFields.dexterity).not.toBe(
    true,
  );
  view.rerender({ scores: { ...scores, strength: 14, dexterity: 16 } });
  expect(view.result.current.form.getValues('strength')).toBe('18');
});

test('a refused HP save keeps the draft and retry; its own subscription echo is not a remote change', async () => {
  let refuse = true;
  let persisted: number | null = 8;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: async (hp) => {
          if (refuse) throw new ConvexError('Editing is paused');
          persisted = hp;
        },
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '0', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.status).toEqual({
    kind: 'error',
    message:
      "Changes weren't saved: Editing is paused. Your edits are kept. Save to try again.",
  });
  expect(view.result.current.form.getValues('hpGained')).toBe('0');
  expect(persisted).toBe(8);
  refuse = false;
  await act(async () => {
    await view.result.current.save();
  });
  expect(persisted).toBe(0);
  expect(view.result.current.status.kind).toBe('saved');
  view.rerender({ hpGained: 0 });
  expect(view.result.current.hasRemoteChange).toBe(false);
  act(() =>
    view.result.current.form.setValue('hpGained', '', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(persisted).toBeNull();
});

test('a later matching remote HP update does not acknowledge an unknown failed save', async () => {
  let writes = 0;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: async () => {
          writes++;
          throw new Error('Connection closed');
        },
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '11', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.status).toEqual({
    kind: 'error',
    message:
      'Changes may not have been saved. Your edits are kept. Check them, then Save to try again.',
  });
  view.rerender({ hpGained: 11 });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.form.getValues('hpGained')).toBe('11');
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toBe(1);
  expect(view.result.current.status.kind).toBe('idle');
  expect(view.result.current.form.formState.isDirty).toBe(false);
  expect(view.result.current.form.getValues('hpGained')).toBe('11');
});

test('a later remote overwrite stays authoritative when the earlier save reply finally arrives', async () => {
  let accept: (() => void) | undefined;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: () =>
          new Promise<void>((resolve) => {
            accept = resolve;
          }),
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '14', { shouldDirty: true }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({ hpGained: 14 });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({ hpGained: 16 });
  expect(view.result.current.hasRemoteChange).toBe(true);
  await act(async () => {
    accept?.();
    await pending;
  });
  // A retained draft must be visibly unsaved against the later remote value.
  expect(view.result.current.form.getValues('hpGained')).toBe('14');
  expect(view.result.current.form.formState.dirtyFields.hpGained).toBe(true);
});

test('recorded fractional scores do not block unrelated edits and fractional HP stays saveable', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 99.5,
    charisma: 10,
  };
  let saved = {};
  const abilities = renderHook(() =>
    useBaseScoresForm({
      scores,
      save: async (changes) => {
        saved = changes;
      },
    }),
  );
  act(() =>
    abilities.result.current.form.setValue('strength', '14', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await abilities.result.current.save();
  });
  expect(saved).toEqual({ strength: 14 });
  let hp: number | null = null;
  const level = renderHook(() =>
    useClassLevelForm({
      hpGained: null,
      save: async (value) => {
        hp = value;
      },
    }),
  );
  act(() =>
    level.result.current.form.setValue('hpGained', '4.5', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await level.result.current.save();
  });
  expect(hp).toBe(4.5);
});

test('an observed own HP update stays acknowledged when its reply is later lost', async () => {
  let refuse: ((error: unknown) => void) | undefined;
  let writes = 0;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: () => {
          writes++;
          return new Promise<void>((_resolve, reject) => {
            refuse = reject;
          });
        },
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '11', { shouldDirty: true }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({ hpGained: 11 });
  await act(async () => {
    refuse?.(new Error('Connection closed'));
    await pending;
  });
  expect(view.result.current.status.kind).toBe('saved');
  expect(view.result.current.hasRemoteChange).toBe(false);
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toBe(1);
});

test('formatted numeric drafts recognize canonical own echoes without discarding raw input', async () => {
  let refuse: ((error: unknown) => void) | undefined;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: () =>
          new Promise<void>((_resolve, reject) => {
            refuse = reject;
          }),
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '4.50', {
      shouldDirty: true,
    }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({ hpGained: 4.5 });
  expect(view.result.current.hasRemoteChange).toBe(false);
  expect(view.result.current.form.getValues('hpGained')).toBe('4.50');
  await act(async () => {
    refuse?.(new Error('Connection closed'));
    await pending;
  });
  expect(view.result.current.status.kind).toBe('saved');
});

test.each(['success', 'echo-before-loss'])(
  'an acknowledged formatted save follows later remote changes (%s)',
  async (outcome) => {
    let accept: (() => void) | undefined;
    let refuse: ((error: unknown) => void) | undefined;
    const view = renderHook(
      ({ hpGained }) =>
        useClassLevelForm({
          hpGained,
          save: () =>
            new Promise<void>((resolve, reject) => {
              accept = resolve;
              refuse = reject;
            }),
        }),
      { initialProps: { hpGained: 8 } },
    );
    act(() =>
      view.result.current.form.setValue('hpGained', '4.50', {
        shouldDirty: true,
      }),
    );
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = view.result.current.save();
    });
    view.rerender({ hpGained: 4.5 });
    await act(async () => {
      if (outcome === 'success') accept?.();
      else refuse?.(new Error('Connection closed'));
      await pending;
    });
    expect(view.result.current.status.kind).toBe('saved');
    expect(view.result.current.form.formState.defaultValues).toEqual({
      hpGained: '4.5',
    });
    expect(view.result.current.form.getValues('hpGained')).toBe('4.5');
    expect(view.result.current.form.formState.dirtyFields.hpGained).not.toBe(
      true,
    );
    view.rerender({ hpGained: 6 });
    expect(view.result.current.form.getValues('hpGained')).toBe('6');
    expect(view.result.current.hasRemoteChange).toBe(true);
  },
);

test('a malformed newer draft is retained even when Number would coerce it to the saved value', async () => {
  let accept: (() => void) | undefined;
  const view = renderHook(() =>
    useClassLevelForm({
      hpGained: 8,
      save: () =>
        new Promise<void>((resolve) => {
          accept = resolve;
        }),
    }),
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '14', { shouldDirty: true }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  act(() =>
    view.result.current.form.setValue('hpGained', '0xE', { shouldDirty: true }),
  );
  await act(async () => {
    accept?.();
    await pending;
  });
  expect(view.result.current.form.getValues('hpGained')).toBe('0xE');
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.hpGained?.message).toBe(
    'Hit points must be a number',
  );
});

test('an unknown score save keeps newer drafts and treats later matching scores as remote', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  const view = renderHook(
    ({ scores }) =>
      useBaseScoresForm({
        scores,
        save: async () => {
          throw new Error('Connection closed');
        },
      }),
    { initialProps: { scores } },
  );
  act(() => {
    view.result.current.form.setValue('strength', '14', { shouldDirty: true });
    view.result.current.form.setValue('dexterity', '16', { shouldDirty: true });
  });
  await act(async () => {
    await view.result.current.save();
  });
  act(() => {
    view.result.current.form.setValue('strength', '18', { shouldDirty: true });
  });
  view.rerender({ scores: { ...scores, strength: 14 } });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.status.kind).toBe('error');
  act(() => view.result.current.dismissRemoteChange());
  view.rerender({ scores: { ...scores, strength: 14, dexterity: 16 } });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('strength')).toBe('18');
  expect(view.result.current.form.formState.dirtyFields.strength).toBe(true);
});
