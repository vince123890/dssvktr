"use client";

import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createCostStructureVersionAction } from "./actions";

export function NewVersionButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={13} /> Versi baru
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <input className="pc-input w-64" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan (mis. kurs baru, harga FOB baru)" />
        <Button
          size="sm"
          loading={isPending}
          onClick={() =>
            startTransition(async () => {
              const r = await createCostStructureVersionAction(productId, reason);
              if (r.ok && r.versionId) router.push(`/cost-structure/${r.versionId}`);
              else setError(r.error ?? "Gagal membuat versi");
            })
          }
        >
          Buat
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
