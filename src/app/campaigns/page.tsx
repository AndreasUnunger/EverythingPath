import { Sparkles } from 'lucide-react';
import { ListShell } from '~/components/campaign-shell/list-shell';
import { CampaignDashboard } from '~/components/campaign-dashboard';

export default function CampaignsPage() {
  return (
    <ListShell>
      <main className="w-full px-5 pt-8 pb-8 md:px-6 lg:px-8">
        <div className="mb-4">
          <h1 className="text-primary mb-1 flex items-center gap-3 font-sans text-5xl font-bold tracking-widest">
            <Sparkles className="h-8 w-8" />
            KEEPNET
            <Sparkles className="h-8 w-8" />
          </h1>
          <p className="text-muted-foreground font-mono text-lg tracking-wider">
            ◈ CAMPAIGN MANAGEMENT SYSTEM v0.0.1 ◈
          </p>
        </div>
        <CampaignDashboard />
      </main>
    </ListShell>
  );
}
