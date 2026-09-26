import { expect, test, vi } from 'vitest';
import { decodeCampaignId, legacyRedirectTarget } from './legacy-redirect';
import CanonicalWorkspacePage from '~/app/canonical-workspace/page';
import CanonicalSetupPage from '~/app/canonical-setup/page';
import CanonicalHistoryPage from '~/app/canonical-history/page';
import MilitiaCorrectPage from '~/app/campaigns/[campaignId]/militia/correct/page';
import Home from '~/app/page';

vi.mock('next/navigation', () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT ${href}`);
  },
}));

test('legacy addresses keep campaign, phase and supported history selection', () => {
  expect(
    legacyRedirectTarget('/canonical-workspace', {
      campaign: 'alpha',
      phase: 'event',
    }),
  ).toBe('/campaigns/alpha/week?phase=event');
  expect(
    legacyRedirectTarget('/canonical-workspace', {
      campaign: ['alpha', 'beta'],
      phase: 'bogus',
    }),
  ).toBe('/campaigns/alpha/week?phase=upkeep');
  expect(legacyRedirectTarget('/canonical-setup', { campaign: 'alpha' })).toBe(
    '/campaigns/alpha/setup',
  );
  expect(
    legacyRedirectTarget('/canonical-history', {
      campaign: 'alpha',
      week: '4',
      recordId: 'original',
      beforeSequence: '3',
    }),
  ).toBe('/campaigns/alpha/history?week=4&recordId=original&beforeSequence=3');
  expect(
    legacyRedirectTarget('/canonical-history', {
      campaign: 'alpha',
      week: '-1',
      beforeSequence: 'x',
    }),
  ).toBe('/campaigns/alpha/history');
  for (const pathname of [
    '/canonical-workspace',
    '/canonical-setup',
    '/canonical-history',
  ])
    expect(legacyRedirectTarget(pathname, { phase: 'event' })).toBe(
      '/campaigns',
    );
});

test('malformed encoded ids stay raw for the campaign gate', () => {
  expect(decodeCampaignId('alpha%20beta')).toBe('alpha beta');
  expect(decodeCampaignId('%E0%A4%A')).toBe('%E0%A4%A');
});

test('route pages redirect without rendering a legacy editor', async () => {
  await expect(
    CanonicalWorkspacePage({
      searchParams: Promise.resolve({ campaign: 'alpha', phase: 'summary' }),
    }),
  ).rejects.toThrow('REDIRECT /campaigns/alpha/week?phase=summary');
  await expect(
    CanonicalSetupPage({
      searchParams: Promise.resolve({ campaign: 'alpha' }),
    }),
  ).rejects.toThrow('REDIRECT /campaigns/alpha/setup');
  await expect(
    CanonicalHistoryPage({
      searchParams: Promise.resolve({ campaign: 'alpha', week: '2' }),
    }),
  ).rejects.toThrow('REDIRECT /campaigns/alpha/history?week=2');
  await expect(
    CanonicalHistoryPage({ searchParams: Promise.resolve({}) }),
  ).rejects.toThrow('REDIRECT /campaigns');
  await expect(
    MilitiaCorrectPage({ params: Promise.resolve({ campaignId: 'alpha' }) }),
  ).rejects.toThrow('REDIRECT /campaigns/alpha/militia');
  expect(() => Home()).toThrow('REDIRECT /campaigns');
});
