import type { Doc, Id } from '@convex/_generated/dataModel';
import { z } from 'zod';
import { characterRecordKindSchema } from '~/lib/character-kind';

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
  // This form still writes PC or Officer NPC; a stored npc round-trips unchanged.
  kind: characterRecordKindSchema,
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
  level: '1',
  strength: '10',
  dexterity: '10',
  constitution: '10',
  intelligence: '10',
  wisdom: '10',
  charisma: '10',
};

// The record fields a valid form submits.
export function characterPayload(values: CharacterFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    kind: values.kind,
    level: Number(values.level),
    strength: Number(values.strength),
    dexterity: Number(values.dexterity),
    constitution: Number(values.constitution),
    wisdom: Number(values.wisdom),
    charisma: Number(values.charisma),
    intelligence: Number(values.intelligence),
  };
}

export function characterErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export type CharacterRecord = Doc<'character'>;
export type CharacterId = Id<'character'>;
