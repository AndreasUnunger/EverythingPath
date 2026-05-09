import { CampaignDashboard } from '~/components/campaign-dashboard';
import { Suspense } from 'react';
import { Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <Suspense fallback={<p>loading...</p>}>
      <div className="w-full px-5 pt-12 md:px-6 lg:px-8">
        <div className="block items-center sm:flex">
          <div>
            <h1 className="text-primary mb-1 flex items-center gap-3 font-sans text-5xl font-bold tracking-widest">
              <Sparkles className="h-8 w-8" />
              KEEPNET
              <Sparkles className="h-8 w-8" />
            </h1>
            <p className="text-muted-foreground font-mono text-lg tracking-wider">
              ◈ CAMPAIGN MANAGEMENT SYSTEM v0.0.1 ◈
            </p>
          </div>
        </div>
        <CampaignDashboard />
      </div>
    </Suspense>
  );
}
