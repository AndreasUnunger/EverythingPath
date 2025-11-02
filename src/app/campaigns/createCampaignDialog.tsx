'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { CreateCampaignForm } from './createCampaignForm';
import { useState } from 'react';
import AddButton from '~/components/ui/AddButton';

export default function CreateCampaignDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const onSave = () => {
    setIsDialogOpen(false);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <AddButton title="NEW CAMPAIGN" />
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
