import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import type { CampaignContext } from '~/lib/canonical-campaign-context';
import {
  FactField as F,
  FactEntry,
  FactSection,
  options,
  yesNo,
} from './fields';

export function Orders() {
  const { control, watch, setValue } = useFormContext<CampaignContext>();
  const orders = useFieldArray({ control, name: 'orders' });
  const values = watch();
  return (
    <FactSection
      title="Orders"
      onAdd={() =>
        orders.append({
          orderId: crypto.randomUUID(),
          itemId: '',
          settlementId: null,
          orderedDay: null,
          dueDay: null,
          priceCopper: null,
          receipt: null,
          source: null,
          orderedWeek: null,
          dueActivityWeek: null,
          deliveryDays: null,
          expedited: null,
          enchantment: null,
          receiptStatus: 'unknown',
          notes: '',
        })
      }
    >
      {orders.fields.map((row, i) => (
        <FactEntry
          key={row.id}
          label={`Order ${i + 1}`}
          onRemove={() => orders.remove(i)}
        >
          <F
            name={`orders.${i}.itemId`}
            label="Ordered item"
            choices={values.items.map((x) => ({
              value: x.itemId,
              label: x.name || 'Unnamed item',
            }))}
          />
          <F
            name={`orders.${i}.settlementId`}
            label="Delivery settlement"
            choices={[
              { value: null, label: 'Unknown' },
              ...values.settlements.map((x) => ({
                value: x.settlementId,
                label: x.name || 'Unnamed settlement',
              })),
            ]}
          />
          <F
            name={`orders.${i}.source`}
            label="Order source"
            choices={[
              { value: null, label: 'Unknown' },
              ...options([
                'special_order',
                'broker_market',
                'activate_black_market',
              ]),
            ]}
          />
          <F
            name={`orders.${i}.priceCopper`}
            label="Price paid (copper)"
            numeric
          />
          <F name={`orders.${i}.orderedDay`} label="Ordered day" numeric />
          <F name={`orders.${i}.dueDay`} label="Due day" numeric />
          <F name={`orders.${i}.orderedWeek`} label="Ordered week" numeric />
          <F
            name={`orders.${i}.dueActivityWeek`}
            label="Due Activity week"
            numeric
          />
          <F
            name={`orders.${i}.deliveryDays`}
            label="Delivery duration (days)"
            numeric
          />
          <F name={`orders.${i}.expedited`} label="Expedited" choices={yesNo} />
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setValue(
                  `orders.${i}.enchantment`,
                  values.orders[i]?.enchantment
                    ? null
                    : { costCopper: 0, days: 0 },
                )
              }
            >
              {values.orders[i]?.enchantment
                ? 'Remove enchantment'
                : 'Add enchantment'}
            </Button>
            {values.orders[i]?.enchantment && (
              <>
                <F
                  name={`orders.${i}.enchantment.costCopper`}
                  label="Enchantment cost (copper)"
                  numeric
                />
                <F
                  name={`orders.${i}.enchantment.days`}
                  label="Enchantment duration (days)"
                  numeric
                />
              </>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Receipt status</p>
            <div className="flex flex-wrap gap-2">
              {(['unknown', 'unreceived', 'received'] as const).map(
                (status) => (
                  <Button
                    key={status}
                    type="button"
                    aria-pressed={values.orders[i]?.receiptStatus === status}
                    variant={
                      values.orders[i]?.receiptStatus === status
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => {
                      setValue(`orders.${i}.receiptStatus`, status);
                      setValue(
                        `orders.${i}.receipt`,
                        status === 'received'
                          ? (values.orders[i]?.receipt ?? {
                              receivedDay: NaN,
                              acknowledgementId: crypto.randomUUID(),
                            })
                          : null,
                      );
                    }}
                  >
                    {status}
                  </Button>
                ),
              )}
            </div>
            {values.orders[i]?.receipt && (
              <F
                name={`orders.${i}.receipt.receivedDay`}
                label="Received day"
                numeric
              />
            )}
          </div>
          <F name={`orders.${i}.notes`} label="Order notes / table ruling" />
        </FactEntry>
      ))}
    </FactSection>
  );
}
