export interface IMilitia {
  name: string;
  campaignId: string;
  rank: number;
  highestBoonReached: number;
  HQLocation: string;
  treasury: number;
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
