"use client";

import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { discardCostStructureVersionAction } from "./actions";

/** "Batalkan draft" — the released version stays in force. */
export function DiscardDraftButton({ versionId, versionNo, redirectTo }: { versionId: string; versionNo: number; redirectTo?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-danger hover:underline">
        Batalkan draft v{versionNo}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          className="pc-input w-64"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Alasan (mis. kenaikan harga batal)"
          autoFocus
        />
        <Button
          size="sm"
          variant="danger"
          loading={isPending}
          onClick={() =>
            startTransition(async () => {
              const r = await discardCostStructureVersionAction(versionId, reason);
              if (!r.ok) setError(r.error ?? "Gagal membatalkan draft");
              else if (redirectTo) router.push(redirectTo);
            })
          }
        >
          Batalkan draft
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:underline">
          Tidak jadi
        </button>
      </div>
      <p className="text-[11px] text-muted">Draft dan isiannya dihapus; versi RELEASED tetap berlaku.</p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
