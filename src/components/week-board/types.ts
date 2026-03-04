export type WeekPhase = 'upkeep' | 'activity' | 'event' | 'persistent' | 'week_closed';

export type ActionId =
  | 'activate_black_market'
  | 'activate_refuge'
  | 'broker_market'
  | 'change_officer_role'
  | 'covert_action'
  | 'dismiss_team'
  | 'drill_militia'
  | 'earn_gold'
  | 'gather_information'
  | 'guarantee_event'
  | 'knowledge_check'
  | 'reduce_danger'
  | 'manipulate_events'
  | 'recruit_team'
  | 'rescue_character'
  | 'restore_character'
  | 'secure_cache'
  | 'special'
  | 'special_order'
  | 'spread_propaganda'
  | 'strike_team'
  | 'upgrade_team'
  | 'lie_low';

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

export type DragState = {
  actionId: ActionId;
  source: 'deck' | 'slot';
  sourceSlotIndex?: number;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

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
