import { useFieldArray, useFormContext } from 'react-hook-form';
import { REPUTATION_LEVELS } from '~/lib/militia-domain';
import type { CampaignContext } from '~/lib/canonical-campaign-context';
import {
  CampaignContextField,
  CampaignContextEntry,
  CampaignContextSection,
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
      <CampaignContextSection
        title="Settlements"
        addLabel="Add settlement"
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
          <CampaignContextEntry
            key={row.id}
            label={`Settlement ${i + 1}`}
            onRemove={() => settlements.remove(i)}
          >
            <CampaignContextField
              name={`settlements.${i}.name`}
              label="Settlement name"
            />
            <CampaignContextField
              name={`settlements.${i}.reputation`}
              label="Reputation"
              choices={[
                { value: null, label: 'Unknown' },
                ...options(REPUTATION_LEVELS),
              ]}
            />
            <CampaignContextField
              name={`settlements.${i}.secured`}
              label="Secured"
              choices={yesNo}
            />
            <CampaignContextField
              name={`settlements.${i}.occupied`}
              label="Occupied"
              choices={yesNo}
            />
            <CampaignContextField
              name={`settlements.${i}.temporaryReputationShift`}
              label="Temporary reputation shift"
              numeric
            />
            <CampaignContextField
              name={`settlements.${i}.refugeActivatedWeek`}
              label="Refuge activated week"
              numeric
            />
            <CampaignContextField
              name={`settlements.${i}.refugeActiveUntilWeek`}
              label="Refuge active until week"
              numeric
            />
          </CampaignContextEntry>
        ))}
      </CampaignContextSection>
      <CampaignContextSection
        title="Items"
        addLabel="Add item"
        onAdd={() =>
          items.append({
            itemId: crypto.randomUUID(),
            name: '',
            valueCopper: null,
          })
        }
      >
        {items.fields.map((row, i) => (
          <CampaignContextEntry
            key={row.id}
            label={`Item ${i + 1}`}
            onRemove={() => items.remove(i)}
          >
            <CampaignContextField name={`items.${i}.name`} label="Item name" />
            <CampaignContextField
              name={`items.${i}.valueCopper`}
              label="Item value (copper)"
              numeric
            />
          </CampaignContextEntry>
        ))}
      </CampaignContextSection>
      <CampaignContextSection
        title="Caches"
        addLabel="Add cache"
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
          <CampaignContextEntry
            key={row.id}
            label={`Cache ${i + 1}`}
            onRemove={() => caches.remove(i)}
          >
            <CampaignContextField
              name={`caches.${i}.label`}
              label="Cache name"
            />
            <CampaignContextField
              name={`caches.${i}.location`}
              label="Location"
            />
            <CampaignContextField
              name={`caches.${i}.contents`}
              label="Contents"
            />
            <CampaignContextField
              name={`caches.${i}.cacheClass`}
              label="Cache class"
              choices={options(['minor', 'intermediate', 'major'])}
            />
            <CampaignContextField
              name={`caches.${i}.status`}
              label="Cache status"
              choices={options(['hidden', 'retrieved', 'lost'])}
            />
            <CampaignContextField
              name={`caches.${i}.secure`}
              label="Secure location"
              choices={yesNo}
            />
          </CampaignContextEntry>
        ))}
      </CampaignContextSection>
    </>
  );
}
