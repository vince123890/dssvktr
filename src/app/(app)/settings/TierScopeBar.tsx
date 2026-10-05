"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTemplateLadderAction, deleteTemplateLadderAction } from "./actions";

/**
 * Tier ladder scope (v4.1): the global ladder, or a Workflow Template's
 * own discount authority ("kalau persentase berapa negosiasinya siapa
 * yang approve" differs per template — transcribe.md).
 */
export function TierScopeBar({
  scope,
  templates,
  hasOwn,
}: {
  scope: string | null;
  templates: { code: string; name: string; own: boolean }[];
  hasOwn: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
      else setError(r.error ?? "Gagal");
    });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted">Tier margin untuk:</span>
        <select
          className="pc-input w-auto"
          value={scope ?? ""}
          onChange={(e) => router.push(`/settings?tab=tier${e.target.value ? `&scope=${encodeURIComponent(e.target.value)}` : ""}`)}
        >
          <option value="">Global (semua template tanpa tier khusus)</option>
          {templates.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name} {t.own ? "— khusus" : "— memakai global"}
            </option>
          ))}
        </select>
        {scope && !hasOwn && (
          <Button size="sm" loading={isPending} onClick={() => run(() => createTemplateLadderAction(scope))}>
            Buat tier khusus (salin global)
          </Button>
        )}
        {scope && hasOwn && (
          <Button size="sm" variant="secondary" loading={isPending} onClick={() => run(() => deleteTemplateLadderAction(scope))}>
            Hapus tier khusus — kembali ke global
          </Button>
        )}
        {error && <span className="text-danger">{error}</span>}
      </CardContent>
    </Card>
  );
}
