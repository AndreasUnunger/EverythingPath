import { describe, expect, it } from 'vitest';
import {
  buildAssignedTeamOptions,
  buildRetrieveCacheOptions,
  buildSecureCacheClassOptions,
  buildSecureLocationOptions,
  getAssignedTeamContextLines,
  getSecureCacheSelectionWarnings,
} from '~/components/week-board/activity-team-context';

describe('activity team context helpers', () => {
  it('marks out-of-rules assigned teams with warnings', () => {
    const options = buildAssignedTeamOptions({
      actionId: 'knowledge_check',
      activeTeamIds: ['scholars', 'spellcasters'],
    });

    expect(options).toEqual([
      expect.objectContaining({ value: 'scholars', allowed: true }),
      expect.objectContaining({
        value: 'spellcasters',
        allowed: false,
        warning: 'cannot perform this action',
      }),
    ]);
  });

  it('builds secure cache class options based on assigned team capability', () => {
    const options = buildSecureCacheClassOptions('moles');

    expect(options.find((option) => option.value === 'minor')).toEqual(
      expect.objectContaining({ allowed: true }),
    );
    expect(options.find((option) => option.value === 'intermediate')).toEqual(
      expect.objectContaining({
        allowed: false,
        warning: 'intermediate caches require Propagandists, Saboteurs, or Spies',
      }),
    );
    expect(options.find((option) => option.value === 'major')).toEqual(
      expect.objectContaining({
        allowed: false,
        warning: 'major caches require Saboteurs or Spies',
      }),
    );
  });

  it('warns that secure-location caches require tier 3 cache teams', () => {
    const options = buildSecureLocationOptions('propagandists');

    expect(options[1]).toEqual(
      expect.objectContaining({
        value: 'yes',
        allowed: false,
        warning: 'secure-location caches require Saboteurs or Spies',
      }),
    );
  });

  it('adds team-specific context lines for actions with variable effects', () => {
    expect(
      getAssignedTeamContextLines({
        actionId: 'earn_gold',
        assignedTeamId: 'merchants',
      }),
    ).toEqual(['Gold gained = entered Loyalty check total x team tier (2).']);

    expect(
      getAssignedTeamContextLines({
        actionId: 'broker_market',
        assignedTeamId: 'merchants',
      }),
    ).toEqual(['Merchants operate as a small town market.']);
  });

  it('warns when retrieving a cache exceeds the assigned team capability', () => {
    const options = buildRetrieveCacheOptions({
      assignedTeamId: 'moles',
      caches: [
        {
          _id: 'cache1',
          label: 'Vault cache',
          cacheClass: 'major',
          location: 'Vault',
          contentsSummary: 'Gear',
          status: 'hidden',
          isSecureLocation: true,
          createdWeek: 1,
          updatedWeek: 1,
        },
      ],
    });

    expect(options[0]).toEqual(
      expect.objectContaining({
        allowed: false,
        warning:
          'major caches require Saboteurs or Spies; secure-location caches require Saboteurs or Spies',
      }),
    );
  });

  it('reports current secure cache selection warnings without blocking them', () => {
    expect(
      getSecureCacheSelectionWarnings({
        assignedTeamId: 'moles',
        cacheClass: 'major',
        isSecureLocation: true,
      }),
    ).toEqual([
      'major caches require Saboteurs or Spies',
      'secure-location caches require Saboteurs or Spies',
    ]);
  });
});
