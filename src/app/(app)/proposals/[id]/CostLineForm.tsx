"use client";

import { Button } from "@/components/ui/Button";
import { formatIDR } from "@/lib/utils";
import type { CostItem, CurrencyCode } from "@/types/database";
import { CURRENCY_SYMBOL } from "@/lib/pricing/currency";
import { useRef, useState, useTransition } from "react";
import { saveCostLinesAction } from "../actions";

const CATEGORY_LABEL: Record<string, string> = {
  DIRECT: "Direct Costs",
  INDIRECT: "Indirect Costs",
  MARGIN_FACTOR: "Margin & Financial Factors",
};

export function CostLineForm({
  proposalId,
  versionId,
  costItems,
  existingValues,
  ownerDeptCodeById,
  readOnly,
  inputCurrency = "IDR",
}: {
  proposalId: string;
  versionId: string;
  costItems: CostItem[];
  existingValues: Record<string, number>;
  ownerDeptCodeById: Record<string, string>;
  readOnly: boolean;
  inputCurrency?: CurrencyCode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, number>>(existingValues);

  const grouped = {
    DIRECT: costItems.filter((i) => i.category === "DIRECT"),
    INDIRECT: costItems.filter((i) => i.category === "INDIRECT"),
    MARGIN_FACTOR: costItems.filter((i) => i.category === "MARGIN_FACTOR"),
  };

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(() => saveCostLinesAction(proposalId, versionId, formData));
      }}
      className="space-y-5"
    >
      {(["DIRECT", "INDIRECT", "MARGIN_FACTOR"] as const).map((cat) => (
        <div key={cat}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            {CATEGORY_LABEL[cat]}
          </h4>
          <div className="rounded-lg border border-card-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Owner Dept</th>
                  <th className="px-4 py-2 font-medium w-48">
                    Nilai{" "}
                    {cat === "MARGIN_FACTOR"
                      ? "(%)"
                      : `(${CURRENCY_SYMBOL[inputCurrency]} / unit)`}
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped[cat].map((item) => (
                  <tr key={item.id} className="border-t border-card-border">
                    <td className="px-4 py-2">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-[11px] text-muted font-mono">
                        {item.code}
                        {item.is_mandatory && (
                          <span className="ml-1.5 text-danger">* mandatory</span>
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
                      <input
                        type="number"
                        name={`cost_${item.id}`}
                        step="0.01"
                        disabled={readOnly}
                        defaultValue={existingValues[item.id] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [item.id]: Number(e.target.value) || 0 }))
                        }
                        placeholder="0"
                        className="w-full rounded-md border border-card-border px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-muted"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {!readOnly && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {Object.values(values).filter((v) => v > 0).length} / {costItems.length} item terisi
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
