type Id<TableName extends string> = string & { __tableName: TableName };

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
  teams: ITeam[];
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
