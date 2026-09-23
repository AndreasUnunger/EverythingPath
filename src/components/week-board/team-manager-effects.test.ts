import { describe, expect, it } from 'vitest';
import {
  getActionTeamManagerParts,
  getManipulateEventsManagerText,
  getSelectedTeamManagerWarnings,
  getTeamManagerBonusForTeamId,
  getTeamManagerSummary,
} from './team-manager-effects';

describe('team manager week-board helpers', () => {
  it('builds a summary string for a selected team manager', () => {
    expect(
      getTeamManagerSummary({
        teamId: 'moles',
        manager: {
          displayName: 'Quartermaster',
          charismaBonus: 3,
          maxTeams: 2,
          managedTeamCount: 1,
          warnings: [],
        },
      }),
    ).toBe('Quartermaster manager CHA bonus +3 • managing 1/2 teams');
  });

  it('returns undefined summary when no manager is assigned', () => {
    expect(
      getTeamManagerSummary({
        teamId: 'moles',
        manager: null,
      }),
    ).toBeUndefined();
  });

  it('returns manager warnings for the selected team', () => {
    expect(
      getSelectedTeamManagerWarnings({
        teamId: 'moles',
        manager: {
          displayName: 'Quartermaster',
          charismaBonus: 0,
          maxTeams: 1,
          managedTeamCount: 2,
          warnings: ['Managing 2 teams exceeds the normal limit of 1.'],
        },
      }),
    ).toEqual(['Managing 2 teams exceeds the normal limit of 1.']);
  });

  it('describes a single staged team manager bonus for an action', () => {
    expect(
      getActionTeamManagerParts({
        actionId: 'earn_gold',
        stagedActionIds: ['earn_gold', 'drill_militia'],
        slotTeams: ['merchants', null],
        teams: [
          {
            teamId: 'merchants',
            manager: {
              displayName: 'Quartermaster',
              charismaBonus: 3,
              maxTeams: 2,
              managedTeamCount: 1,
              warnings: [],
            },
          },
        ],
      }),
    ).toEqual(['Quartermaster manager CHA bonus +3']);
  });

  it('collapses multiple staged team manager bonuses when they match', () => {
    expect(
      getActionTeamManagerParts({
        actionId: 'gather_information',
        stagedActionIds: ['gather_information', 'gather_information'],
        slotTeams: ['moles', 'informants'],
        teams: [
          {
            teamId: 'moles',
            manager: {
              displayName: 'Scoutmaster',
              charismaBonus: 2,
              maxTeams: 3,
              managedTeamCount: 1,
              warnings: [],
            },
          },
          {
            teamId: 'informants',
            manager: {
              displayName: 'Watcher',
              charismaBonus: 2,
              maxTeams: 2,
              managedTeamCount: 1,
              warnings: [],
            },
          },
        ],
      }),
    ).toEqual(['team manager CHA bonus +2 across staged teams']);
  });

  it('reports when staged team manager bonuses vary', () => {
    expect(
      getActionTeamManagerParts({
        actionId: 'reduce_danger',
        stagedActionIds: ['reduce_danger', 'reduce_danger'],
        slotTeams: ['guardians', 'saboteurs'],
        teams: [
          {
            teamId: 'guardians',
            manager: {
              displayName: 'Captain Ivet',
              charismaBonus: 1,
              maxTeams: 2,
              managedTeamCount: 1,
              warnings: [],
            },
          },
          {
            teamId: 'saboteurs',
            manager: {
              displayName: 'Shade',
              charismaBonus: 4,
              maxTeams: 4,
              managedTeamCount: 1,
              warnings: [],
            },
          },
        ],
      }),
    ).toEqual(['team manager bonuses vary across staged teams']);
  });

  it('shows shared event selection guidance with or without a manager', () => {
    expect(
      getManipulateEventsManagerText({
        stagedActionIds: ['manipulate_events', ''],
        slotTeams: ['guardians', null],
        teams: [
          {
            teamId: 'guardians',
            manager: {
              displayName: 'Captain Ivet',
              charismaBonus: 1,
              maxTeams: 2,
              managedTeamCount: 1,
              warnings: [],
            },
          },
        ],
      }),
    ).toBe('Any player can choose which guaranteed event occurs.');

    expect(
      getManipulateEventsManagerText({
        stagedActionIds: ['manipulate_events'],
        slotTeams: ['guardians'],
        teams: [
          {
            teamId: 'guardians',
            manager: null,
          },
        ],
      }),
    ).toBe('Any player can choose which guaranteed event occurs.');
  });

  it('returns the selected team manager bonus by team id', () => {
    const teams = [
      {
        teamId: 'guardians',
        manager: {
          displayName: 'Captain Ivet',
          charismaBonus: 1,
          maxTeams: 2,
          managedTeamCount: 1,
          warnings: [],
        },
      },
    ];

    expect(getTeamManagerBonusForTeamId('guardians', teams)).toBe(1);
    expect(getTeamManagerBonusForTeamId('saboteurs', teams)).toBeUndefined();
    expect(getTeamManagerBonusForTeamId(undefined, teams)).toBeUndefined();
  });
});
