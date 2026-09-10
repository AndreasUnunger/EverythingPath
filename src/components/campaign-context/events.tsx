import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { EVENT_TYPES } from '~/lib/militia-domain';
import type { CampaignContext } from '~/lib/canonical-campaign-context';
import {
  FactField as F,
  FactEntry,
  FactErrors,
  FactSection,
  options,
  yesNo,
} from './fields';

export type NamedReference = { id: string; name: string };
export function Events({
  teams,
  characters,
}: {
  teams: NamedReference[];
  characters: NamedReference[];
}) {
  const { control, watch, setValue } = useFormContext<CampaignContext>();
  const events = useFieldArray({ control, name: 'events' });
  const values = watch();
  const targets = [
    ...values.settlements.map((x) => ({
      label: x.name,
      target: { kind: 'settlement' as const, settlementId: x.settlementId },
    })),
    ...values.items.map((x) => ({
      label: x.name,
      target: { kind: 'item' as const, itemId: x.itemId },
    })),
    ...values.caches.map((x) => ({
      label: x.label,
      target: { kind: 'cache' as const, cacheId: x.cacheId },
    })),
    ...values.events.map((x, i) => ({
      label: `Event ${i + 1}: ${x.eventType.replaceAll('_', ' ')}`,
      target: { kind: 'event' as const, eventId: x.eventId },
    })),
    ...teams.map((x) => ({
      label: x.name,
      target: { kind: 'team' as const, teamId: x.id },
    })),
    ...characters.map((x) => ({
      label: x.name,
      target: { kind: 'character' as const, characterId: x.id },
    })),
  ];
  return (
    <FactSection
      title="Events"
      onAdd={() =>
        events.append({
          eventId: crypto.randomUUID(),
          eventType: 'sickness',
          startedWeek: null,
          order: null,
          targets: null,
          persistent: true,
          resolved: false,
          mitigationUntilWeek: null,
          endedWeek: null,
          notes: '',
        })
      }
    >
      {events.fields.map((row, i) => (
        <FactEntry
          key={row.id}
          label={`Event ${i + 1}`}
          onRemove={() => events.remove(i)}
        >
          <F
            name={`events.${i}.eventType`}
            label="Event type"
            choices={options(EVENT_TYPES)}
          />
          <F name={`events.${i}.startedWeek`} label="Started week" numeric />
          <F name={`events.${i}.order`} label="Processing order" numeric />
          <F
            name={`events.${i}.persistent`}
            label="Persistent"
            choices={yesNo.slice(1)}
          />
          <F
            name={`events.${i}.resolved`}
            label="Initial outcome resolved"
            choices={yesNo.slice(1)}
          />
          <F
            name={`events.${i}.mitigationUntilWeek`}
            label="Mitigated through week"
            numeric
          />
          <F name={`events.${i}.endedWeek`} label="Ended week" numeric />
          <div className="space-y-2">
            <p className="text-sm font-medium">Event targets</p>
            <FactErrors name={`events.${i}.targets`} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                aria-pressed={values.events[i]?.targets === null}
                onClick={() => setValue(`events.${i}.targets`, null)}
              >
                Unknown targets
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-pressed={values.events[i]?.targets?.length === 0}
                onClick={() => setValue(`events.${i}.targets`, [])}
              >
                No targets
              </Button>
              {targets.map(({ label, target }) => {
                const selected = values.events[i]?.targets?.some(
                  (x) => JSON.stringify(x) === JSON.stringify(target),
                );
                return (
                  <Button
                    key={JSON.stringify(target)}
                    type="button"
                    className="h-auto min-h-12 border-2 whitespace-normal transition-transform hover:-translate-y-1"
                    variant={selected ? 'default' : 'outline'}
                    aria-pressed={!!selected}
                    onClick={() =>
                      setValue(
                        `events.${i}.targets`,
                        selected
                          ? (values.events[i]?.targets ?? []).filter(
                              (x) =>
                                JSON.stringify(x) !== JSON.stringify(target),
                            )
                          : [...(values.events[i]?.targets ?? []), target],
                      )
                    }
                  >
                    {target.kind}: {label || 'Unnamed'}
                  </Button>
                );
              })}
            </div>
          </div>
          <F name={`events.${i}.notes`} label="Event notes / table ruling" />
        </FactEntry>
      ))}
    </FactSection>
  );
}
