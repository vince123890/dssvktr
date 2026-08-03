"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { ProposalOutcome } from "@/types/database";
import { useTransition } from "react";
import { recordOutcomeAction } from "./outcome-actions";

const OUTCOME_TONE: Record<ProposalOutcome, "default" | "success" | "danger" | "warning"> = {
  PENDING: "default",
  WON: "success",
  LOST: "danger",
  CANCELLED: "warning",
};

export function OutcomePanel({
  proposalId,
  outcome,
  canRecord,
}: {
  proposalId: string;
  outcome: ProposalOutcome;
  canRecord: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Tender Outcome:</span>
      <Badge tone={OUTCOME_TONE[outcome]}>{outcome}</Badge>
      {canRecord && outcome === "PENDING" && (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="success"
            disabled={isPending}
            onClick={() => startTransition(() => recordOutcomeAction(proposalId, "WON"))}
          >
            Tandai Won
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => startTransition(() => recordOutcomeAction(proposalId, "LOST"))}
          >
            Tandai Lost
          </Button>
        </div>
      )}
    </div>
  );
}
