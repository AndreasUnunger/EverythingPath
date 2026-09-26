// PROTOTYPE — derivations every variant needs, so each variant file is layout only.

import type { Dispatch } from 'react';
import { type Action, type Screen, errorsFor, type Problem, type Role, rolesOf, type Row, type SectionKey, sectionByKey, setupSteps, type Snapshot, type State, warningsFor } from './mock';

export type VariantProps = { state: State; dispatch: Dispatch<Action>; screen: Screen; go: (s: Screen) => void };

export function setupModel(state: State) {
  const draft = state.setup.draft;
  const errors = errorsFor(draft);
  const warnings = warningsFor(draft);
  const steps = setupSteps.map((step, index) => {
    const stepErrors = errors.filter((e) => step.sections.includes(e.section as SectionKey));
    const stepWarnings = warnings.filter((w) => step.sections.includes(w.section as SectionKey));
    const empty = step.sections.every((k) => sectionByKey(k).blocks.every((b) => !b.single && (draft[b.key] as Row[]).length === 0));
    const optional = !!step.optional && state.scenario.mode === 'new';
    const visited = state.setup.visited.includes(index);
    const caption =
      step.key === 'review'
        ? errors.length
          ? `${errors.length} to fix`
          : 'Ready to start'
        : stepErrors.length && (visited || state.setup.attempted)
          ? `${stepErrors.length} to fix`
          : optional && empty
            ? 'Optional · skipped'
            : stepWarnings.length
              ? `${stepWarnings.length} warning${stepWarnings.length > 1 ? 's' : ''}`
              : visited
                ? 'Done'
                : '';
    return { ...step, index, errors: stepErrors, warnings: stepWarnings, empty, optional, visited, caption, blocks: step.sections.flatMap((k) => sectionByKey(k).blocks) };
  });
  const current = steps[state.setup.step]!;
  const showErrors = state.setup.attempted || state.setup.visited.includes(state.setup.step);
  return { draft, errors, warnings, steps, current, showErrors };
}

export const stepForProblem = (p: Problem) => setupSteps.findIndex((s) => s.sections.includes(p.section as SectionKey));

export const correctable = (): SectionKey[] => ['values', 'teams', 'settlements', 'conditions', 'items', 'caches', 'orders', 'marketplaces', 'benefits'];

// Roster edits used by the Characters & officers screen (people section).
export const toggleRoster = (id: string) => (s: Snapshot): Snapshot => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, onRoster: p.onRoster === false } : p)) });
export const setPerson = (id: string, key: string, value: string | boolean) => (s: Snapshot): Snapshot => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, [key]: value } : p)) });
export const assignRole = (role: Role, id: string) => (s: Snapshot): Snapshot => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, roles: [...new Set([...rolesOf(p), role])].join(', ') } : p)) });
export const removeRole = (role: Role, id: string) => (s: Snapshot): Snapshot => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, roles: rolesOf(p).filter((r) => r !== role).join(', ') } : p)) });

// Start militia week: blocks on errors, otherwise starts and leaves setup.
export const startMilitia = ({ state, dispatch, go }: VariantProps) => {
  if (errorsFor(state.setup.draft).length) return dispatch({ kind: 'setup:attempt' });
  dispatch({ kind: 'setup:start' });
  go('militia');
};

export const sectionWarnings = (s: Snapshot, key: SectionKey | 'carried') => warningsFor(s).filter((w) => w.section === key);
export const correctionLocked = (state: State, key: SectionKey | 'people') => !!state.correction && state.correction.section !== key;
