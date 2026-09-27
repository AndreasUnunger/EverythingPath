import type { FieldPath } from 'react-hook-form';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type { MilitiaSectionKey } from '~/lib/militia-correction-sections';

// The sections with their own isolated correction, and the controls of each
// by form path, for the linked error summary. Every other correctable
// section still opens the temporary full editor until its replacement ships.

type Snapshot = CanonicalWeekState['militiaSnapshot'];
export type FieldLabels = Record<string, { label: string; numeric?: boolean }>;

const snapshotPath = 'state.militiaSnapshot';

function rowFields(
  path: string,
  count: number,
  row: (position: number) => string,
  fields: Record<string, { label: string; numeric?: boolean }>,
): FieldLabels {
  const labels: FieldLabels = {};
  for (let index = 0; index < count; index++)
    for (const [field, { label, numeric }] of Object.entries(fields))
      labels[`${path}.${index}.${field}`] = {
        label: `${row(index + 1)} ${label}`,
        numeric,
      };
  return labels;
}

const sectionFields: Partial<
  Record<MilitiaSectionKey, (snapshot: Snapshot) => FieldLabels>
> = {
  values: () => ({
    [`${snapshotPath}.focus`]: { label: 'Focus' },
    [`${snapshotPath}.rank`]: { label: 'Rank', numeric: true },
    [`${snapshotPath}.training`]: { label: 'Training', numeric: true },
    [`${snapshotPath}.treasuryCopper`]: {
      label: 'Treasury (copper)',
      numeric: true,
    },
    [`${snapshotPath}.notoriety`]: { label: 'Notoriety', numeric: true },
  }),
  teams: (snapshot) =>
    rowFields(
      `${snapshotPath}.roster.teams`,
      snapshot.roster.teams.length,
      (position) => `Team ${position}`,
      {
        name: { label: 'name' },
        teamType: { label: 'type' },
        status: { label: 'condition' },
        rewardCapExempt: { label: 'reward limit exemption' },
        managerCharacterId: { label: 'manager' },
        notes: { label: 'notes' },
      },
    ),
  settlements: (snapshot) =>
    rowFields(
      `${snapshotPath}.settlements`,
      snapshot.settlements.length,
      (position) => `Settlement ${position}`,
      {
        name: { label: 'name' },
        reputation: { label: 'reputation' },
        secured: { label: 'secured' },
        occupied: { label: 'occupied' },
        temporaryReputationShift: {
          label: 'temporary reputation shift',
          numeric: true,
        },
        reduceDangerReputationShift: {
          label: 'Reduce Danger reputation shift',
          numeric: true,
        },
        reduceDangerUntilWeek: {
          label: 'Reduce Danger end week',
          numeric: true,
        },
        refugeActivatedWeek: {
          label: 'refuge activated week',
          numeric: true,
        },
        refugeActiveUntilWeek: { label: 'refuge end week', numeric: true },
      },
    ),
};

export function hasSectionEditor(section: MilitiaSectionKey) {
  return section in sectionFields;
}

/** The section's controls in the form, labelled for the error summary. */
export function sectionFieldLabels(
  section: MilitiaSectionKey,
  snapshot: Snapshot,
): FieldLabels {
  return sectionFields[section]?.(snapshot) ?? {};
}

/** The form path of a list section's rows. */
export const sectionRowsPath: Partial<
  Record<MilitiaSectionKey, FieldPath<MilitiaSetup>>
> = {
  teams: `${snapshotPath}.roster.teams`,
  settlements: `${snapshotPath}.settlements`,
};
