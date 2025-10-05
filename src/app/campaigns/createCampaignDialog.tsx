'use client';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { CreateCampaignForm } from './createCampaignForm';
import { useState } from 'react';
import { Plus } from 'lucide-react';

export default function CreateCampaignDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const onSave = () => {
    setIsDialogOpen(false);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground pixel-border border-2 bg-transparent font-mono text-base"
        >
          <Plus className="mr-2 h-5 w-5" />
          NEW CAMPAIGN
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="mb-4">Create campaign</DialogTitle>
          <CreateCampaignForm onSave={onSave} />
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
