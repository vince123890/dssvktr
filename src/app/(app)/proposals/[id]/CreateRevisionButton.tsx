"use client";

import { Button } from "@/components/ui/Button";
import { useTransition, useState } from "react";
import { createManualRevisionAction } from "./revision-actions";

export function CreateRevisionButton({ proposalId }: { proposalId: string }) {
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
              await createManualRevisionAction(proposalId);
            } catch (e) {
              // redirect() signals success by throwing NEXT_REDIRECT; only a
              // real failure should surface as an error message here.
              if (
                typeof e === "object" &&
                e !== null &&
                "digest" in e &&
                String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
              ) {
                throw e;
              }
              setError(e instanceof Error ? e.message : "Gagal membuat revisi");
            }
          });
        }}
      >
        {isPending ? "Membuat..." : "Buat Revisi"}
      </Button>
      {error && <p className="text-xs text-danger max-w-xs text-right">{error}</p>}
    </div>
  );
}
