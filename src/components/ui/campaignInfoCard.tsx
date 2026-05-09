import type { ReactNode } from 'react';
import { Card } from './card';

export function CampaignInfoCard({
  title,
  value,
  children,
}: {
  title: string;
  value: string | number;
  children: ReactNode;
}) {
  return (
    <Card className="bg-card corner-brackets w-full min-w-0 p-2">
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="min-w-0 whitespace-nowrap">
          <span className="text-muted-foreground pr-2 font-mono">{title}</span>
          <span className="text-primary font-mono font-bold">{value}</span>
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </Card>
  );
}
