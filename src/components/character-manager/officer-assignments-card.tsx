import type { CharacterId, CharacterRecord, MilitiaRecord, OfficerRole } from './types';
import { officerRoleLabels } from './types';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

export function OfficerAssignmentsCard({
  militia,
  activeCharacters,
  assignableCharacters,
  assignmentWarnings,
  assignmentError,
  pendingRole,
  onDismissWarnings,
  onSetOfficer,
}: {
  militia: MilitiaRecord | null | undefined;
  activeCharacters: CharacterRecord[];
  assignableCharacters: CharacterRecord[];
  assignmentWarnings: string[];
  assignmentError?: string;
  pendingRole?: OfficerRole;
  onDismissWarnings: () => void;
  onSetOfficer: (role: OfficerRole, characterId?: CharacterId) => void;
}) {
  return (
    <Card className="bg-card border-2 p-4">
      <h3 className="text-primary mb-3 font-sans text-lg font-bold">
        Officer Assignments
      </h3>
      {assignmentWarnings.length > 0 ? (
        <div className="mb-3 border border-amber-500/50 bg-amber-500/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm font-bold text-amber-700">
              Rules warning
            </p>
            <Button variant="outline" size="sm" onClick={onDismissWarnings}>
              Dismiss
            </Button>
          </div>
          <ul className="mt-1 list-disc pl-4">
            {assignmentWarnings.map((warning) => (
              <li key={warning} className="font-mono text-xs text-amber-700">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {assignmentError ? (
        <div className="border-destructive/50 bg-destructive/10 text-destructive mb-3 p-2 font-mono text-sm">
          {assignmentError}
        </div>
      ) : null}
      {!militia ? (
        <p className="text-muted-foreground font-mono text-sm">
          Create militia first to manage officers.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {officerRoleLabels.map(({ role, label }) => {
            const currentCharacterId = militia[role];
            return (
              <div key={role} className="border p-3">
                <p className="font-mono text-sm font-bold">{label}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  Current:{' '}
                  {activeCharacters.find(
                    (character) => character._id === currentCharacterId,
                  )?.name ?? 'Unassigned'}
                </p>
                <Select
                  disabled={pendingRole === role}
                  value={currentCharacterId ?? '__unassigned__'}
                  onValueChange={(value) =>
                    onSetOfficer(
                      role,
                      value === '__unassigned__'
                        ? undefined
                        : (value as CharacterId),
                    )
                  }
                >
                  <SelectTrigger className="border-primary bg-card mt-2 w-full border-2 font-mono">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent className="border-primary bg-card border-2 font-mono">
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {assignableCharacters.map((character) => (
                      <SelectItem key={character._id} value={character._id}>
                        {character.name} ({character.kind ?? 'pc'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
