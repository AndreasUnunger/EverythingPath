import { useFieldArray, useFormContext } from 'react-hook-form';
import { REPUTATION_LEVELS } from '~/lib/militia-domain';
import type { CampaignContext } from '~/lib/canonical-campaign-context';
import {
  FactField as F,
  FactEntry,
  FactSection,
  options,
  yesNo,
} from './fields';

export function SettlementAssets() {
  const { control } = useFormContext<CampaignContext>();
  const settlements = useFieldArray({ control, name: 'settlements' });
  const items = useFieldArray({ control, name: 'items' });
  const caches = useFieldArray({ control, name: 'caches' });
  return (
    <>
      <FactSection
        title="Settlements"
        onAdd={() =>
          settlements.append({
            settlementId: crypto.randomUUID(),
            name: '',
            reputation: null,
            secured: null,
            occupied: null,
            temporaryReputationShift: null,
            refugeActivatedWeek: null,
            refugeActiveUntilWeek: null,
          })
        }
      >
        {settlements.fields.map((row, i) => (
          <FactEntry
            key={row.id}
            label={`Settlement ${i + 1}`}
            onRemove={() => settlements.remove(i)}
          >
            <F name={`settlements.${i}.name`} label="Settlement name" />
            <F
              name={`settlements.${i}.reputation`}
              label="Reputation"
              choices={[
                { value: null, label: 'Unknown' },
                ...options(REPUTATION_LEVELS),
              ]}
            />
            <F
              name={`settlements.${i}.secured`}
              label="Secured"
              choices={yesNo}
            />
            <F
              name={`settlements.${i}.occupied`}
              label="Occupied"
              choices={yesNo}
            />
            <F
              name={`settlements.${i}.temporaryReputationShift`}
              label="Temporary reputation shift"
              numeric
            />
            <F
              name={`settlements.${i}.refugeActivatedWeek`}
              label="Refuge activated week"
              numeric
            />
            <F
              name={`settlements.${i}.refugeActiveUntilWeek`}
              label="Refuge active until week"
              numeric
            />
          </FactEntry>
        ))}
      </FactSection>
      <FactSection
        title="Items"
        onAdd={() =>
          items.append({
            itemId: crypto.randomUUID(),
            name: '',
            valueCopper: null,
          })
        }
      >
        {items.fields.map((row, i) => (
          <FactEntry
            key={row.id}
            label={`Item ${i + 1}`}
            onRemove={() => items.remove(i)}
          >
            <F name={`items.${i}.name`} label="Item name" />
            <F
              name={`items.${i}.valueCopper`}
              label="Item value (copper)"
              numeric
            />
          </FactEntry>
        ))}
      </FactSection>
      <FactSection
        title="Caches"
        onAdd={() =>
          caches.append({
            cacheId: crypto.randomUUID(),
            label: '',
            location: '',
            contents: '',
            cacheClass: 'minor',
            status: 'hidden',
            secure: null,
          })
        }
      >
        {caches.fields.map((row, i) => (
          <FactEntry
            key={row.id}
            label={`Cache ${i + 1}`}
            onRemove={() => caches.remove(i)}
          >
            <F name={`caches.${i}.label`} label="Cache name" />
            <F name={`caches.${i}.location`} label="Location" />
            <F name={`caches.${i}.contents`} label="Contents" />
            <F
              name={`caches.${i}.cacheClass`}
              label="Cache class"
              choices={options(['minor', 'intermediate', 'major'])}
            />
            <F
              name={`caches.${i}.status`}
              label="Cache status"
              choices={options(['hidden', 'retrieved', 'lost'])}
            />
            <F
              name={`caches.${i}.secure`}
              label="Secure location"
              choices={yesNo}
            />
          </FactEntry>
        ))}
      </FactSection>
    </>
  );
}
