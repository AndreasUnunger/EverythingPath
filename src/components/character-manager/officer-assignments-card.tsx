import type { RefObject } from 'react';
import type {
  CharacterId,
  CharacterRecord,
  MilitiaRecord,
  OfficerRole,
} from './types';
import { officerRoleLabels } from './types';
import { Button } from '~/components/ui/button';
import type { PointerCardDragState } from '~/lib/pointer-card-drag';

export function OfficerAssignmentsCard({
  militia,
  activeCharacters,
  assignmentWarnings,
  assignmentError,
  pendingRole,
  dragState,
  activeDropRoleId,
  roleRefs,
  onDismissWarnings,
  onClearRole,
}: {
  militia: MilitiaRecord | null | undefined;
  activeCharacters: CharacterRecord[];
  assignmentWarnings: string[];
  assignmentError?: string;
  pendingRole?: OfficerRole;
  dragState: PointerCardDragState<CharacterId> | null;
  activeDropRoleId: string | null;
  roleRefs: RefObject<Record<string, HTMLDivElement | null>>;
  onDismissWarnings: () => void;
  onClearRole: (role: OfficerRole) => void;
}) {
  const hasDragState = dragState !== null;

  return (
    <div className="space-y-3">
      {assignmentWarnings.length > 0 ? (
        <div className="border border-amber-500/50 bg-amber-500/10 p-3">
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
        <div className="border-destructive/50 bg-destructive/10 text-destructive p-2 font-mono text-sm">
          {assignmentError}
        </div>
      ) : null}
      {!militia ? (
        <p className="text-muted-foreground font-mono text-sm">
          Create militia first to manage officers.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {officerRoleLabels.map(({ role, label }) => {
            const currentCharacterId = militia[role];
            const isDragActive = hasDragState;
            const isActiveDropRole = activeDropRoleId === role;
            return (
              <div
                key={role}
                ref={(element) => {
                  roleRefs.current[role] = element;
                }}
                className={getRoleCardClassName({
                  isActiveDropRole,
                  isDragActive,
                })}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-bold">{label}</p>
                    <p className="mt-1 font-sans text-lg font-bold">
                      {activeCharacters.find(
                        (character) => character._id === currentCharacterId,
                      )?.name ?? 'Unassigned'}
                    </p>
                  </div>
                  {currentCharacterId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onClearRole(role)}
                      disabled={pendingRole === role}
                    >
                      {pendingRole === role ? 'Unassigning...' : 'Unassign'}
                    </Button>
                  ) : null}
                </div>
                {isDragActive ? (
                  <p className="text-muted-foreground mt-2 font-mono text-xs">
                    {isActiveDropRole
                      ? 'Release to assign this role.'
                      : 'Drag a character card here.'}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getRoleCardClassName({
  isDragActive,
  isActiveDropRole,
}: {
  isDragActive: boolean;
  isActiveDropRole: boolean;
}) {
  if (isActiveDropRole) {
    return 'border-primary bg-primary/10 ring-primary/40 ring-2 border-2 p-3 transition-all';
  }

  if (isDragActive) {
    return 'border-primary bg-primary/5 border-2 p-3 transition-all';
  }

  return 'border-2 p-3 transition-all';
}
