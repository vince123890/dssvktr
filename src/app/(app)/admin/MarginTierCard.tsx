"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ROLE_LABELS } from "@/lib/rbac";
import type { MarginTierAuthority, UserRole } from "@/types/database";
import { useState, useTransition } from "react";
import { updateMarginTierBoundsAction } from "./actions";

const TIER_TONE: Record<number, "success" | "warning" | "danger"> = {
  1: "success",
  2: "warning",
  3: "danger",
};

export function MarginTierCard({
  tier,
  canEdit,
}: {
  tier: MarginTierAuthority;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [lower, setLower] = useState(
    tier.gpm_lower_bound_pct != null ? String(tier.gpm_lower_bound_pct) : ""
  );
  const [upper, setUpper] = useState(
    tier.gpm_upper_bound_pct != null ? String(tier.gpm_upper_bound_pct) : ""
  );

  const requiredRoles = tier.required_roles as UserRole[];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Tier {tier.tier}</CardTitle>
          <p className="text-xs text-muted mt-0.5">
            {requiredRoles.length === 0
              ? "Auto-release, tanpa approval tambahan"
              : `AND-join: ${requiredRoles.map((r) => ROLE_LABELS[r]).join(", ")}`}
          </p>
        </div>
        <Badge tone={TIER_TONE[tier.tier] ?? "default"}>
          {tier.gpm_lower_bound_pct != null ? `${tier.gpm_lower_bound_pct}%` : "—"}
          {" – "}
          {tier.gpm_upper_bound_pct != null ? `${tier.gpm_upper_bound_pct}%` : "∞"}
        </Badge>
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <form
            action={(formData) => {
              startTransition(async () => {
                await updateMarginTierBoundsAction(formData);
              });
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="id" value={tier.id} />
            <label className="text-xs text-muted space-y-1">
              <span>GPM batas bawah (%)</span>
              <input
                type="number"
                step="0.1"
                name="gpm_lower_bound_pct"
                value={lower}
                onChange={(e) => setLower(e.target.value)}
                placeholder="tanpa batas"
                className="w-32 rounded-lg border border-card-border px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs text-muted space-y-1">
              <span>GPM batas atas (%)</span>
              <input
                type="number"
                step="0.1"
                name="gpm_upper_bound_pct"
                value={upper}
                onChange={(e) => setUpper(e.target.value)}
                placeholder="tanpa batas"
                className="w-32 rounded-lg border border-card-border px-2 py-1.5 text-xs"
              />
            </label>
            <Button type="submit" size="sm" loading={isPending}>
              Simpan
            </Button>
          </form>
        ) : (
          <p className="text-xs text-muted">Read-only — hanya System Admin dapat mengubah ambang tier.</p>
        )}
      </CardContent>
    </Card>
  );
}
