import { MilitiaSetupScreen } from '~/components/militia-setup/screen';
export default async function CanonicalSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  return <MilitiaSetupScreen campaign={campaign ?? null} />;
}
