import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  EVENT_TYPES,
  MILITIA_ACTIVITY_ACTION_IDS,
  REPUTATION_LEVELS,
  TEAM_IDS,
  TEAM_STATUSES,
} from '~/lib/militia-domain';
import {
  activityActionIdValidator,
  eventTypeValidator,
  reputationValidator,
  teamIdValidator,
  teamStatusValidator,
  type weeklyResolutionChangeValidator,
  type WeeklyResolutionChange,
} from '~/lib/weekly-resolution-contract';

describe('weekly resolution contract', () => {
  it('derives literal validators from the shared militia vocabulary', () => {
    expect(
      activityActionIdValidator.members.map((member) => member.value),
    ).toEqual(MILITIA_ACTIVITY_ACTION_IDS);
    expect(teamIdValidator.members.map((member) => member.value)).toEqual(
      TEAM_IDS,
    );
    expect(eventTypeValidator.members.map((member) => member.value)).toEqual(
      EVENT_TYPES,
    );
    expect(reputationValidator.members.map((member) => member.value)).toEqual(
      REPUTATION_LEVELS,
    );
    expect(teamStatusValidator.members.map((member) => member.value)).toEqual(
      TEAM_STATUSES,
    );
  });

  it('infers the resolution change type from its validator', () => {
    expectTypeOf<WeeklyResolutionChange>().toEqualTypeOf<
      (typeof weeklyResolutionChangeValidator)['type']
    >();
  });
});
