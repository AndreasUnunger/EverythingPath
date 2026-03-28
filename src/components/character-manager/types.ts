import type { Doc, Id } from '@convex/_generated/dataModel';
import { z } from 'zod';
import type { IMilitia } from '~/lib/types';

export type OfficerRole =
  | 'ambassador'
  | 'commandant'
  | 'marshal'
  | 'overseer'
  | 'spymaster'
  | 'strategist';

export const officerRoleLabels: { role: OfficerRole; label: string }[] = [
  { role: 'ambassador', label: 'Ambassador' },
  { role: 'commandant', label: 'Commandant' },
  { role: 'marshal', label: 'Marshal' },
  { role: 'overseer', label: 'Overseer' },
  { role: 'spymaster', label: 'Spymaster' },
  { role: 'strategist', label: 'Strategist' },
];

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

export const characterFormSchema = z.object({
  name: z.string().trim().min(1, 'Character name is required').max(100),
  description: z.string().max(500),
  kind: z.enum(['pc', 'officer_npc']),
  officerRole: z.union([
    z.literal('none'),
    z.literal('ambassador'),
    z.literal('commandant'),
    z.literal('marshal'),
    z.literal('overseer'),
    z.literal('spymaster'),
    z.literal('strategist'),
  ]),
  level: integerField('Level').refine((value) => Number(value) >= 1, {
    message: 'Level must be at least 1',
  }),
  strength: integerField('STR'),
  dexterity: integerField('DEX'),
  constitution: integerField('CON'),
  intelligence: integerField('INT'),
  wisdom: integerField('WIS'),
  charisma: integerField('CHA'),
});

export type CharacterFormValues = z.infer<typeof characterFormSchema>;

export const defaultCharacterFormValues: CharacterFormValues = {
  name: '',
  description: '',
  kind: 'pc',
  officerRole: 'none',
  level: '1',
  strength: '10',
  dexterity: '10',
  constitution: '10',
  intelligence: '10',
  wisdom: '10',
  charisma: '10',
};

export type CharacterRecord = Doc<'character'>;
export type MilitiaRecord = IMilitia;
export type CharacterId = Id<'character'>;
