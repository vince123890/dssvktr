"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatIDR } from "@/lib/utils";
import type { CostGroup, CostItem, UserRole } from "@/types/database";
import { CURRENCY_SYMBOL } from "@/lib/pricing/currency";
import { useRef, useState, useTransition } from "react";
import { saveCostLinesAction } from "../actions";

const COST_GROUP_LABEL: Record<CostGroup, string> = {
  COGS: "COGS",
  ADD_ONS: "Add-Ons",
  PROFITABILITY: "Profitability",
  SALES: "Sales",
};

const COST_GROUP_ORDER: CostGroup[] = ["COGS", "ADD_ONS", "PROFITABILITY", "SALES"];

/**
 * Cost groups this role is even allowed to see. Sales Officer has no
 * read access to COGS/ADD_ONS/PROFITABILITY at all — not just the
 * margin number — it only owns the SALES group and sees the final
 * price elsewhere (PRD FR-2.0, v3.0).
 */
function visibleGroupsForRole(role: UserRole): CostGroup[] {
  if (role === "SALES_OFFICER") return ["SALES"];
  return COST_GROUP_ORDER;
}

export function CostLineForm({
  proposalId,
  versionId,
  costItems,
  existingValues,
  ownerDeptCodeById,
  readOnly,
  viewerRole,
}: {
  proposalId: string;
  versionId: string;
  costItems: CostItem[];
  existingValues: Record<string, number>;
  ownerDeptCodeById: Record<string, string>;
  readOnly: boolean;
  viewerRole: UserRole;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, number>>(existingValues);

  const visibleGroups = visibleGroupsForRole(viewerRole);
  const grouped = Object.fromEntries(
    COST_GROUP_ORDER.map((g) => [g, costItems.filter((i) => i.cost_group === g)])
  ) as Record<CostGroup, CostItem[]>;

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(() => saveCostLinesAction(proposalId, versionId, formData));
      }}
      className="space-y-5"
    >
      {COST_GROUP_ORDER.filter((g) => visibleGroups.includes(g) && grouped[g].length > 0).map(
        (group) => (
          <div key={group}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {COST_GROUP_LABEL[group]}
            </h4>
            <div className="rounded-lg border border-card-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium">Owner Dept</th>
                    <th className="px-4 py-2 font-medium w-48">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[group].map((item) => (
                    <tr key={item.id} className="border-t border-card-border">
                      <td className="px-4 py-2">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-[11px] text-muted font-mono">
                          {item.code}
                          {item.is_mandatory && (
                            <span className="ml-1.5 text-danger">* mandatory</span>
                          )}
                          {item.may_follow_later && (
                            <Badge tone="info" className="ml-1.5 align-middle">
                              boleh menyusul
                            </Badge>
                          )}
                          {item.is_mineral_linked && (
                            <span className="ml-1.5 text-success">
                              ⛏ HPM {item.mineral_code ?? ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted">
                        {ownerDeptCodeById[item.owner_department_id]}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            name={`cost_${item.id}`}
                            step="0.01"
                            disabled={readOnly}
                            defaultValue={existingValues[item.id] ?? ""}
                            onChange={(e) =>
                              setValues((v) => ({
                                ...v,
                                [item.id]: Number(e.target.value) || 0,
                              }))
                            }
                            placeholder="0"
                            className="w-full rounded-md border border-card-border px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-muted"
                          />
                          <span className="text-[11px] text-muted whitespace-nowrap">
                            {item.unit_type === "PERCENTAGE"
                              ? "%"
                              : `${CURRENCY_SYMBOL[item.denomination]}/unit`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {!readOnly && visibleGroups.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {Object.values(values).filter((v) => v > 0).length} /{" "}
            {costItems.filter((i) => visibleGroups.includes(i.cost_group)).length} item terisi
          </p>
          <Button type="submit" loading={isPending}>
            {isPending ? "Menghitung..." : "Simpan & Hitung Ulang Harga"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function formatValuePreview(v: number) {
  return formatIDR(v);
}
