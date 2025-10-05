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

export default function CreateCampaignDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const onSave = () => {
    setIsDialogOpen(false);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button>Create campaign</Button>
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
