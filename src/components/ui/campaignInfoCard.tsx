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
    <Card className="bg-card corner-brackets p-2">
      <div className="flex items-center justify-between px-2">
        <div>
          <span className="text-muted-foreground pr-2 font-mono">{title}</span>
          <span className="text-primary font-mono font-bold">{value}</span>
        </div>
        {children}
      </div>
    </Card>
  );
}
