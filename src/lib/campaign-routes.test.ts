import { describe, expect, it, vi } from 'vitest';
import Home from '~/app/page';
import {
  campaignPath,
  characterSheetPath,
  decodeRouteSegment,
  normalizePhase,
  weekPath,
  parseHistorySelection,
  historyPath,
} from './campaign-routes';

vi.mock('next/navigation', () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT ${href}`);
  },
}));

describe('campaign navigation', () => {
  it('opens a private sheet without inventing a campaign and preserves campaign origins', () => {
    expect(characterSheetPath(undefined, 'hero/a?b#c%')).toBe(
      '/characters/hero%2Fa%3Fb%23c%25',
    );
    expect(characterSheetPath('first', 'hero')).toBe(
      '/campaigns/first/characters/hero',
    );
  });
  it('keeps all campaign sections scoped and encodes a campaign identifier once', () => {
    expect(campaignPath('table/a?b#c%')).toBe(
      '/campaigns/table%2Fa%3Fb%23c%25',
    );
    expect(campaignPath('first', 'week')).toBe('/campaigns/first/week');
    expect(campaignPath('first', 'history')).toBe('/campaigns/first/history');
    expect(campaignPath('first', 'militia')).toBe('/campaigns/first/militia');
    expect(campaignPath('first', 'characters')).toBe(
      '/campaigns/first/characters',
    );
    expect(campaignPath('first', 'setup')).toBe('/campaigns/first/setup');
  });
});

it('opens every supported Phase View locally and falls back to Upkeep', () => {
  for (const phase of [
    'upkeep',
    'activity',
    'event',
    'persistent',
    'summary',
  ]) {
    expect(normalizePhase(phase)).toBe(phase);
    expect(weekPath('first', phase)).toBe(
      `/campaigns/first/week?phase=${phase}`,
    );
  }
  for (const phase of [undefined, null, '', 'invalid', 'Activity']) {
    expect(normalizePhase(phase)).toBe('upkeep');
    expect(weekPath('first', phase)).toBe('/campaigns/first/week?phase=upkeep');
  }
});

it('keeps historical week, audit selection and paging in a reloadable campaign URL', () => {
  const path = historyPath('first', {
    week: 4,
    recordId: 'record/a?b#c',
    beforeSequence: 3,
  });
  expect(path).toBe(
    '/campaigns/first/history?week=4&recordId=record%2Fa%3Fb%23c&beforeSequence=3',
  );
  expect(
    parseHistorySelection(new URL(path, 'https://example.test').searchParams),
  ).toEqual({ week: 4, recordId: 'record/a?b#c', beforeSequence: 3 });
  expect(historyPath('first')).toBe('/campaigns/first/history');
  expect(parseHistorySelection(new URLSearchParams())).toEqual({});
});

it('discards malformed numeric history selectors without losing valid selection', () => {
  for (const value of [
    '',
    ' ',
    '-1',
    '1.5',
    'Infinity',
    'NaN',
    '1e3',
    '0x10',
    '9007199254740992',
    '2wrong',
  ]) {
    const params = new URLSearchParams({
      week: value,
      beforeSequence: value,
      recordId: 'selected',
    });
    expect(parseHistorySelection(params)).toEqual({ recordId: 'selected' });
  }
  expect(
    parseHistorySelection(
      new URLSearchParams('week=0&beforeSequence=0&recordId='),
    ),
  ).toEqual({ week: 0, beforeSequence: 0 });
  expect(
    parseHistorySelection(new URLSearchParams('week=4&beforeSequence=bad')),
  ).toEqual({ week: 4 });
});

it('keeps a malformed encoded id raw for the campaign gate', () => {
  expect(decodeRouteSegment('alpha%20beta')).toBe('alpha beta');
  expect(decodeRouteSegment('%E0%A4%A')).toBe('%E0%A4%A');
});

it("sends the app's entry to the campaign list", () => {
  expect(() => Home()).toThrow('REDIRECT /campaigns');
});
