export const MILITIA_ACTIVITY_ACTION_IDS = [
  'activate_black_market',
  'activate_refuge',
  'broker_market',
  'change_officer_role',
  'covert_action',
  'dismiss_team',
  'drill_militia',
  'earn_gold',
  'gather_information',
  'guarantee_event',
  'knowledge_check',
  'reduce_danger',
  'manipulate_events',
  'recruit_team',
  'rescue_character',
  'restore_character',
  'secure_cache',
  'special',
  'special_order',
  'spread_propaganda',
  'strike_team',
  'upgrade_team',
  'lie_low',
] as const;

export type MilitiaActivityActionId =
  (typeof MILITIA_ACTIVITY_ACTION_IDS)[number];
