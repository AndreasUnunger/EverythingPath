// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { addSpellMutation, get, getCount } from './spell';

// The legacy spell table has no client caller. Its read returns the whole
// table and its write needs no sign-in, so neither may be public.
test.each([
  ['get', get],
  ['getCount', getCount],
  ['addSpellMutation', addSpellMutation],
])('spell.%s is internal', (_name, fn) => {
  expect(fn).toHaveProperty('isInternal', true);
  expect(fn).not.toHaveProperty('isPublic');
});
