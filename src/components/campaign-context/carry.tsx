import { useFieldArray, useFormContext } from 'react-hook-form';
import { MILITIA_ACTIVITY_ACTION_IDS } from '~/lib/militia-domain';
import { Button } from '~/components/ui/button';
import type { CampaignContext } from '~/lib/canonical-campaign-context';
import { FactField as F, FactEntry, FactSection, options } from './fields';
import type { NamedReference } from './events';
const effectChoices = {
  check_modifier: { kind: 'check_modifier', check: 'loyalty', value: 0 },
  event_chance: { kind: 'event_chance', value: 0 },
  block_action: { kind: 'block_action', actionId: '' },
  team_unavailable: { kind: 'team_unavailable', teamId: '' },
  narrative: { kind: 'narrative', instruction: '' },
} as const;
export function Carry({ teams }: { teams: NamedReference[] }) {
  const { control, watch, setValue } = useFormContext<CampaignContext>();
  const bonuses = useFieldArray({ control, name: 'bonuses' });
  const effects = useFieldArray({ control, name: 'queuedEffects' });
  const values = watch();
  return (
    <>
      <FactSection
        title="One-use bonuses"
        onAdd={() =>
          bonuses.append({
            bonusId: crypto.randomUUID(),
            source: '',
            check: 'loyalty',
            value: 0,
            availableWeek: null,
            consumedWeek: null,
          })
        }
      >
        {bonuses.fields.map((row, i) => (
          <FactEntry
            key={row.id}
            label={`Bonus ${i + 1}`}
            onRemove={() => bonuses.remove(i)}
          >
            <F name={`bonuses.${i}.source`} label="Bonus source" />
            <F
              name={`bonuses.${i}.check`}
              label="Applies to"
              choices={options([
                'loyalty',
                'security',
                'secrecy',
                'event_chance',
              ])}
            />
            <F name={`bonuses.${i}.value`} label="Bonus amount" numeric />
            <F
              name={`bonuses.${i}.availableWeek`}
              label="Available week"
              numeric
            />
            <F
              name={`bonuses.${i}.consumedWeek`}
              label="Consumed week"
              numeric
            />
          </FactEntry>
        ))}
      </FactSection>
      <FactSection
        title="Queued effects"
        onAdd={() =>
          effects.append({
            effectId: crypto.randomUUID(),
            sourceId: '',
            startsWeek: 0,
            endsWeek: 0,
            effect: { kind: 'narrative', instruction: '' },
          })
        }
      >
        {effects.fields.map((row, i) => {
          const effect = values.queuedEffects[i]?.effect;
          return (
            <FactEntry
              key={row.id}
              label={`Queued effect ${i + 1}`}
              onRemove={() => effects.remove(i)}
            >
              <F name={`queuedEffects.${i}.sourceId`} label="Effect source" />
              <F
                name={`queuedEffects.${i}.startsWeek`}
                label="Starts week"
                numeric
              />
              <F
                name={`queuedEffects.${i}.endsWeek`}
                label="Ends week"
                numeric
              />
              <div className="space-y-2">
                <p className="text-sm font-medium">Effect</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(effectChoices).map((choice) => (
                    <Button
                      key={choice.kind}
                      type="button"
                      variant={
                        effect?.kind === choice.kind ? 'default' : 'outline'
                      }
                      aria-pressed={effect?.kind === choice.kind}
                      onClick={() => {
                        if (effect?.kind !== choice.kind)
                          setValue(`queuedEffects.${i}.effect`, choice);
                      }}
                    >
                      {choice.kind.replaceAll('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
              {effect?.kind === 'check_modifier' && (
                <F
                  name={`queuedEffects.${i}.effect.check`}
                  label="Affected check"
                  choices={options(['loyalty', 'security', 'secrecy'])}
                />
              )}
              {(effect?.kind === 'check_modifier' ||
                effect?.kind === 'event_chance') && (
                <F
                  name={`queuedEffects.${i}.effect.value`}
                  label="Effect amount"
                  numeric
                />
              )}
              {effect?.kind === 'block_action' && (
                <F
                  name={`queuedEffects.${i}.effect.actionId`}
                  label="Blocked action"
                  choices={options(MILITIA_ACTIVITY_ACTION_IDS)}
                />
              )}
              {effect?.kind === 'team_unavailable' && (
                <F
                  name={`queuedEffects.${i}.effect.teamId`}
                  label="Unavailable team"
                  choices={teams.map((x) => ({ value: x.id, label: x.name }))}
                />
              )}
              {effect?.kind === 'narrative' && (
                <F
                  name={`queuedEffects.${i}.effect.instruction`}
                  label="Effect instruction"
                />
              )}
            </FactEntry>
          );
        })}
      </FactSection>
    </>
  );
}
