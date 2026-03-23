type Id<TableName extends string> = string & { __tableName: TableName };

export interface ITeamManager {
  source: 'character' | 'freeform';
  characterId?: string;
  displayName: string;
  kind: 'pc' | 'officer_npc' | 'other_npc';
  charisma: number;
  charismaBonus: number;
  maxTeams: number;
  managedTeamCount: number;
  warnings: string[];
}

export interface IMilitia {
  _id: Id<'militia'>;
  name: string;
  campaignId: string;
  rank: number;
  highestBoonReached: number;
  HQLocation: string;
  treasury: number;
  notoriety: number;
  focus: 'Secrecy' | 'Loyalty' | 'Security' | null;
  training: number;
  ambassador?: string;
  commandant?: string;
  marshal?: string;
  overseer?: string;
  spymaster?: string;
  strategist?: string;
  teams: IMilitiaTeam[];
}

export interface ITrackedMarketplace {
  _id: string;
  label: string;
  sourceAction: 'activate_black_market' | 'broker_market';
  teamId: string;
  availabilityTier: 'small_town' | 'small_city';
  availabilityThreshold: number;
  saleValuePercent: number;
  contrabandAllowed: boolean;
  createdWeek: number;
  activeUntilWeek: number;
  marketDayDiscountPercent?: number;
  marketDayAppliedWeek?: number;
  notes?: string;
  isActive: boolean;
  pendingOrderCount: number;
  orders: IMarketplaceOrder[];
}

export interface IMarketplaceOrder {
  _id: string;
  description: string;
  notes?: string;
  costPaid?: number;
  deliveryDays: number;
  orderedWeek: number;
  dueWeek: number;
  status: 'pending' | 'delivered' | 'cancelled';
  deliveredWeek?: number;
  sourceAction?: 'special_order' | 'broker_market' | 'activate_black_market';
}

export interface IMarketplaceLedgerState {
  currentWeek?: number;
  marketplaces: ITrackedMarketplace[];
}

export interface IQueuedEffect {
  kind:
    | 'week_of_pain_checks_penalty'
    | 'double_upkeep_attrition'
    | 'week_of_serenity_checks_bonus'
    | 'double_next_activity_training_gain'
    | 'all_is_calm_auto_next_week'
    | 'auto_event_roll_once'
    | 'auto_event_roll_twice';
  appliesWeek: number;
  note?: string;
}

export interface IWeekContextState {
  weekNumber: number;
  phase: 'upkeep' | 'activity' | 'event' | 'persistent' | 'week_closed';
  isFirstWeek: boolean;
  skippedUpkeepThisWeek: boolean;
  uneventfulBonusCarry: number;
  lastPersistentBuyoffWeek?: number;
  queuedEffects: IQueuedEffect[];
}

export interface ITeamStateEntry {
  teamId: string;
  status: 'active' | 'disabled' | 'missing' | 'blocked';
  unavailableUntilWeek?: number;
  notes?: string;
}

export interface ITrackedCache {
  _id: string;
  label: string;
  cacheClass: 'minor' | 'intermediate' | 'major';
  location: string;
  contentsSummary: string;
  status: 'hidden' | 'pending_return' | 'retrieved' | 'lost';
  isSecureLocation: boolean;
  createdWeek: number;
  updatedWeek: number;
  retrievedWeek?: number;
  lostWeek?: number;
}

export interface ITrackedOrder {
  _id: string;
  description: string;
  notes?: string;
  costPaid?: number;
  deliveryDays: number;
  orderedWeek: number;
  dueWeek: number;
  status: 'pending' | 'delivered' | 'cancelled';
  deliveredWeek?: number;
  sourceAction?: 'special_order' | 'broker_market' | 'activate_black_market';
  marketplaceId?: string;
}

export interface ITrackedPerson {
  _id: string;
  characterId?: string;
  displayName: string;
  personKind: 'pc' | 'officer_npc' | 'other_npc';
  status: 'active' | 'hidden' | 'captured' | 'recovering' | 'contact';
  level?: number;
  locationType: 'hq' | 'refuge' | 'settlement' | 'site' | 'unknown';
  settlementKey?: string;
  siteName?: string;
  notes?: string;
  activeUntilWeek?: number;
  hiddenSinceWeek?: number;
  capturedSinceWeek?: number;
  rescuedWeek?: number;
  restoredWeek?: number;
  rescueDcOverride?: number;
  sourceAction?:
    | 'manual'
    | 'covert_action'
    | 'rescue_character'
    | 'restore_character'
    | 'event_raid';
}

export interface IEventStateEntry {
  _id: string;
  weekNumber: number;
  eventType:
    | 'all_is_calm'
    | 'broke_the_code'
    | 'cache_discovered'
    | 'calm_before_the_storm'
    | 'double_agent'
    | 'festival'
    | 'found_fire'
    | 'hidden_agenda'
    | 'high_morale'
    | 'invasion'
    | 'low_morale'
    | 'market_day'
    | 'missing_in_action'
    | 'night_ops'
    | 'raid'
    | 'rivalry'
    | 'roll_twice'
    | 'sickness'
    | 'theft'
    | 'turn_around'
    | 'turncoat'
    | 'war_games'
    | 'week_of_pain'
    | 'week_of_serenity';
  isPersistent: boolean;
  startedWeek: number;
  endedWeek?: number;
  mitigationUntilWeek?: number;
  resolved: boolean;
}

export interface IMilitiaStateSetup {
  currentWeekState: IWeekContextState;
  teamStates: ITeamStateEntry[];
  caches: ITrackedCache[];
  orders: ITrackedOrder[];
  trackedPeople: ITrackedPerson[];
  eventStates: IEventStateEntry[];
}

export interface ITeam {
  id: string;
  name: string;
  type: string;
  tier: number;
  size: number;
  recruitment?: { check: string; dc: number };
  grantedActions: string[];
  upgrade?: { to: string[]; cost: number };
}

export interface IMilitiaTeam extends ITeam {
  status?: 'active' | 'disabled' | 'missing' | 'blocked';
  unavailableUntilWeek?: number;
  notes?: string;
  managerSource?: 'character' | 'freeform';
  managerCharacterId?: string;
  managerName?: string;
  managerKind?: 'pc' | 'officer_npc' | 'other_npc';
  managerCharisma?: number;
  manager?: ITeamManager;
}
