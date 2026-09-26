'use client';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Doc } from '@convex/_generated/dataModel';

export type CampaignAccess = {
  campaign: Doc<'campaign'>;
  organizationId: string;
};
const CampaignContext = createContext<CampaignAccess | null>(null);

// Only the shell's access gate provides this, so page hosts never subscribe
// to campaign data before the active organization's list confirms access.
export function CampaignProvider({
  value,
  children,
}: {
  value: CampaignAccess;
  children: ReactNode;
}) {
  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign(): CampaignAccess {
  const value = useContext(CampaignContext);
  if (!value)
    throw new Error(
      'useCampaign requires the campaign shell to resolve access',
    );
  return value;
}

// The week editor announces its week number so the shell's Week link can show
// it without mounting a second Workspace subscription.
type WeekLabel = {
  week: number | null;
  setWeek: (week: number | null) => void;
};
const WeekLabelContext = createContext<WeekLabel>({
  week: null,
  setWeek: () => undefined,
});

export function WeekLabelProvider({ children }: { children: ReactNode }) {
  const [week, setWeek] = useState<number | null>(null);
  const value = useMemo(() => ({ week, setWeek }), [week]);
  return (
    <WeekLabelContext.Provider value={value}>
      {children}
    </WeekLabelContext.Provider>
  );
}

export function useWeekLabel() {
  return useContext(WeekLabelContext);
}
