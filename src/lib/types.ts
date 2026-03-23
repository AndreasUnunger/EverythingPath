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
}

export interface IMarketplaceLedgerState {
  currentWeek?: number;
  marketplaces: ITrackedMarketplace[];
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
