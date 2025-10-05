import CreateCampaignDialog from './createCampaignDialog';
import { CampaignDashboard } from '~/components/campaign-dashboard';
import { Suspense } from 'react';
import { Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <Suspense fallback={<p>loading...</p>}>
      <div className="container mx-auto pt-12 pr-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-primary retro-glow mb-1 flex items-center gap-3 font-sans text-5xl font-bold tracking-widest">
              <Sparkles className="h-8 w-8" />
              KEEPNET
              <Sparkles className="h-8 w-8" />
            </h1>
            <p className="text-muted-foreground font-mono text-lg tracking-wider">
              ◈ CAMPAIGN MANAGEMENT SYSTEM v2.1.4 ◈
            </p>
          </div>
          <CreateCampaignDialog />
        </div>
        <CampaignDashboard />
      </div>
    </Suspense>
  );
}
