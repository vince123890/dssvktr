import { createClient } from "@/lib/supabase/server";
import { KANBAN_COLUMNS, STATUS_LABEL } from "@/lib/workflow/labels";
import type { PricingProposal } from "@/types/database";
import { LifecycleView } from "./LifecycleView";

export default async function LifecyclePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("pricing_proposal")
    .select("*")
    .order("updated_at", { ascending: false });

  const proposals = (data ?? []) as PricingProposal[];

  const columns = KANBAN_COLUMNS.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    items: proposals.filter((p) => p.current_status === status),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pricing Lifecycle &amp; Observability</h1>
        <p className="text-sm text-muted mt-1">
          Pelacakan status penawaran secara visual (FR-3.1) — Kanban untuk
          melihat sebaran proses, Table untuk filter mendalam.
        </p>
      </div>

      <LifecycleView columns={columns} proposals={proposals} initialView={view === "table" ? "table" : "kanban"} />
    </div>
  );
}
