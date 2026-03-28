'use client';

import type { CacheLedgerEntry } from '~/components/week-board/activity-asset-operations';
import { ACTION_TEAM_REQUIREMENTS } from '~/components/week-board/phase-sections/activity-phase-shared';
import { getTeamTier } from '~/components/week-board/team-options';
import type { ActionId } from '~/components/week-board/types';

export type TeamActionOption = {
  value: string;
  label: string;
  warning?: string;
  allowed: boolean;
};

type SecureCacheCapability = {
  cacheClasses: ReadonlyArray<'minor' | 'intermediate' | 'major'>;
  secureLocation: boolean;
};

const SECURE_CACHE_TEAM_CAPABILITIES: Record<string, SecureCacheCapability> = {
  moles: {
    cacheClasses: ['minor'],
    secureLocation: false,
  },
  propagandists: {
    cacheClasses: ['minor', 'intermediate'],
    secureLocation: false,
  },
  saboteurs: {
    cacheClasses: ['minor', 'intermediate', 'major'],
    secureLocation: true,
  },
  spies: {
    cacheClasses: ['minor', 'intermediate', 'major'],
    secureLocation: true,
  },
};

type SecureCacheTeamId = keyof typeof SECURE_CACHE_TEAM_CAPABILITIES;

export function buildAssignedTeamOptions({
  actionId,
  activeTeamIds,
}: {
  actionId: ActionId;
  activeTeamIds: string[];
}) {
  const requiredTeamIds = ACTION_TEAM_REQUIREMENTS[actionId];
  return activeTeamIds.map((teamId) => {
    const warnings: string[] = [];
    if (requiredTeamIds && !requiredTeamIds.includes(teamId)) {
      warnings.push('cannot perform this action');
    }

    return {
      value: teamId,
      label: warnings.length
        ? `${teamId} [warning: ${warnings.join('; ')}]`
        : `${teamId} [allowed]`,
      warning: warnings.join('; ') || undefined,
      allowed: warnings.length === 0,
    };
  });
}

export function getAssignedTeamContextLines({
  actionId,
  assignedTeamId,
}: {
  actionId: ActionId;
  assignedTeamId?: string;
}) {
  if (!assignedTeamId) {
    if (
      actionId === 'secure_cache' ||
      actionId === 'broker_market' ||
      actionId === 'earn_gold' ||
      actionId === 'gather_information'
    ) {
      return ['Assign a team to show the exact rules effect for this action.'];
    }
    return [];
  }

  const tier = getTeamTier(assignedTeamId);
  if (!tier) return [];

  if (actionId === 'broker_market') {
    return [
      assignedTeamId === 'merchants'
        ? 'Merchants operate as a small town market.'
        : 'Black Marketeers and Fixers operate as a small city market.',
    ];
  }

  if (actionId === 'earn_gold') {
    return [`Gold gained = entered Loyalty check total x team tier (${tier}).`];
  }

  if (actionId === 'gather_information') {
    return [`This team adds +${tier * 2} to the DC 15 Secrecy check.`];
  }

  if (actionId === 'secure_cache') {
    const capability = getSecureCacheCapability(assignedTeamId);
    if (!capability) {
      return ['This team is outside the normal Secure Cache team list.'];
    }
    return [
      `This team can place ${capability.cacheClasses.join(', ')} caches.`,
      capability.secureLocation
        ? 'This team can place caches in secure locations (+5 DC).'
        : 'Secure-location caches require Saboteurs or Spies.',
    ];
  }

  return [];
}

export function buildSecureCacheClassOptions(assignedTeamId?: string) {
  return (['minor', 'intermediate', 'major'] as const).map((cacheClass) => {
    const warning = getSecureCacheClassWarning({
      assignedTeamId,
      cacheClass,
    });
    return {
      value: cacheClass,
      label: warning
        ? `${capitalize(cacheClass)} [warning: ${warning}]`
        : `${capitalize(cacheClass)} [allowed]`,
      warning,
      allowed: !warning,
    };
  });
}

