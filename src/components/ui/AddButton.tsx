import { Plus } from 'lucide-react';
import { Button } from './button';
import type { Dispatch, SetStateAction } from 'react';

export default function AddButton({
  title,
  setIsDialogOpen,
}: {
  title: string;
  setIsDialogOpen?: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <Button
      onClick={() => (setIsDialogOpen ? setIsDialogOpen(true) : {})}
      className="border-primary text-primary hover:bg-primary/80 hover:text-primary-foreground pixel-border border-2 bg-transparent font-mono text-base"
    >
      <Plus className="mr-2 h-4 w-4" />
      {title}
    </Button>
  );
}
