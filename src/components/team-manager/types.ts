import type { Doc } from '@convex/_generated/dataModel';
import { z } from 'zod';
import type { IMilitiaTeam, ITeamManager } from '~/lib/types';

const integerField = (label: string) =>
  z.string().superRefine((raw, ctx) => {
    const value = raw.trim();
    if (!value) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} is required`,
      });
      return;
    }
    if (!/^-?\d+$/.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be a whole number`,
      });
    }
  });

export const teamManagerSourceOptions = ['none', 'character', 'freeform'] as const;
export const teamManagerKindOptions = ['pc', 'officer_npc', 'other_npc'] as const;

export const teamManagerFormSchema = z
  .object({
    managerSource: z.enum(teamManagerSourceOptions),
    managerCharacterId: z.string().optional(),
    managerName: z.string().max(100, 'Manager name must be 100 characters or fewer'),
    managerKind: z.enum(teamManagerKindOptions),
    managerCharisma: integerField('Manager Charisma').refine(
      (value) => Number(value) >= 1,
      {
        message: 'Manager Charisma must be at least 1',
      },
    ),
  })
  .superRefine((values, ctx) => {
    if (values.managerSource === 'character' && !values.managerCharacterId?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['managerCharacterId'],
        message: 'Manager character is required',
      });
    }

    if (values.managerSource === 'freeform' && !values.managerName.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['managerName'],
        message: 'Manager name is required',
      });
    }
  });

export type TeamManagerFormValues = z.infer<typeof teamManagerFormSchema>;

export const defaultTeamManagerFormValues: TeamManagerFormValues = {
  managerSource: 'none',
  managerCharacterId: '',
  managerName: '',
  managerKind: 'other_npc',
  managerCharisma: '10',
};

export type TeamRecord = IMilitiaTeam;
export type CharacterRecord = Doc<'character'>;
export type TeamManagerRecord = ITeamManager;
