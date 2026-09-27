import type { ReactNode } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { OFFICER_ROLES } from '~/lib/canonical-roster';
import { listEditableKinds } from '~/lib/character-kind';
import { TEAM_IDS, TEAM_STATUSES } from '~/lib/militia-domain';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import {
  SetupField as Field,
  SetupEntry,
  SetupSection,
  choices,
  yesNo,
} from './fields';
const writtenKinds = ['pc', 'officer_npc', 'other_npc'] as const;
export type SetupCharacter =
  MilitiaSetup['state']['militiaSnapshot']['characters'][number] & {
    name: string;
  };
// The campaign characters that are on this roster.
function useRosterCharacters(characters: SetupCharacter[]) {
  const { watch } = useFormContext<MilitiaSetup>();
  const people = watch('state.militiaSnapshot.roster.people');
  return characters.filter((character) =>
    people.some((person) => person.characterId === character.characterId),
  );
}
export function SetupPeople({
  characters,
  preserveCharacters = false,
  addCharacter,
}: {
  characters: SetupCharacter[];
  preserveCharacters?: boolean;
  /** Creates a campaign character; roster inclusion stays a separate choice. */
  addCharacter?: ReactNode;
}) {
  const { control, watch, setValue } = useFormContext<MilitiaSetup>();
  const people = useFieldArray({
    control,
    name: 'state.militiaSnapshot.roster.people',
  });
  const roster = watch('state.militiaSnapshot.roster');
  const selected = useRosterCharacters(characters);
  return (
    <SetupSection title="Characters and officers">
      {addCharacter ? (
        <div className="flex justify-end">{addCharacter}</div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {characters
          .filter((character) => !selected.includes(character))
          .map((character) => (
            <Button
              type="button"
              key={character.characterId}
              variant="outline"
              className="h-auto min-h-16 border-2 transition-transform hover:-translate-y-1"
              onClick={() => {
                people.append({
                  characterId: character.characterId,
                  kind: 'pc',
                  hitDice: null,
                });
                const { name: _name, ...facts } = character;
                if (!preserveCharacters)
                  setValue('state.militiaSnapshot.characters', [
                    ...watch('state.militiaSnapshot.characters'),
                    facts,
                  ]);
              }}
            >
              Add {character.name}
            </Button>
          ))}
      </div>
      {people.fields.map((person, index) => (
        <SetupEntry
          key={person.id}
          label={
            characters.find(
              (character) => character.characterId === person.characterId,
            )?.name ?? `Person ${index + 1}`
          }
          onRemove={() => {
            people.remove(index);
            if (!preserveCharacters)
              setValue(
                'state.militiaSnapshot.characters',
                watch('state.militiaSnapshot.characters').filter(
                  (character) => character.characterId !== person.characterId,
                ),
              );
            setValue(
              'state.militiaSnapshot.roster.officers',
              roster.officers.filter(
                (officer) => officer.characterId !== person.characterId,
              ),
            );
            setValue(
              'state.militiaSnapshot.roster.teams',
              roster.teams.map((team) =>
                team.managerCharacterId === person.characterId
                  ? { ...team, managerCharacterId: null }
                  : team,
              ),
            );
          }}
        >
          <Field
            name={`state.militiaSnapshot.roster.people.${index}.kind`}
            label="Character kind"
            options={choices(listEditableKinds(writtenKinds, person.kind))}
          />
          <Field
            name={`state.militiaSnapshot.roster.people.${index}.hitDice`}
            label="Hit Dice"
            numeric
          />
          <div className="space-y-2 md:col-span-2">
            <p className="text-sm font-medium">Officer roles</p>
            <div className="flex flex-wrap gap-2">
              {OFFICER_ROLES.map((role) => {
                const assigned = roster.officers.some(
                  (officer) =>
                    officer.characterId === person.characterId &&
                    officer.role === role,
                );
                return (
                  <Button
                    key={role}
                    type="button"
                    variant={assigned ? 'default' : 'outline'}
                    aria-pressed={assigned}
                    onClick={() =>
                      setValue(
                        'state.militiaSnapshot.roster.officers',
                        assigned
                          ? roster.officers.filter(
                              (officer) =>
                                officer.characterId !== person.characterId ||
                                officer.role !== role,
                            )
                          : [
                              ...roster.officers,
                              { role, characterId: person.characterId },
                            ],
                      )
                    }
                  >
                    {role}
                  </Button>
                );
              })}
            </div>
          </div>
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
export function SetupTeams({ characters }: { characters: SetupCharacter[] }) {
  const { control } = useFormContext<MilitiaSetup>();
  const teams = useFieldArray({
    control,
    name: 'state.militiaSnapshot.roster.teams',
  });
  const selected = useRosterCharacters(characters);
  return (
    <SetupSection
      title="Teams"
      add="Add team"
      onAdd={() =>
        teams.append({
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
      {teams.fields.map((team, index) => (
        <SetupEntry
          key={team.id}
          label={`Team ${index + 1}`}
          onRemove={() => teams.remove(index)}
        >
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.name`}
            label="Team name"
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.teamType`}
            label="Team type"
            options={choices(TEAM_IDS)}
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.status`}
            label="Team condition"
            options={choices(TEAM_STATUSES)}
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.rewardCapExempt`}
            label="Reward team exempt from limit"
            options={yesNo}
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.managerCharacterId`}
            label="Manager"
            options={[
              { value: null, label: 'Unassigned' },
              ...selected.map((character) => ({
                value: character.characterId,
                label: character.name,
              })),
            ]}
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.notes`}
            label="Team notes"
          />
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
