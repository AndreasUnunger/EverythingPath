import { CanonicalWorkspaceScreen } from '~/components/weekly-draft-workspace/board';
export default async function CanonicalWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  return <CanonicalWorkspaceScreen campaign={campaign ?? null} />;
}
