import { z } from 'zod';
import { CanonicalWorkspaceScreen } from '~/components/weekly-draft-workspace/board';
export default async function CanonicalWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; phase?: string }>;
}) {
  const { campaign, phase } = await searchParams;
  const parsed = z
    .enum(['upkeep', 'activity', 'event', 'persistent', 'summary'])
    .safeParse(phase);
  return (
    <CanonicalWorkspaceScreen
      campaign={campaign ?? null}
      initialPhase={parsed.success ? parsed.data : undefined}
    />
  );
}
