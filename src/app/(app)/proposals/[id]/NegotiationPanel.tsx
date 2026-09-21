"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  NEGOTIATION_STATUS_LABEL,
  NEGOTIATION_STATUS_TONE,
} from "@/lib/workflow/labels";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatIDR, formatPercent, timeAgo } from "@/lib/utils";
import type {
  DiscountInputMode,
  NegotiationDecision,
  NegotiationRequest,
  UserRole,
} from "@/types/database";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { useState, useTransition } from "react";
import { decideNegotiationAction, requestDiscountAction } from "./negotiation-actions";

export function NegotiationPanel({
  proposalId,
  requests,
  decisionsByRequestId,
  role,
  actorId,
  canRequest,
}: {
  proposalId: string;
  requests: NegotiationRequest[];
  decisionsByRequestId: Record<string, NegotiationDecision[]>;
  role: UserRole;
  actorId: string;
  canRequest: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DiscountInputMode>("PERCENTAGE");
  const [counterMode, setCounterMode] = useState<DiscountInputMode>("PERCENTAGE");
  const [counter, setCounter] = useState<string>("");
  const [note, setNote] = useState("");

  const pending = requests.find((r) => r.status === "PENDING_APPROVAL");
  const history = requests.filter((r) => r.status !== "PENDING_APPROVAL");
  const decisions = pending ? decisionsByRequestId[pending.id] ?? [] : [];

  const requiredRoles = pending?.required_roles_snapshot ?? [];
  const approvedRoles = new Set(
    decisions.filter((d) => d.decision === "APPROVE").map((d) => d.approver_role)
  );
  const alreadyDecided = decisions.some((d) => d.actor_id === actorId);
  const canDecide = pending && requiredRoles.includes(role) && !alreadyDecided;

  function decide(decision: "APPROVE" | "REJECT" | "REVISE") {
    if (!pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await decideNegotiationAction({
          requestId: pending.id,
          decision,
          counterMode: decision === "REVISE" ? counterMode : undefined,
          counterAmount:
            decision === "REVISE" && counterMode === "AMOUNT" ? Number(counter) : undefined,
          counterPct:
            decision === "REVISE" && counterMode === "PERCENTAGE" ? Number(counter) : undefined,
          note: note || undefined,
        });
        if (result.ok) {
          setNote("");
          setCounter("");
        } else {
          setError(result.error ?? "Terjadi kesalahan");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Commercial Negotiation</CardTitle>
          <p className="text-xs text-muted mt-0.5">
            Permintaan diskon &amp; margin-tier discount authority
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {pending && (
          <div className="rounded-lg border border-warning/30 bg-warning-bg p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TrendingDown size={15} className="text-warning" />
                <span className="text-sm font-semibold">
                  Diskon diminta: {Number(pending.requested_discount_pct).toFixed(2)}%
                  {pending.discount_input_mode === "AMOUNT" && pending.requested_discount_amount
                    ? ` (${formatIDR(pending.requested_discount_amount)})`
                    : ""}
                </span>
              </div>
              <Badge tone={NEGOTIATION_STATUS_TONE[pending.status]}>
                {NEGOTIATION_STATUS_LABEL[pending.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Harga sebelum" value={formatIDR(pending.price_before)} />
              <Metric label="Harga sesudah" value={formatIDR(pending.price_after)} />
              <Metric label="GPM setelah diskon" value={formatPercent(pending.gpm_after)} />
              <Metric label="Tier" value={`Tier ${pending.required_tier}`} />
            </div>

            {pending.customer_note && (
              <p className="text-xs text-muted italic">
                &ldquo;{pending.customer_note}&rdquo;
              </p>
            )}

            {pending.required_tier > 1 && (
              <div className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger-bg px-2.5 py-2 text-xs text-danger">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Peringatan margin.</strong> Diskon ini mendorong quotation
                  ke Tier {pending.required_tier} — memerlukan persetujuan{" "}
                  {requiredRoles.map((r) => ROLE_LABELS[r]).join(", ")} sebelum
                  diterapkan.
                </span>
              </div>
            )}

            {requiredRoles.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Progress persetujuan ({approvedRoles.size} dari{" "}
                  {pending.required_tier === 3 ? 2 : requiredRoles.length} pihak)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pending.required_tier === 3
                    ? [0, 1].map((i) => {
                        const bodApprovals = decisions.filter(
                          (d) => d.decision === "APPROVE" && d.approver_role === "BOD"
                        );
                        const done = bodApprovals.length > i;
                        return (
                          <Badge key={i} tone={done ? "success" : "default"}>
                            BOD #{i + 1} {done ? "✓" : ""}
                          </Badge>
                        );
                      })
                    : requiredRoles.map((r) => (
                        <Badge key={r} tone={approvedRoles.has(r) ? "success" : "default"}>
                          {ROLE_LABELS[r]} {approvedRoles.has(r) ? "✓" : ""}
                        </Badge>
                      ))}
                </div>
              </div>
            )}

            {canDecide ? (
              <div className="space-y-2 pt-1">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Catatan keputusan"
                  className="w-full rounded-lg border border-card-border px-2.5 py-1.5 text-xs"
                />
                {error && <p className="text-xs text-danger">{error}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    disabled={isPending}
                    onClick={() => decide("APPROVE")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={isPending}
                    onClick={() => decide("REJECT")}
                  >
                    Reject
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={counterMode}
                      onChange={(e) => setCounterMode(e.target.value as DiscountInputMode)}
                      className="rounded-lg border border-card-border px-1.5 py-1.5 text-xs"
                    >
                      <option value="PERCENTAGE">%</option>
                      <option value="AMOUNT">Rp</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={counter}
                      onChange={(e) => setCounter(e.target.value)}
                      placeholder={counterMode === "PERCENTAGE" ? "counter %" : "counter Rp"}
                      className="w-28 rounded-lg border border-card-border px-2 py-1.5 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isPending || !counter}
                      onClick={() => decide("REVISE")}
                    >
                      Revise
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">
                {alreadyDecided
                  ? "Anda sudah memberikan keputusan — menunggu pihak lain."
                  : `Menunggu keputusan ${requiredRoles.map((r) => ROLE_LABELS[r]).join(", ")} — di luar wewenang peran Anda.`}
              </p>
            )}
          </div>
        )}

        {!pending && canRequest && (
          <form
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                try {
                  const result = await requestDiscountAction(proposalId, formData);
                  if (!result.ok) setError(result.error ?? "Gagal mengajukan");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Gagal mengajukan");
                }
              });
            }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <select
                name="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as DiscountInputMode)}
                className="rounded-lg border border-card-border px-2 py-1.5 text-sm"
              >
                <option value="PERCENTAGE">Persentase</option>
                <option value="AMOUNT">Rupiah</option>
              </select>
              {mode === "PERCENTAGE" ? (
                <input
                  type="number"
                  name="pct"
                  step="0.1"
                  min="0.01"
                  max="100"
                  required
                  placeholder="Diskon diminta (%)"
                  className="w-40 rounded-lg border border-card-border px-2.5 py-1.5 text-sm"
                />
              ) : (
                <input
                  type="number"
                  name="amount"
                  step="1000"
                  min="1"
                  required
                  placeholder="Diskon diminta (Rp)"
                  className="w-40 rounded-lg border border-card-border px-2.5 py-1.5 text-sm"
                />
              )}
              <input
                name="customer_note"
                placeholder="Konteks permintaan pelanggan"
                className="flex-1 rounded-lg border border-card-border px-2.5 py-1.5 text-sm"
              />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button type="submit" size="sm" loading={isPending}>
              {isPending ? "Mengajukan..." : "Ajukan Permintaan Diskon"}
            </Button>
            <p className="text-[11px] text-muted">
              Tier wewenang ditentukan otomatis oleh sistem berdasarkan GPM hasil
              diskon — tidak dapat dipilih pengaju.
            </p>
          </form>
        )}

        {history.length > 0 && (
          <div className="space-y-1.5 border-t border-card-border pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Riwayat Negosiasi
            </p>
            {history.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-xs py-1"
              >
                <span>
                  {Number(r.requested_discount_pct).toFixed(2)}% &middot;{" "}
                  <span className="text-muted">
                    GPM {formatPercent(r.gpm_after)} &middot; Tier {r.required_tier}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-muted">{timeAgo(r.created_at)}</span>
                  <Badge tone={NEGOTIATION_STATUS_TONE[r.status]}>
                    {NEGOTIATION_STATUS_LABEL[r.status]}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        )}

        {!pending && !canRequest && history.length === 0 && (
          <p className="text-xs text-muted">Belum ada permintaan diskon.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="font-medium text-foreground mt-0.5">{value}</div>
    </div>
  );
}
