"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { SCOPE_STATUS_LABEL, SCOPE_STATUS_TONE } from "@/lib/workflow/labels";
import { formatIDR } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CostScope, CostStructureScopeState } from "@/types/database";
import { saveScopeValuesAction, scopeTransitionAction, type ScopeTransition } from "../actions";

export interface ScopeItemView {
  id: string;
  name: string;
  unitType: string;
  denomination: string;
  isDerived: boolean;
  isMandatory: boolean;
  mayFollowLater: boolean;
  value: number;
  excluded: boolean;
  amountIdr: number;
}

/**
 * One scope of a cost structure version: values + the Maker → Checker →
 * Releaser buttons the viewer is entitled to (computed on the server
 * from Settings → Scope Authority; the server re-checks on every click).
 */
export function ScopeCard({
  versionId,
  scope,
  scopeLabel,
  state,
  items,
  editableVersion,
  can,
  hints,
  people,
  scopeTotal,
}: {
  versionId: string;
  scope: CostScope;
  scopeLabel: string;
  state: CostStructureScopeState | null;
  items: ScopeItemView[];
  editableVersion: boolean;
  can: { make: boolean; check: boolean; release: boolean };
  hints: string[];
  people: { maker: string | null; checker: string | null; releaser: string | null };
  scopeTotal: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(Object.fromEntries(items.map((i) => [i.id, i.value])));
  const [excluded, setExcluded] = useState<Set<string>>(new Set(items.filter((i) => i.excluded).map((i) => i.id)));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const status = state?.status ?? "DRAFT";
  const editing = editableVersion && (status === "DRAFT" || status === "RETURNED") && can.make;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        setNote("");
        router.refresh();
      } else setError(r.error ?? "Gagal");
    });
  }

  const transition = (t: ScopeTransition) => run(() => scopeTransitionAction(versionId, scope, t, note));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{scopeLabel}</CardTitle>
          <CardDescription>
            Total {formatIDR(scopeTotal)}
            {state?.carried_over && " · disalin dari versi sebelumnya"}
            {state?.single_actor_flag && " · single-actor release"}
          </CardDescription>
        </div>
        <Badge tone={SCOPE_STATUS_TONE[status]}>{SCOPE_STATUS_LABEL[status]}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <table className="w-full text-xs">
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-card-border last:border-0">
                <td className="py-1.5 pr-2">
                  {i.name}
                  {i.isMandatory && !i.mayFollowLater && <span className="text-danger"> *</span>}
                  {i.mayFollowLater && <span className="ml-1 text-[10px] text-sky-700">(boleh at cost)</span>}
                </td>
                <td className="w-44 py-1.5">
                  {i.isDerived ? (
                    <span className="text-muted">otomatis</span>
                  ) : i.mayFollowLater && excluded.has(i.id) ? (
                    <span className="text-muted">Exclusion — At cost</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="w-6 text-right text-muted">
                        {i.unitType === "PERCENTAGE" ? "%" : i.denomination === "CNY" ? "¥" : "Rp"}
                      </span>
                      <input
                        className="pc-input"
                        type="number"
                        min={0}
                        step="any"
                        disabled={!editing}
                        value={values[i.id] ?? 0}
                        onChange={(e) => setValues((v) => ({ ...v, [i.id]: Number(e.target.value) }))}
                      />
                    </div>
                  )}
                  {i.mayFollowLater && editing && (
                    <label className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                      <input
                        type="checkbox"
                        checked={excluded.has(i.id)}
                        onChange={(e) =>
                          setExcluded((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.add(i.id);
                            else n.delete(i.id);
                            return n;
                          })
                        }
                      />
                      Exclusion — At cost
                    </label>
                  )}
                </td>
                <td className="w-32 py-1.5 text-right text-muted">{i.unitType === "PERCENTAGE" || i.denomination === "CNY" || i.isDerived ? formatIDR(i.amountIdr) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-3 gap-2 text-[11px] text-muted">
          <div>Maker: <span className="text-foreground">{people.maker ?? "—"}</span></div>
          <div>Checker: <span className="text-foreground">{people.checker ?? "—"}</span></div>
          <div>Releaser: <span className="text-foreground">{people.releaser ?? "—"}</span></div>
        </div>
        {state?.note && <p className="rounded bg-slate-50 px-2 py-1 text-[11px] italic text-muted">&ldquo;{state.note}&rdquo;</p>}

        {editableVersion && (
          <div className="space-y-2 border-t border-card-border pt-3">
            {(status === "MADE" || status === "CHECKED") && (can.check || can.release) && (
              <textarea className="pc-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (wajib bila mengembalikan ke Maker)" />
            )}
            <div className="flex flex-wrap gap-2">
              {editing && (
                <>
                  <Button size="sm" variant="secondary" loading={isPending} onClick={() => run(() => saveScopeValuesAction(versionId, scope, values, [...excluded]))}>
                    Simpan nilai
                  </Button>
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      run(async () => {
                        const saved = await saveScopeValuesAction(versionId, scope, values, [...excluded]);
                        if (!saved.ok) return saved;
                        return scopeTransitionAction(versionId, scope, "MAKE", "");
                      })
                    }
                  >
                    Submit (Maker)
                  </Button>
                </>
              )}
              {status === "MADE" && can.check && (
                <Button size="sm" variant="success" loading={isPending} onClick={() => transition("CHECK")}>Check</Button>
              )}
              {status === "CHECKED" && can.release && (
                <Button size="sm" variant="success" loading={isPending} onClick={() => transition("RELEASE")}>Release</Button>
              )}
              {(status === "MADE" || status === "CHECKED") && (can.check || can.release) && (
                <Button size="sm" variant="danger" disabled={isPending} onClick={() => transition("RETURN")}>Kembalikan ke Maker</Button>
              )}
              {status === "RELEASED" && can.make && (
                <Button size="sm" variant="secondary" loading={isPending} onClick={() => transition("REOPEN")}>Buka untuk perubahan</Button>
              )}
            </div>
            {!editing && !can.make && !can.check && !can.release && hints[0] && (
              <p className="text-[11px] text-muted">{hints[0]}</p>
            )}
          </div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
