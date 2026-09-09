import { z } from 'zod';
import {
  canonicalRosterDataSchema,
  canonicalRosterSchema,
  rosterPersonSchema,
  type CanonicalRoster,
} from '~/lib/canonical-roster';

export const rosterFormSchema = canonicalRosterDataSchema
  .extend({
    people: z
      .array(
        rosterPersonSchema.extend({
          hitDice: z
            .string()
            .refine(
              (value) =>
                value.trim() === '' ||
                (/^\d+$/.test(value.trim()) &&
                  Number.isSafeInteger(Number(value))),
              'Hit Dice must be a non-negative whole number',
            )
            .transform((value) => (value.trim() === '' ? null : Number(value))),
        }),
      )
      .max(256),
  })
  .pipe(canonicalRosterSchema);
export type RosterFormValues = z.input<typeof rosterFormSchema>;
export function rosterFormValues(roster: CanonicalRoster): RosterFormValues {
  return {
    ...roster,
    people: roster.people.map((person) => ({
      ...person,
      hitDice: person.hitDice === null ? '' : String(person.hitDice),
    })),
  };
}
