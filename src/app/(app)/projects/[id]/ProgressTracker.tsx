"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import { addProgressEntryAction } from "../actions";

export interface ProgressView {
  id: string;
  entryDate: string;
  statusLabel: string;
  progressPct: number;
  note: string | null;
  author: string;
}

/** Project progress (PRD FR-9.4): the Project Team adds entries; everyone else reads the history. */
export function ProgressTracker({
  projectId,
  entries,
  canRecord,
}: {
  projectId: string;
  entries: ProgressView[];
  canRecord: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const latest = entries[0];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Tracking project</CardTitle>
          <CardDescription>Diisi manual oleh Tim Project. Salesperson membaca untuk update ke pelanggan.</CardDescription>
        </div>
        {latest && <Badge tone={latest.progressPct >= 100 ? "success" : "info"}>{latest.progressPct}%</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {latest && (
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={latest.progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${latest.progressPct}%` }} />
          </div>
        )}

        {canRecord && (
          <form
            className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-card-border p-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              setError(null);
              startTransition(async () => {
                const r = await addProgressEntryAction(projectId, {
                  entryDate: String(fd.get("entry_date") ?? ""),
                  statusLabel: String(fd.get("status_label") ?? ""),
                  progressPct: Number(fd.get("progress_pct")),
                  note: String(fd.get("note") ?? ""),
                });
                if (r.ok) form.reset();
                else setError(r.error ?? "Gagal menyimpan progres.");
              });
            }}
          >
            <div className="text-xs font-medium sm:col-span-2">Tambah entri progres</div>
            <label className="text-xs text-muted">
              Tanggal
              <input className="pc-input mt-1" name="entry_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </label>
            <label className="text-xs text-muted">
              Progres (%)
              <input className="pc-input mt-1" name="progress_pct" type="number" min={0} max={100} step={1} inputMode="numeric" required />
            </label>
            <label className="text-xs text-muted sm:col-span-2">
              Status
              <input className="pc-input mt-1" name="status_label" placeholder="mis. Proses produksi" required />
            </label>
            <label className="text-xs text-muted sm:col-span-2">
              Catatan (opsional)
              <textarea className="pc-input mt-1" name="note" rows={2} />
            </label>
            <div className="sm:col-span-2">
              <Button size="sm" type="submit" loading={isPending}>Simpan progres</Button>
            </div>
          </form>
        )}
        {error && <p className="rounded bg-danger-bg px-2 py-1.5 text-xs text-danger">{error}</p>}

        {entries.length === 0 ? (
          <p className="text-sm text-muted">Belum ada progres.</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-medium">{e.statusLabel}</span>
                  <span className="text-muted">{e.progressPct}% · {formatDate(e.entryDate)}</span>
                </div>
                {e.note && <div className="mt-0.5 text-muted">{e.note}</div>}
                <div className="mt-0.5 text-[10px] text-muted">oleh {e.author}</div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
