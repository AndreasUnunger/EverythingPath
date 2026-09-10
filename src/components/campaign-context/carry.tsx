import { useFieldArray, useFormContext } from 'react-hook-form';
import { MILITIA_ACTIVITY_ACTION_IDS } from '~/lib/militia-domain';
import { Button } from '~/components/ui/button';
import type { CampaignContext } from '~/lib/canonical-campaign-context';
import {
  CampaignContextField,
  CampaignContextEntry,
  CampaignContextSection,
  options,
} from './fields';
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
      <CampaignContextSection
        title="One-use bonuses"
        addLabel="Add one-use bonus"
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
          <CampaignContextEntry
            key={row.id}
            label={`Bonus ${i + 1}`}
            onRemove={() => bonuses.remove(i)}
          >
            <CampaignContextField
              name={`bonuses.${i}.source`}
              label="Bonus source"
            />
            <CampaignContextField
              name={`bonuses.${i}.check`}
              label="Applies to"
              choices={options([
                'loyalty',
                'security',
                'secrecy',
                'event_chance',
              ])}
            />
            <CampaignContextField
              name={`bonuses.${i}.value`}
              label="Bonus amount"
              numeric
            />
            <CampaignContextField
              name={`bonuses.${i}.availableWeek`}
              label="Available week"
              numeric
            />
            <CampaignContextField
              name={`bonuses.${i}.consumedWeek`}
              label="Consumed week"
              numeric
            />
          </CampaignContextEntry>
        ))}
      </CampaignContextSection>
      <CampaignContextSection
        title="Queued effects"
        addLabel="Add queued effect"
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
            <CampaignContextEntry
              key={row.id}
              label={`Queued effect ${i + 1}`}
              onRemove={() => effects.remove(i)}
            >
              <CampaignContextField
                name={`queuedEffects.${i}.sourceId`}
                label="Effect source"
              />
              <CampaignContextField
                name={`queuedEffects.${i}.startsWeek`}
                label="Starts week"
                numeric
              />
              <CampaignContextField
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
                          setValue(`queuedEffects.${i}.effect`, choice, {
                            shouldDirty: true,
                          });
                      }}
                    >
                      {choice.kind.replaceAll('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
              {effect?.kind === 'check_modifier' && (
                <CampaignContextField
                  name={`queuedEffects.${i}.effect.check`}
                  label="Affected check"
                  choices={options(['loyalty', 'security', 'secrecy'])}
                />
              )}
              {(effect?.kind === 'check_modifier' ||
                effect?.kind === 'event_chance') && (
                <CampaignContextField
                  name={`queuedEffects.${i}.effect.value`}
                  label="Effect amount"
                  numeric
                />
              )}
              {effect?.kind === 'block_action' && (
                <CampaignContextField
                  name={`queuedEffects.${i}.effect.actionId`}
                  label="Blocked action"
                  choices={options(MILITIA_ACTIVITY_ACTION_IDS)}
                />
              )}
              {effect?.kind === 'team_unavailable' && (
                <CampaignContextField
                  name={`queuedEffects.${i}.effect.teamId`}
                  label="Unavailable team"
                  choices={teams.map((x) => ({ value: x.id, label: x.name }))}
                />
              )}
              {effect?.kind === 'narrative' && (
                <CampaignContextField
                  name={`queuedEffects.${i}.effect.instruction`}
                  label="Effect instruction"
                />
              )}
            </CampaignContextEntry>
          );
        })}
      </CampaignContextSection>
    </>
  );
}
