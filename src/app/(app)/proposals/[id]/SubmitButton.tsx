"use client";

import { Button } from "@/components/ui/Button";
import { useTransition, useState } from "react";
import { submitProposalAction } from "./workflow-actions";

export function SubmitButton({ proposalId }: { proposalId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        loading={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await submitProposalAction(proposalId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Gagal submit");
            }
          });
        }}
      >
        {isPending ? "Submitting..." : "Submit untuk Approval"}
      </Button>
      {error && <p className="text-xs text-danger max-w-xs text-right">{error}</p>}
    </div>
  );
}