export function buildSecureLocationOptions(assignedTeamId?: string) {
  return [
    {
      value: 'no',
      label: 'Normal location [allowed]',
      allowed: true,
    },
    {
      value: 'yes',
      label: getSecureLocationWarning(assignedTeamId)
        ? `Secure location (+5 DC) [warning: ${getSecureLocationWarning(assignedTeamId)}]`
        : 'Secure location (+5 DC) [allowed]',
      warning: getSecureLocationWarning(assignedTeamId),
      allowed: !getSecureLocationWarning(assignedTeamId),
    },
  ] satisfies TeamActionOption[];
}

export function buildRetrieveCacheOptions({
  assignedTeamId,
  caches,
}: {
  assignedTeamId?: string;
  caches: CacheLedgerEntry[];
}) {
  return caches
    .filter((cache) => cache.status === 'hidden')
    .map((cache) => {
      const warnings = [
        getSecureCacheClassWarning({
          assignedTeamId,
          cacheClass: cache.cacheClass,
        }),
        cache.isSecureLocation ? getSecureLocationWarning(assignedTeamId) : undefined,
      ].filter((warning): warning is string => Boolean(warning));

      return {
        value: cache._id,
        label: warnings.length
          ? `${cache.label} (${cache.cacheClass}, ${cache.location}) [warning: ${warnings.join('; ')}]`
          : `${cache.label} (${cache.cacheClass}, ${cache.location}) [allowed]`,
        warning: warnings.join('; ') || undefined,
        allowed: warnings.length === 0,
      };
    });
}

export function getSecureCacheSelectionWarnings({
  assignedTeamId,
  cacheClass,
  isSecureLocation,
  retrieveCache,
}: {
  assignedTeamId?: string;
  cacheClass?: 'minor' | 'intermediate' | 'major';
  isSecureLocation?: boolean;
  retrieveCache?: Pick<CacheLedgerEntry, 'cacheClass' | 'isSecureLocation'>;
}) {
  const warnings: string[] = [];

  if (cacheClass) {
    const classWarning = getSecureCacheClassWarning({
      assignedTeamId,
      cacheClass,
    });
    if (classWarning) {
      warnings.push(classWarning);
    }
  }

  if (isSecureLocation) {
    const locationWarning = getSecureLocationWarning(assignedTeamId);
    if (locationWarning) {
      warnings.push(locationWarning);
    }
  }

  if (retrieveCache) {
    const retrieveClassWarning = getSecureCacheClassWarning({
      assignedTeamId,
      cacheClass: retrieveCache.cacheClass,
    });
    if (retrieveClassWarning) {
      warnings.push(`Selected cache: ${retrieveClassWarning}`);
    }
    if (retrieveCache.isSecureLocation) {
      const retrieveLocationWarning = getSecureLocationWarning(assignedTeamId);
      if (retrieveLocationWarning) {
        warnings.push(`Selected cache: ${retrieveLocationWarning}`);
      }
    }
  }

  return Array.from(new Set(warnings));
}

function getSecureCacheClassWarning({
  assignedTeamId,
  cacheClass,
}: {
  assignedTeamId?: string;
  cacheClass: 'minor' | 'intermediate' | 'major';
}) {
  if (!assignedTeamId) {
    return 'assign a cache-capable team first';
  }

  const capability = getSecureCacheCapability(assignedTeamId);
  if (!capability) {
    return 'assigned team is not normally allowed to Secure Cache';
  }

  if (!capability.cacheClasses.includes(cacheClass)) {
    if (cacheClass === 'intermediate') {
      return 'intermediate caches require Propagandists, Saboteurs, or Spies';
    }
    if (cacheClass === 'major') {
      return 'major caches require Saboteurs or Spies';
    }
  }

  return undefined;
}

function getSecureLocationWarning(assignedTeamId?: string) {
  if (!assignedTeamId) {
    return 'assign a cache-capable team first';
  }

  const capability = getSecureCacheCapability(assignedTeamId);
  if (!capability) {
    return 'assigned team is not normally allowed to Secure Cache';
  }

  return capability.secureLocation
    ? undefined
    : 'secure-location caches require Saboteurs or Spies';
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSecureCacheCapability(assignedTeamId?: string) {
  if (!assignedTeamId || !isSecureCacheTeamId(assignedTeamId)) {
    return undefined;
  }
  return SECURE_CACHE_TEAM_CAPABILITIES[assignedTeamId];
}

function isSecureCacheTeamId(teamId: string): teamId is SecureCacheTeamId {
  return teamId in SECURE_CACHE_TEAM_CAPABILITIES;
}
