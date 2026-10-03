'use client';
import { useId, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Input } from '~/components/ui/input';
import { describeWeapon } from './attack-routine-view-model';
import { fieldLabel, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import { WeaponChoiceCard } from './weapon-choice-card';

type Controller = ReturnType<typeof useCharacterSheet>;

// Past this many weapons the cards get a filter, so a full catalog stays
// usable on a phone.
const filterThreshold = 12;

/**
 * The weapons the Character can add under Gear, as cards. Picking one adds
 * it with its default attack routine; the card's save is acknowledged
 * beneath the cards, which stay open for another pick.
 */
export function WeaponCatalogChoices({
  id,
  attacks,
}: {
  id?: string;
  attacks: Controller['attacks'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const headingId = useId();
  const filterId = useId();
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const choices = attacks.weaponCatalog;
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? choices.filter((choice) => choice.label.toLowerCase().includes(needle))
    : choices;
  const picked = choices.find((choice) => choice.catalogEntryId === pickedId);
  const status = pickedId
    ? attacks.statusFor(`weapon:${pickedId}`)
    : ({ kind: 'idle' } as const);
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="border-foreground/20 mt-2 space-y-2 border p-2"
    >
      <h3 id={headingId} className={fieldLabel}>
        Add weapon
      </h3>
      {choices.length > filterThreshold ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={filterId} className={fieldLabel}>
            Find a weapon
          </label>
          <Input
            id={filterId}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 md:h-9"
          />
        </div>
      ) : null}
      {choices.length === 0 ? (
        <p className="text-muted-foreground text-sm">No weapons to add.</p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No weapon matches.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((choice) => (
            <li key={choice.catalogEntryId} className="min-w-0">
              <WeaponChoiceCard
                label={choice.label}
                facts={describeWeapon(choice.weapon)}
                isDisabled={
                  maintenance.readOnly ||
                  attacks.statusFor(`weapon:${choice.catalogEntryId}`).kind ===
                    'saving'
                }
                describedBy={reasonId}
                onPick={() => {
                  setPickedId(choice.catalogEntryId);
                  void attacks.addWeapon(choice.catalogEntryId);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <SaveFeedback
        status={status}
        savedText={picked ? `${picked.label} added under Gear.` : 'Added.'}
        savingText={picked ? `Adding ${picked.label}…` : 'Adding…'}
        shouldHideWhenIdle
      />
    </section>
  );
}
