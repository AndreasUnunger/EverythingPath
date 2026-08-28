import type { PointerCardDragState } from '~/lib/pointer-card-drag';
import type { MilitiaActivityActionId } from '~/lib/militia-domain';

export type WeekPhase = 'upkeep' | 'activity' | 'event' | 'persistent' | 'week_closed';

export type ActionId = MilitiaActivityActionId;

export type ActionCard = {
  id: ActionId;
  title: string;
  team: string;
  cost: string;
  fullText: string[];
};

export type MilitiaEventEntry = {
  min: number;
  max: number;
  name: string;
};

export type MilitiaEventDetails = {
  fullText: string[];
};

export type DragState = PointerCardDragState<ActionId>;

export type ResolvedEventValue =
  | { event: string; rolledValue: number }
  | { error: string }
  | null;

export type EventTriggerResolution =
  | {
      status: 'event';
      chanceValue?: number;
      rollValue?: number;
      reason?: string;
    }
  | {
      status: 'no_event';
      chanceValue: number;
      rollValue: number;
    }
  | {
      status: 'error';
      message: string;
    }
  | null;
