import type { Phase } from './types';

const order: Phase[] = ['upkeep', 'activity', 'event', 'persistent', 'summary'];

/** Attribute edited targets to their hosted controls, not downstream forecasts. */
export function changedPhases(
  targets: readonly (readonly string[])[],
): Phase[] {
  const phases = new Set<Phase>();
  for (const path of targets) {
    switch (path[0]) {
      case 'upkeep':
        phases.add('upkeep');
        break;
      case 'activity':
        phases.add('activity');
        break;
      case 'slot':
        if (path[2] === 'choice' && path[3] === 'acknowledgements')
          phases.add('summary');
        else if (path[2] === 'choice' && path[3] === 'candidates')
          phases.add(path[5] === 'persistentDecision' ? 'persistent' : 'event');
        else phases.add('activity');
        break;
      case 'event':
        phases.add(path[3] === 'persistentDecision' ? 'persistent' : 'event');
        break;
      case 'persistent':
        phases.add('persistent');
        break;
      case 'acknowledgement':
      case 'exception':
      case 'tableAdjustments':
        phases.add('summary');
        break;
      // Standalone order receipts currently have no hosted editing control.
    }
  }
  return order.filter((phase) => phases.has(phase));
}
