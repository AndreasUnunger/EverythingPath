import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import type { CanonicalRoster, RosterCharacter } from '~/lib/canonical-roster';
import { TEAM_IDS, TEAM_STATUSES } from '~/lib/militia-domain';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { ChoiceCards } from './choice-cards';
import { title } from './people-fields';
import type { RosterFormValues } from './form';

export function TeamFields({
  form,
  characters,
}: {
  form: UseFormReturn<RosterFormValues, unknown, CanonicalRoster>;
  characters: RosterCharacter[];
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'teams',
  });
  const teams = form.watch('teams');
  const people = form.watch('people');
  return (
    <section aria-label="Individual teams" className="space-y-4">
      <h3 className="font-sans text-xl font-bold">Individual teams</h3>
      {fields.map((field, index) => {
        const team = teams[index]!;
        const nameError = form.formState.errors.teams?.[index]?.name?.message;
        const notesError = form.formState.errors.teams?.[index]?.notes?.message;
        return (
          <div key={field.id} className="space-y-3 border-2 p-4">
            <div className="space-y-1">
              <Label htmlFor={`team-name-${field.id}`}>
                Team {index + 1} name
              </Label>
              <Input
                id={`team-name-${field.id}`}
                aria-invalid={!!nameError}
                aria-describedby={
                  nameError ? `team-name-error-${field.id}` : undefined
                }
                {...form.register(`teams.${index}.name`)}
              />
              {nameError && (
                <p
                  id={`team-name-error-${field.id}`}
                  className="text-destructive text-sm"
                >
                  {nameError}
                </p>
              )}
            </div>
            <ChoiceCards
              label={`Team ${index + 1} type`}
              choices={TEAM_IDS.map((value) => ({
                value,
                label: title(value),
              }))}
              selected={[team.teamType]}
              onSelect={(value) =>
                form.setValue(`teams.${index}.teamType`, value, {
                  shouldDirty: true,
                })
              }
            />
            <ChoiceCards
              label={`Team ${index + 1} condition`}
              choices={TEAM_STATUSES.map((value) => ({
                value,
                label: title(value),
              }))}
              selected={[team.status]}
              onSelect={(value) =>
                form.setValue(`teams.${index}.status`, value, {
                  shouldDirty: true,
                })
              }
            />
            <ChoiceCards
              label={`Team ${index + 1} manager`}
              choices={[
                { value: '', label: 'Unassigned' },
                ...characters
                  .filter((character) =>
                    people.some(
                      (person) => person.characterId === character.characterId,
                    ),
                  )
                  .map((character) => ({
                    value: character.characterId,
                    label: character.name,
                  })),
              ]}
              selected={[team.managerCharacterId ?? '']}
              onSelect={(value) =>
                form.setValue(
                  `teams.${index}.managerCharacterId`,
                  value || null,
                  { shouldDirty: true },
                )
              }
            />
            <Button
              type="button"
              variant={team.rewardCapExempt ? 'default' : 'outline'}
              aria-pressed={team.rewardCapExempt}
              onClick={() =>
                form.setValue(
                  `teams.${index}.rewardCapExempt`,
                  !team.rewardCapExempt,
                  { shouldDirty: true },
                )
              }
            >
              Team {index + 1}: Reward team — exempt from team limit
            </Button>
            <div className="space-y-1">
              <Label htmlFor={`team-notes-${field.id}`}>
                Team {index + 1} notes / override reason
              </Label>
              <Input
                id={`team-notes-${field.id}`}
                aria-invalid={!!notesError}
                aria-describedby={
                  notesError ? `team-notes-error-${field.id}` : undefined
                }
                {...form.register(`teams.${index}.notes`)}
              />
              {notesError && (
                <p
                  id={`team-notes-error-${field.id}`}
                  className="text-destructive text-sm"
                >
                  {notesError}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => remove(index)}
            >
              Remove team {index + 1}
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            teamId: crypto.randomUUID(),
            name: '',
            teamType: 'defenders',
            status: 'active',
            rewardCapExempt: false,
            managerCharacterId: null,
            notes: '',
          })
        }
      >
        Add team
      </Button>
    </section>
  );
}
