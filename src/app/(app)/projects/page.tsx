import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canViewProject, requireMenu } from "@/lib/menuAccess";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TableScroll } from "@/components/ui/TableScroll";
import { formatCompactIDR, formatDate } from "@/lib/utils";
import { paymentLabel, paymentSummary } from "@/lib/projects";
import type { PricingProposal, Project, ProjectPaymentTerm } from "@/types/database";

type ProposalLite = Pick<
  PricingProposal,
  "id" | "proposal_number" | "document_number" | "title" | "created_by" | "account_person_ids"
>;

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "running", label: "Berjalan" },
  { key: "done", label: "Selesai (100%)" },
  { key: "new", label: "Belum ada progres" },
] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const me = await requireMenu("projects");
  const supabase = await createClient();

  const { data: projectRows } = await supabase.from("project").select("*").order("created_at", { ascending: false });
  const projects = (projectRows ?? []) as Project[];
  const ids = projects.map((p) => p.id);

  const [{ data: proposalRows }, { data: termRows }] = await Promise.all([
    supabase
      .from("pricing_proposal")
      .select("id, proposal_number, document_number, title, created_by, account_person_ids")
      .in("id", projects.map((p) => p.proposal_id).concat(["00000000-0000-0000-0000-000000000000"])),
    supabase
      .from("project_payment_term")
      .select("*")
      .in("project_id", ids.concat(["00000000-0000-0000-0000-000000000000"])),
  ]);
  const proposals = new Map(((proposalRows ?? []) as ProposalLite[]).map((p) => [p.id, p]));
  const terms = (termRows ?? []) as ProjectPaymentTerm[];

  // Row-level visibility: a Salesperson only sees projects of quotations they own (FR-9.2).
  const visible = projects.filter((p) => {
    const proposal = proposals.get(p.proposal_id);
    return proposal ? canViewProject(me, proposal) : false;
  });

  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];
  const rows = visible.filter((p) => matchKey(filter.key, p));

  const summaryOf = (p: Project) =>
    paymentSummary(
      terms.filter((t) => t.project_id === p.id),
      Number(p.contract_value_ex_vat)
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Projects</h1>
        <p className="mt-1 text-sm text-muted">
          Quotation yang Won. Salesperson menetapkan termin, Finance mengisi status payment, Tim Project mengisi progres.
          Semua input manual.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Filter project">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "all" ? "/projects" : `/projects?f=${x.key}`}
            className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium ${
              x.key === filter.key ? "border-primary bg-blue-50 text-primary" : "border-card-border bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {x.label}
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">
              {visible.filter((p) => matchKey(x.key, p)).length}
            </span>
          </Link>
        ))}
      </div>

      {/* Phones and small tablets: cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((p) => {
          const proposal = proposals.get(p.proposal_id);
          const pay = summaryOf(p);
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-xl border border-card-border bg-white p-4 shadow-sm active:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.customer_name ?? proposal?.title}</div>
                  <div className="font-mono text-[11px] text-muted">{proposal?.document_number ?? proposal?.proposal_number}</div>
                </div>
                <Badge tone={p.current_progress_pct >= 100 ? "success" : p.current_progress_pct > 0 ? "info" : "default"}>
                  {p.current_progress_pct}%
                </Badge>
              </div>
              <div className="mt-2 text-xs text-muted">PO {p.po_number ?? "—"} · {formatCompactIDR(Number(p.contract_value_ex_vat))} excl. VAT</div>
              <div className="mt-1 text-xs">{p.current_status ?? "Belum ada progres"}</div>
              <div className="mt-1 text-xs text-muted">{paymentLabel(pay)}</div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-xl border border-card-border bg-white px-4 py-10 text-center text-sm text-muted">Belum ada project.</div>
        )}
      </div>

      {/* md and up: table */}
      <Card className="hidden p-0 md:block">
        <TableScroll>
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Customer / quotation</th>
                <th className="px-5 py-3 font-medium">PO</th>
                <th className="px-5 py-3 text-right font-medium">Nilai (excl. VAT)</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Status project</th>
                <th className="px-5 py-3 font-medium">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const proposal = proposals.get(p.proposal_id);
                return (
                  <tr key={p.id} className="border-b border-card-border last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.customer_name ?? proposal?.title}
                      </Link>
                      <div className="font-mono text-[11px] text-muted">{proposal?.document_number ?? proposal?.proposal_number}</div>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {p.po_number ?? "—"}
                      {p.po_received_at && <div className="text-muted">{formatDate(p.po_received_at)}</div>}
                    </td>
                    <td className="px-5 py-3 text-right">{formatCompactIDR(Number(p.contract_value_ex_vat))}</td>
                    <td className="px-5 py-3 text-xs">{paymentLabel(summaryOf(p))}</td>
                    <td className="px-5 py-3 text-xs">
                      {p.current_status ?? <span className="text-muted">Belum ada progres</span>}
                      <Badge className="ml-1.5" tone={p.current_progress_pct >= 100 ? "success" : p.current_progress_pct > 0 ? "info" : "default"}>
                        {p.current_progress_pct}%
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">{formatDate(p.created_at)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">Belum ada project.</td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </div>
  );
}

function matchKey(key: string, p: Project): boolean {
  if (key === "done") return p.current_progress_pct >= 100;
  if (key === "running") return p.current_progress_pct > 0 && p.current_progress_pct < 100;
  if (key === "new") return p.current_progress_pct === 0;
  return true;
}
