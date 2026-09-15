import { CanonicalHistoryScreen } from '~/components/historical-week/screen';
export default async function CanonicalHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  return <CanonicalHistoryScreen campaign={campaign ?? null} />;
}
