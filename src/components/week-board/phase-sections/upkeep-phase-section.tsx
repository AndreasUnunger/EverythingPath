'use client';

import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

export type UpkeepPhaseViewModel = {
  upkeepAttritionTotal: string;
  setUpkeepAttritionTotalAction: (value: string) => void;
  showMaxNotorietyPenalty: boolean;
  upkeepNotorietyPenaltyTotal: string;
  setUpkeepNotorietyPenaltyTotalAction: (value: string) => void;
  maxNotorietyLoyaltyCheckTotal: string;
  setMaxNotorietyLoyaltyCheckTotalAction: (value: string) => void;
  nearestSettlementKey: string;
  setNearestSettlementKeyAction: (value: string) => void;
  settlementKeys: string[];
  showTreasuryShortagePenalty: boolean;
  upkeepTreasuryPenaltyTotal: string;
  setUpkeepTreasuryPenaltyTotalAction: (value: string) => void;
  minimumTreasury: number;
  treasuryAmount: string;
  setTreasuryAmountAction: (value: string) => void;
  applyTreasuryUpdateAction: (mode: 'deposit' | 'withdraw') => void;
  applyRankUpAction: () => void;
  canRankUp: boolean;
  rankUpBlockedReason?: string;
};

export function UpkeepPhaseSection({
  viewModel,
}: {
  viewModel: UpkeepPhaseViewModel;
}) {
  const {
    upkeepAttritionTotal,
    setUpkeepAttritionTotalAction,
    showMaxNotorietyPenalty,
    upkeepNotorietyPenaltyTotal,
    setUpkeepNotorietyPenaltyTotalAction,
    maxNotorietyLoyaltyCheckTotal,
    setMaxNotorietyLoyaltyCheckTotalAction,
    nearestSettlementKey,
    setNearestSettlementKeyAction,
    settlementKeys,
    showTreasuryShortagePenalty,
    upkeepTreasuryPenaltyTotal,
    setUpkeepTreasuryPenaltyTotalAction,
    minimumTreasury,
    treasuryAmount,
    setTreasuryAmountAction,
    applyTreasuryUpdateAction,
    applyRankUpAction,
    canRankUp,
    rankUpBlockedReason,
  } = viewModel;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Upkeep Totals</p>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="upkeep-attrition-total" className="font-mono text-xs">
              Training attrition total
            </Label>
            <Input
              id="upkeep-attrition-total"
              value={upkeepAttritionTotal}
              onChange={(event) => setUpkeepAttritionTotalAction(event.target.value)}
              placeholder="Enter total attrition result"
              className="font-mono"
            />
          </div>
          {showMaxNotorietyPenalty ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label
                  htmlFor="upkeep-max-notoriety-penalty"
                  className="font-mono text-xs"
                >
                  Maximum-notoriety penalty total
                </Label>
                <Input
                  id="upkeep-max-notoriety-penalty"
                  value={upkeepNotorietyPenaltyTotal}
                  onChange={(event) =>
                    setUpkeepNotorietyPenaltyTotalAction(event.target.value)
                  }
                  placeholder="Enter total max-notoriety penalty result"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="upkeep-max-notoriety-loyalty-check"
                  className="font-mono text-xs"
                >
                  Max-notoriety loyalty check total (DC 15)
                </Label>
                <Input
                  id="upkeep-max-notoriety-loyalty-check"
                  value={maxNotorietyLoyaltyCheckTotal}
                  onChange={(event) =>
                    setMaxNotorietyLoyaltyCheckTotalAction(event.target.value)
                  }
                  placeholder="Enter loyalty check total"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs">Nearest settlement</Label>
                <Select
                  value={nearestSettlementKey || undefined}
                  onValueChange={setNearestSettlementKeyAction}
                >
                  <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                    <SelectValue placeholder="Select nearest settlement" />
                  </SelectTrigger>
                  <SelectContent className="border-primary bg-card border-2 font-mono">
                    {settlementKeys.map((settlementKey) => (
                      <SelectItem key={settlementKey} value={settlementKey}>
                        {settlementKey}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          {showTreasuryShortagePenalty ? (
            <div className="space-y-1">
              <Label
                htmlFor="upkeep-treasury-shortage-penalty"
                className="font-mono text-xs"
              >
                Treasury-shortage penalty total
              </Label>
              <Input
                id="upkeep-treasury-shortage-penalty"
                value={upkeepTreasuryPenaltyTotal}
                onChange={(event) =>
                  setUpkeepTreasuryPenaltyTotalAction(event.target.value)
                }
                placeholder={`Enter total treasury-shortage penalty result (min treasury ${minimumTreasury})`}
                className="font-mono"
              />
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <Label htmlFor="upkeep-treasury-amount" className="font-mono text-xs">
                Treasury transaction amount
              </Label>
              <Input
                id="upkeep-treasury-amount"
                value={treasuryAmount}
                onChange={(event) => setTreasuryAmountAction(event.target.value)}
                placeholder="Enter treasury amount"
                className="font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => applyTreasuryUpdateAction('deposit')}
              >
                Deposit
              </Button>
              <Button
                variant="outline"
                onClick={() => applyTreasuryUpdateAction('withdraw')}
              >
                Withdraw
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <Card className="border p-3">
        <p className="font-mono text-sm font-bold">Upkeep Order</p>
        <ul className="text-muted-foreground mt-2 space-y-1 font-mono text-xs">
          <li>1. Training Attrition</li>
          <li>2. Maximum-Notoriety Penalties</li>
          <li>3. Treasury-Shortage Penalties</li>
          <li>4. Increase Rank</li>
          <li>5. Deposits and Withdrawals</li>
        </ul>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" onClick={applyRankUpAction} disabled={!canRankUp}>
            Rank Up (+1)
          </Button>
        </div>
        {!canRankUp && rankUpBlockedReason ? (
          <p className="text-muted-foreground mt-2 font-mono text-xs">
            {rankUpBlockedReason}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
