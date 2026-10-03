import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildCharacterSheetView } from './character-sheet-view-model';
import { buildSheet } from './character-sheet-test-fixture';
import type { useCharacterSheet } from './use-character-sheet';
import { useCharacterSpellsPage } from './use-character-spells-page';

const transport = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  query: vi.fn(),
  paginated: vi.fn(),
  loadMore: vi.fn(),
  info: { levels: [0, 1, 2, 3], defaultLevel: 1, schools: ['abj', 'evo'] },
  status: 'CanLoadMore',
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => transport.params,
  usePathname: () => '/characters/character-1',
  useRouter: () => ({ replace: transport.replace }),
}));
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => {
    transport.query(...args);
    return transport.info;
  },
  usePaginatedQuery: (...args: unknown[]) => {
    transport.paginated(...args);
    return {
      results: [],
      status: transport.status,
      loadMore: transport.loadMore,
    };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  transport.params = new URLSearchParams('from=%2Fcharacters');
  transport.status = 'CanLoadMore';
  transport.info = {
    levels: [0, 1, 2, 3],
    defaultLevel: 1,
    schools: ['abj', 'evo'],
  };
  transport.replace.mockImplementation((href: string) => {
    transport.params = new URLSearchParams(href.split('?')[1]);
  });
});

function controller(classId: 'wizard' | 'cleric' = 'wizard') {
  const snapshot = buildSheet({ levels: [{ id: 'caster', classId, hp: 8 }] });
  return {
    sheet: buildCharacterSheetView(snapshot),
    spells: {
      statusForSpell: vi.fn(),
      statusForEntry: vi.fn(),
      hasRemoteChange: false,
      dismissRemoteChange: vi.fn(),
      record: vi.fn(),
      editLevel: vi.fn(),
      remove: vi.fn(),
    },
    warnings: {
      statusFor: vi.fn(),
      hasRemoteChange: false,
      dismissRemoteChange: vi.fn(),
      accept: vi.fn(),
      reopen: vi.fn(),
    },
  } satisfies Pick<
    ReturnType<typeof useCharacterSheet>,
    'sheet' | 'spells' | 'warnings'
  >;
}

test('the recorded view opens the level browser explicitly; searching spans levels and level tabs clear search', () => {
  const sheet = controller();
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  expect(view.result.current.isBrowsing).toBe(false);
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    'skip',
    { initialNumItems: 25 },
  );
  act(() => view.result.current.enterBrowser());
  expect(view.result.current.isBrowsing).toBe(true);
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    {
      characterId: sheet.sheet.character._id,
      castingClassId: 'wizard',
      spellLevel: 1,
    },
    { initialNumItems: 25 },
  );
  act(() => view.result.current.setQuery('shield'));
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    {
      characterId: sheet.sheet.character._id,
      castingClassId: 'wizard',
      search: 'shield',
    },
    { initialNumItems: 25 },
  );
  act(() => view.result.current.setLevel(3));
  expect(view.result.current.query).toBe('');
  expect(transport.params.get('level')).toBe('3');
  expect(transport.params.get('from')).toBe('/characters');
  expect(transport.params.get('q')).toBeNull();
});

test('whole-list casters always browse read-only and cannot enable other lists; load-more requires available results', () => {
  transport.params.set('other', '1');
  const sheet = controller('cleric');
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  expect(view.result.current.isBrowsing).toBe(true);
  expect(view.result.current.readOnly).toBe(true);
  expect(view.result.current.includeOtherLists).toBe(false);
  act(() => view.result.current.setIncludeOtherLists(true));
  expect(transport.params.get('other')).toBe('1');
  act(() => view.result.current.loadMore());
  expect(transport.loadMore).toHaveBeenCalledWith(25);
  transport.status = 'Exhausted';
  view.rerender();
  act(() => view.result.current.loadMore());
  expect(transport.loadMore).toHaveBeenCalledTimes(1);
});

