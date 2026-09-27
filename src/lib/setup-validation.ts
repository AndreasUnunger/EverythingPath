import type { z } from 'zod';
import {
  militiaSetupFieldsSchema,
  militiaSetupReferenceIssues,
  militiaSetupSchema,
  militiaSetupWarnings,
} from './canonical-setup';

// The Setup steps, shared with Militia corrections. Keys are stable; labels
// are the user-facing step names.
export const SETUP_SECTIONS = {
  startingPoint: 'Starting point',
  week: 'Week',
  people: 'People & officers',
  teams: 'Teams',
  settlements: 'Settlements',
  characterConditions: 'Character conditions',
  assets: 'Assets',
  carriedEffects: 'Carried effects',
  review: 'Review & start',
} as const;
export type SetupSectionKey = keyof typeof SETUP_SECTIONS;
export const SETUP_ASSET_SUBSECTIONS = [
  'items',
  'caches',
  'orders',
  'marketplaces',
] as const;
export type SetupAssetSubsection = (typeof SETUP_ASSET_SUBSECTIONS)[number];
export const SETUP_CARRIED_SUBSECTIONS = [
  'events',
  'queuedEffects',
  'bonuses',
  'skillBenefits',
  'marketDayBenefits',
] as const;
export type SetupCarriedSubsection = (typeof SETUP_CARRIED_SUBSECTIONS)[number];
export type SetupLocation =
  | { section: Exclude<SetupSectionKey, 'assets' | 'carriedEffects'> }
  | { section: 'assets'; subsection?: SetupAssetSubsection }
  | { section: 'carriedEffects'; subsection?: SetupCarriedSubsection };

// A message for one step. `field` is the dotted form path of the control or
// list entry that the message concerns, when there is one.
export type SetupSectionMessage = SetupLocation & {
  message: string;
  field?: string;
};
// Errors without a section belong in a visible summary. `field` errors come
// from a control's own type or format; `refinement` errors from rules across
// values, which a control may not show itself.
export type SetupErrorDescriptor = (SetupLocation | { section?: undefined }) & {
  message: string;
  field?: string;
  kind: 'field' | 'refinement';
};

type Path = readonly PropertyKey[];
const startingPointValues = new Set([
  'focus',
  'rank',
  'training',
  'treasuryCopper',
  'notoriety',
]);
const weekContext = new Set([
  'firstMilitiaWeek',
  'startDay',
  'uneventfulCarry',
  'operatedSettlementIds',
  'lastBuyoffWeek',
]);
const assetLists: Record<string, SetupAssetSubsection> = {
  items: 'items',
  caches: 'caches',
  orders: 'orders',
  markets: 'marketplaces',
};

function snapshotLocation([key, list]: Path): SetupLocation | undefined {
  if (typeof key !== 'string') return undefined;
  if (startingPointValues.has(key)) return { section: 'startingPoint' };
  switch (key) {
    case 'roster':
      return { section: list === 'teams' ? 'teams' : 'people' };
    case 'characters':
      return { section: 'people' };
    case 'settlements':
      return { section: 'settlements' };
    case 'characterActions':
      return { section: 'characterConditions' };
    case 'economy': {
      const subsection =
        typeof list === 'string' ? assetLists[list] : undefined;
      return subsection
        ? { section: 'assets', subsection }
        : { section: 'assets' };
    }
    case 'bonuses':
      return { section: 'carriedEffects', subsection: 'bonuses' };
    case 'eventBenefits':
      return list === 'skills'
        ? { section: 'carriedEffects', subsection: 'skillBenefits' }
        : list === 'markets'
          ? { section: 'carriedEffects', subsection: 'marketDayBenefits' }
          : { section: 'carriedEffects' };
  }
  return undefined;
}
function contextLocation([key]: Path): SetupLocation | undefined {
  if (typeof key !== 'string') return undefined;
  if (weekContext.has(key)) return { section: 'week' };
  switch (key) {
    case 'carriedEvents':
      return { section: 'carriedEffects', subsection: 'events' };
    case 'queuedEffects':
      return { section: 'carriedEffects', subsection: 'queuedEffects' };
    case 'orders':
      return { section: 'assets', subsection: 'orders' };
  }
  return undefined;
}

// The step (and subsection) that owns a Setup form path. Root and
// cross-section paths return undefined.
export function setupLocationForPath(path: Path): SetupLocation | undefined {
  const [key, part, ...rest] = path;
  switch (key) {
    case 'mode':
      return { section: 'startingPoint' };
    case 'phase':
      return { section: 'week' };
    case 'notes':
      return { section: 'review' };
    case 'state':
      if (part === 'week') return { section: 'week' };
      if (part === 'militiaSnapshot') return snapshotLocation(rest);
      if (part === 'context') return contextLocation(rest);
  }
  return undefined;
}

// Rules warnings for the current form values, grouped by step. Unfinished or
// structurally invalid values have none.
export function setupWarningDescriptors(values: unknown) {
  const parsed = militiaSetupSchema.safeParse(values);
  return parsed.success ? militiaSetupWarnings(parsed.data) : [];
}

const samePath = (left: Path, right: Path) =>
  left.length === right.length && left.every((key, i) => key === right[i]);

// Every validation error for the current form values, located at the step and
// entry that can repair it. Pass a stricter schema built on
// `militiaSetupSchema`, such as `militiaCorrectionSchema`, to include its
// rules.
export function setupErrorDescriptors(
  values: unknown,
  schema: z.ZodType = militiaSetupSchema,
): SetupErrorDescriptor[] {
  const result = schema.safeParse(values);
  if (result.success) return [];
  // Cross-reference issues report a root path; recompute them to learn which
  // entry each one concerns.
  const fields = militiaSetupFieldsSchema.safeParse(values);
  const references = fields.success
    ? militiaSetupReferenceIssues(fields.data)
    : [];
  return result.error.issues.map((issue) => {
    const kind = issue.code === 'custom' ? 'refinement' : 'field';
    const target =
      references.find(
        (reference) =>
          kind === 'refinement' &&
          reference.message === issue.message &&
          samePath(reference.path, issue.path),
      )?.target ?? issue.path;
    const location = setupLocationForPath(target);
    return location
      ? { ...location, field: target.join('.'), message: issue.message, kind }
      : { message: issue.message, kind };
  });
}

// Corrections need a recorded reason; everything else validates as Setup.
export const militiaCorrectionSchema = militiaSetupSchema.refine(
  (setup) => setup.notes.trim().length > 0,
  { path: ['notes'], message: 'A reason is required for this correction.' },
);

// A control's error text: empty input is "required"; other numeric input is
// malformed; any other message comes from validation.
export function setupFieldErrorMessage({
  label,
  value,
  numeric,
  decimal,
  error,
}: {
  label: string;
  value: unknown;
  numeric?: boolean;
  decimal?: boolean;
  error: string | undefined;
}) {
  if (value === null || value === undefined || value === '')
    return `${label} is required.`;
  if (numeric)
    return `Enter a valid ${decimal ? 'number' : 'whole number'} for ${label}.`;
  return error;
}
