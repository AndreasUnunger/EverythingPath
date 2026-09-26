// PROTOTYPE — throwaway route for Wayfinder #118. Lives only on `prototype/campaign-home`.
import { Suspense } from 'react';
import { CampaignHomePrototype } from '~/components/campaign-home-prototype';

export default function CampaignHomePrototypePage() {
  return (
    <Suspense>
      <CampaignHomePrototype />
    </Suspense>
  );
}