test('school filters and phone description expansion remain local to the selected Spellcasting', () => {
  transport.params.set('add', '1');
  const sheet = controller();
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  act(() => view.result.current.setSchool('abj'));
  expect(transport.params.get('school')).toBe('abj');
  expect(view.result.current.schools).toEqual([
    { value: 'abj', label: 'Abjuration', abbreviation: 'Abj' },
    { value: 'evo', label: 'Evocation', abbreviation: 'Evoc' },
  ]);
  act(() => view.result.current.toggleDescription('shield'));
  expect(view.result.current.isDescriptionExpanded('shield')).toBe(true);
  act(() => view.result.current.leaveBrowser());
  expect(transport.params.get('add')).toBeNull();
  expect(transport.params.get('school')).toBeNull();
});

test('switching Spellcastings clears browser filters, preserves the sheet origin and scopes descriptions', () => {
  transport.params = new URLSearchParams(
    'from=%2Fcharacters&spellcasting=wizard&add=1&level=3&school=abj&q=shield&other=1',
  );
  const sheet = controller();
  sheet.sheet = buildCharacterSheetView(
    buildSheet({
      levels: [
        { id: 'wizard-level', classId: 'wizard', hp: 6 },
        { id: 'cleric-level', classId: 'cleric', hp: 8 },
      ],
    }),
  );
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  act(() => view.result.current.toggleDescription('shield'));
  expect(view.result.current.isDescriptionExpanded('shield')).toBe(true);
  act(() => view.result.current.selectSpellcasting('cleric'));
  expect(view.result.current.selected?.classEntryId).toBe('cleric');
  expect(view.result.current.isDescriptionExpanded('shield')).toBe(false);
  expect(view.result.current.readOnly).toBe(true);
  expect(transport.params.toString()).toBe(
    'from=%2Fcharacters&spellcasting=cleric',
  );
  act(() => view.result.current.selectSpellcasting('missing-class'));
  expect(view.result.current.selected?.classEntryId).toBe('cleric');
});

test('external navigation replaces local browser choices and invalid filters fall back to available choices', () => {
  transport.params.set('add', '1');
  const sheet = controller();
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  act(() => view.result.current.setQuery('shield'));
  expect(view.result.current.query).toBe('shield');
  transport.params = new URLSearchParams(
    'from=%2Fcharacters&add=1&level=99&school=missing-school',
  );
  view.rerender();
  expect(view.result.current.query).toBe('');
  expect(view.result.current.selectedLevel).toBe(1);
  expect(view.result.current.school).toBeNull();
  act(() => view.result.current.setLevel(99));
  act(() => view.result.current.setSchool('missing-school'));
  expect(view.result.current.selectedLevel).toBe(1);
  expect(view.result.current.school).toBeNull();
});

test('browser edits stay visible while navigation is pending and changing Spellcasting clears them locally', () => {
  transport.replace.mockImplementation(() => undefined);
  const sheet = controller();
  sheet.sheet = buildCharacterSheetView(
    buildSheet({
      levels: [
        { id: 'wizard-level', classId: 'wizard', hp: 6 },
        { id: 'cleric-level', classId: 'cleric', hp: 8 },
      ],
    }),
  );
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  act(() => view.result.current.enterBrowser());
  act(() => view.result.current.setIncludeOtherLists(true));
  act(() => view.result.current.setQuery('shield'));
  act(() => view.result.current.setSchool('abj'));
  expect(view.result.current.isBrowsing).toBe(true);
  expect(view.result.current.includeOtherLists).toBe(true);
  expect(view.result.current.query).toBe('shield');
  expect(view.result.current.school).toBe('abj');
  expect(transport.params.toString()).toBe('from=%2Fcharacters');
  act(() => view.result.current.toggleDescription('shield'));
  act(() => view.result.current.selectSpellcasting('cleric'));
  expect(view.result.current.selected?.classEntryId).toBe('cleric');
  expect(view.result.current.query).toBe('');
  expect(view.result.current.school).toBeNull();
  expect(view.result.current.includeOtherLists).toBe(false);
  expect(view.result.current.isDescriptionExpanded('shield')).toBe(false);
  expect(transport.replace).toHaveBeenLastCalledWith(
    '/characters/character-1?from=%2Fcharacters&spellcasting=cleric',
    { scroll: false },
  );
});
