"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/workflow/labels";
import { formatCompactIDR, timeAgo } from "@/lib/utils";
import type { PricingProposal, ProposalStatus } from "@/types/database";
import Link from "next/link";
import { useMemo, useState } from "react";
import { KanbanSquare, Table2 } from "lucide-react";

interface Column {
  status: ProposalStatus;
  label: string;
  items: PricingProposal[];
}

export function LifecycleView({
  columns,
  proposals,
  initialView,
}: {
  columns: Column[];
  proposals: PricingProposal[];
  initialView: "kanban" | "table";
}) {
  const [view, setView] = useState<"kanban" | "table">(initialView);
  const [businessLineFilter, setBusinessLineFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const businessLines = useMemo(
    () => Array.from(new Set(proposals.map((p) => p.business_line))),
    [proposals]
  );

  const filteredProposals = proposals.filter(
    (p) =>
      (businessLineFilter === "ALL" || p.business_line === businessLineFilter) &&
      (statusFilter === "ALL" || p.current_status === statusFilter)
  );

  const filteredColumns = columns.map((col) => ({
    ...col,
    items: col.items.filter(
      (p) => businessLineFilter === "ALL" || p.business_line === businessLineFilter
    ),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={businessLineFilter}
            onChange={(e) => setBusinessLineFilter(e.target.value)}
            className="rounded-lg border border-card-border px-3 py-1.5 text-xs bg-white"
          >
            <option value="ALL">Semua Lini Bisnis</option>
            {businessLines.map((bl) => (
              <option key={bl} value={bl}>
                {bl.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {view === "table" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-card-border px-3 py-1.5 text-xs bg-white"
            >
              <option value="ALL">Semua Status</option>
              {Object.entries(STATUS_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex rounded-lg border border-card-border bg-white p-0.5">
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              view === "kanban" ? "bg-primary text-white" : "text-muted"
            }`}
          >
            <KanbanSquare size={13} /> Kanban
          </button>
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              view === "table" ? "bg-primary text-white" : "text-muted"
            }`}
          >
            <Table2 size={13} /> Table
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {filteredColumns.map((col) => (
            <div key={col.status} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-muted">{col.label}</span>
                <Badge>{col.items.length}</Badge>
              </div>
              <div className="space-y-2 min-h-24">
                {col.items.map((p) => (
                  <Link key={p.id} href={`/proposals/${p.id}`}>
                    <Card className="p-3 hover:border-primary transition-colors">
                      <div className="font-mono text-[10px] text-muted">
                        {p.proposal_number}
                      </div>
                      <div className="text-xs font-medium mt-1 line-clamp-2">{p.title}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-muted">
                          {p.transaction_value > 0 ? formatCompactIDR(p.transaction_value) : "—"}
                        </span>
                        <span className="text-[10px] text-muted">{timeAgo(p.updated_at)}</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Proposal #</th>
                <th className="px-5 py-3 font-medium">Judul</th>
                <th className="px-5 py-3 font-medium">Lini Bisnis</th>
                <th className="px-5 py-3 font-medium">Nilai</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Update Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {filteredProposals.map((p) => (
                <tr key={p.id} className="border-b border-card-border last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/proposals/${p.id}`} className="font-mono text-xs text-primary hover:underline">
                      {p.proposal_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-medium">{p.title}</td>
                  <td className="px-5 py-3 text-muted">{p.business_line.replaceAll("_", " ")}</td>
                  <td className="px-5 py-3 text-muted">
                    {p.transaction_value > 0 ? formatCompactIDR(p.transaction_value) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[p.current_status]}>{STATUS_LABEL[p.current_status]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{timeAgo(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
