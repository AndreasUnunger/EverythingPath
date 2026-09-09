import type { UseFormReturn } from 'react-hook-form';
import {
  OFFICER_ROLES,
  type CanonicalRoster,
  type RosterCharacter,
} from '~/lib/canonical-roster';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { ChoiceCards } from './choice-cards';
import type { RosterFormValues } from './form';

export const title = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
export function PeopleFields({
  form,
  characters,
}: {
  form: UseFormReturn<RosterFormValues, unknown, CanonicalRoster>;
  characters: RosterCharacter[];
}) {
  const people = form.watch('people');
  const officers = form.watch('officers');
  return (
    <section aria-label="People and officers" className="space-y-4">
      <h3 className="font-sans text-xl font-bold">People and officers</h3>
      {people.map((person, index) => {
        const name =
          characters.find(
            (character) => character.characterId === person.characterId,
          )?.name ?? 'Unavailable character';
        const error = form.formState.errors.people?.[index]?.hitDice?.message;
        return (
          <div key={person.characterId} className="space-y-3 border-2 p-4">
            <h4 className="font-sans text-lg font-bold">{name}</h4>
            <div className="space-y-1">
              <Label htmlFor={`hit-dice-${person.characterId}`}>
                {name} Hit Dice
              </Label>
              <Input
                id={`hit-dice-${person.characterId}`}
                inputMode="numeric"
                aria-invalid={!!error}
                aria-describedby={`hit-dice-help-${person.characterId}`}
                {...form.register(`people.${index}.hitDice`)}
              />
              <p
                id={`hit-dice-help-${person.characterId}`}
                className={
                  error
                    ? 'text-destructive text-sm'
                    : 'text-muted-foreground text-xs'
                }
              >
                {error ??
                  'Leave blank if unknown. Enter actual Hit Dice when known.'}
              </p>
            </div>
            <ChoiceCards
              label={`${name} kind`}
              choices={[
                { value: 'pc', label: 'Player character' },
                { value: 'officer_npc', label: 'Officer NPC' },
                { value: 'other_npc', label: 'Other NPC' },
              ]}
              selected={[person.kind]}
              onSelect={(value) =>
                form.setValue(`people.${index}.kind`, value, {
                  shouldDirty: true,
                })
              }
            />
            <ChoiceCards
              label={name}
              choices={OFFICER_ROLES.map((role) => ({
                value: role,
                label: title(role),
              }))}
              selected={officers
                .filter((officer) => officer.characterId === person.characterId)
                .map((officer) => officer.role)}
              onSelect={(role) => {
                const assigned = officers.some(
                  (officer) =>
                    officer.role === role &&
                    officer.characterId === person.characterId,
                );
                form.setValue(
                  'officers',
                  assigned
                    ? officers.filter(
                        (officer) =>
                          officer.role !== role ||
                          officer.characterId !== person.characterId,
                      )
                    : [...officers, { role, characterId: person.characterId }],
                  { shouldDirty: true },
                );
              }}
            />
          </div>
        );
      })}
      <ChoiceCards
        label="Add person"
        choices={characters
          .filter(
            (character) =>
              !people.some(
                (person) => person.characterId === character.characterId,
              ),
          )
          .map((character) => ({
            value: character.characterId,
            label: character.name,
          }))}
        selected={[]}
        onSelect={(characterId) =>
          form.setValue(
            'people',
            [...people, { characterId, kind: 'pc', hitDice: '' }],
            { shouldDirty: true },
          )
        }
      />
    </section>
  );
}
