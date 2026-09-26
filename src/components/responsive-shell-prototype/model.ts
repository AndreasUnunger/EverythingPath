'use client';
// PROTOTYPE — one in-memory week made of the five settled phase prototypes
// (Activity #106 E, Upkeep #107 A, Event #108 A, Persistent #109 A, Summary
// #110 B). The shell reads readiness and militia values from them so the
// stepper, reference panel and footer show real counts at every width.

import { useReducer, useState } from 'react';
import * as activity from '~/components/activity-slots-prototype/mock';
import * as event from '~/components/event-prototype/mock';
import { bindState as bindEventState } from '~/components/event-prototype/parts';
import * as persistent from '~/components/persistent-prototype/mock';
import * as summary from '~/components/summary-prototype/mock';
import * as upkeep from '~/components/upkeep-prototype/mock';

export type Phase = 'upkeep' | 'activity' | 'event' | 'persistent' | 'summary';
export const phaseOrder: Phase[] = ['upkeep', 'activity', 'event', 'persistent', 'summary'];
export const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
  summary: 'Review & confirm',
};

export type Section = 'week' | 'history' | 'militia' | 'people';
export const sections: { key: Section; label: string; short: string }[] = [
  { key: 'week', label: 'Week 14', short: 'Week' },
  { key: 'history', label: 'Finished weeks', short: 'Finished' },
  { key: 'militia', label: 'Militia', short: 'Militia' },
  { key: 'people', label: 'Characters & officers', short: 'Characters' },
];

export const campaigns = [
  { id: 'c1', name: 'Ironfang Invasion' },
  { id: 'c2', name: 'Fangwood Keep' },
];
export const organizations = [
  { id: 'o1', name: 'Thursday table' },
  { id: 'o2', name: 'Online group' },
];

export type Knobs = {
  maintenance: boolean;
  remote: boolean;
  confirming: boolean;
  noCarried: boolean;
};

export type Step = {
  key: Phase;
  label: string;
  short: string;
  count: number;
  warnings: number;
  locked: boolean;
  caption: string;
};

export type Value = { label: string; now: string; after: string; changed: boolean };

export function useWeekModel(knobs: Knobs) {
  const [activityState, editActivity] = useReducer(activity.reduce, undefined, activity.initialState);
  const [upkeepState, editUpkeep] = useReducer(upkeep.reduce, undefined, upkeep.initialState);
  const [eventState, editEvent] = useReducer(event.reduce, undefined, event.initialTree);
  const [persistentState, editPersistent] = useReducer(persistent.reduce, undefined, persistent.initialState);
  const [summaryState, editSummary] = useReducer(summary.reduce, undefined, summary.initialState);
  bindEventState(eventState);
  const upkeepView = upkeep.project(upkeepState);
  const eventView = event.project(eventState);
  const persistentView = persistent.project(persistentState);
  const summaryView = summary.project(summaryState);
  const activityLists = activity.phaseLists(activityState);

  const issues: Record<Exclude<Phase, 'summary'>, { requirements: string[]; warnings: string[] }> = {
    upkeep: {
      requirements: upkeepView.skipped ? [] : upkeepView.requirements.map((i) => i.text),
      warnings: upkeepView.skipped ? [] : upkeepView.warnings.map((i) => i.text),
    },
    activity: activityLists,
    event: {
      requirements: eventView.requirements.map((i) => i.text),
      warnings: eventView.warnings.map((i) => i.text),
    },
    persistent: knobs.noCarried
      ? { requirements: [], warnings: [] }
      : {
          requirements: persistentView.requirements.map((i) => i.text),
          warnings: persistentView.warnings.map((i) => i.text),
        },
  };
  const open = phaseOrder
    .filter((p): p is Exclude<Phase, 'summary'> => p !== 'summary')
    .reduce((n, p) => n + issues[p].requirements.length, 0);
  const blocker = knobs.confirming
    ? 'Confirming the week…'
    : open
      ? `${open} decision${open > 1 ? 's' : ''} left`
      : summaryView.forecastPending
        ? 'Review will be ready when your changes are saved.'
        : null;

  const steps: Step[] = phaseOrder.map((key) => {
    const locked = key === 'persistent' && knobs.noCarried;
    const count = key === 'summary' ? 0 : issues[key].requirements.length;
    const warnings = key === 'summary' ? 0 : issues[key].warnings.length;
    const caption = locked
      ? 'No carried events'
      : key === 'summary'
        ? (blocker ?? 'Ready to confirm')
        : count
          ? `${count} to decide`
          : warnings
            ? `Ready · ${warnings} warning${warnings > 1 ? 's' : ''}`
            : 'Ready';
    return { key, label: phaseLabels[key], short: key === 'summary' ? 'Review' : phaseLabels[key], count, warnings, locked, caption };
  });

  const { start, final } = summaryView;
  const teams = (s: typeof final) =>
    ['active', 'disabled', 'missing']
      .map((st) => [st, s.teams.filter((t) => t.status === st).length] as const)
      .filter(([, n]) => n)
      .map(([st, n]) => `${n} ${st}`)
      .join(' · ');
  const value = (label: string, now: string | number, after: string | number): Value => ({
    label,
    now: String(now),
    after: String(after),
    changed: String(now) !== String(after),
  });
  const values: Value[] = [
    value('Rank', start.rank, final.rank),
    value('Training', start.training, final.training),
    value('Treasury', `${start.treasury} gp`, `${final.treasury} gp`),
    value('Notoriety', start.notoriety, final.notoriety),
    value('Focus', start.focus, final.focus),
    value('Teams', teams(start), teams(final)),
    value('Carried events', start.events.length, final.events.filter((e) => !e.ended).length),
    value('Actions', `${activity.used(activityState)} of ${activity.allowance}`, `${activity.used(activityState)} of ${activity.allowance}`),
    value('Event chance', `${eventView.chance}%`, `${eventView.chance}%`),
  ];

  return {
    activity: { state: activityState, edit: editActivity },
    upkeep: { state: upkeepState, view: upkeepView, edit: editUpkeep },
    event: { state: eventState, view: eventView, edit: editEvent },
    persistent: { state: persistentState, view: persistentView, edit: editPersistent },
    summary: { state: summaryState, view: summaryView, edit: editSummary },
    issues,
    steps,
    values,
    blocker,
    openDecisions: open,
  };
}

export type WeekModel = ReturnType<typeof useWeekModel>;

export function useKnobs() {
  return useState<Knobs>({ maintenance: false, remote: false, confirming: false, noCarried: false });
}
