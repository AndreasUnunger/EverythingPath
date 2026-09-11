'use client';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { WorkspaceGateway } from './gateway';
import { createWorkspace } from './store';
const GatewayContext = createContext<WorkspaceGateway | null>(null);
// The environment binds the campaign; phase presentation crosses only the hook.
export function WeeklyDraftWorkspaceProvider({
  gateway,
  children,
}: {
  gateway: WorkspaceGateway | null;
  children: ReactNode;
}) {
  return (
    <GatewayContext.Provider value={gateway}>
      {children}
    </GatewayContext.Provider>
  );
}
export function useWeeklyDraftWorkspace() {
  const gateway = useContext(GatewayContext);
  const workspace = useMemo(() => createWorkspace(gateway), [gateway]);
  useEffect(() => workspace.start(), [workspace]);
  return useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
}
