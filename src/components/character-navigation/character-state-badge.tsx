import { Badge } from '~/components/ui/badge';

export function CharacterStateBadge({ active }: { active: boolean }) {
  return <Badge variant="outline">{active ? 'Active' : 'Archived'}</Badge>;
}
