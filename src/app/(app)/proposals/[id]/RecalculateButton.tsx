"use client";

import { Button } from "@/components/ui/Button";
import { useTransition, useState } from "react";
import { recalculateAction } from "./revision-actions";

export function RecalculateButton({
  proposalId,
  versionId,
}: {
  proposalId: string;
  versionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        loading={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const result = await recalculateAction(proposalId, versionId);
              if (!result.ok) setError(result.error ?? "Gagal menghitung ulang");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Gagal menghitung ulang");
            }
          });
        }}
      >
        {isPending ? "Menghitung..." : "Hitung Ulang"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
