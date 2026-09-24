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
