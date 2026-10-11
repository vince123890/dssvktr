import { createClient } from "@/lib/supabase/server";
import { canViewQuotation, loadValidatorVisibleRoles, requireMenu } from "@/lib/menuAccess";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableScroll } from "@/components/ui/TableScroll";
import { formatCompactIDR, formatDate } from "@/lib/utils";
import { canInitiateQuotation, canSeeCostStructure } from "@/lib/rbac";
import { expireStaleQuotations } from "@/lib/workflow/quotationEngine";
import { loadSettings } from "@/lib/settings";
import {
  AGE_STATE_LABEL,
  AGE_STATE_TONE,
  ageConfigFrom,
  daysBetween,
  quotationAgeState,
  type AgeState,
} from "@/lib/lifecycle";
import type { PricingProposal } from "@/types/database";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BUSINESS_LINE_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/workflow/labels";

/** Filter chips (PRD FR-3.4): one per age / result state. */
const FILTERS: { key: string; label: string; states: AgeState[] | null }[] = [
  { key: "all", label: "Semua", states: null },
  { key: "green", label: "Hijau", states: ["GREEN"] },
  { key: "yellow", label: "Kuning (follow up)", states: ["YELLOW"] },
  { key: "red", label: "Merah", states: ["RED", "LOST", "EXPIRED"] },
  { key: "won", label: "Won", states: ["WON"] },
];

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const me = await requireMenu("quotations");
  const supabase = await createClient();
  await expireStaleQuotations(supabase, me.id);

  const [{ data }, validatorRoles, settings] = await Promise.all([
    supabase.from("pricing_proposal").select("*").order("created_at", { ascending: false }),
    loadValidatorVisibleRoles(supabase),
    loadSettings(supabase),
  ]);
  // Row-level visibility (FR-5.7): a Salesperson only sees their own quotations.
  const visible = ((data ?? []) as PricingProposal[]).filter((p) => canViewQuotation(me, p, validatorRoles));
  const seesCost = canSeeCostStructure(me);

  const now = new Date();
  const cfg = ageConfigFrom(settings);
  const withAge = visible.map((p) => ({ p, age: quotationAgeState(p, now, cfg) }));
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];
  const rows = filter.states ? withAge.filter((x) => filter.states!.includes(x.age)) : withAge;
  const countOf = (states: AgeState[] | null) => (states ? withAge.filter((x) => states.includes(x.age)).length : withAge.length);

  const priceShown = (p: PricingProposal) =>
    (seesCost || ["PENDING_SIGNED_DOCUMENT", "QUOTATION_RELEASED", "EXPIRED", "SUPERSEDED"].includes(p.current_status)) &&
    Number(p.total_incl_vat) > 0;

  const ageBadge = (p: PricingProposal, age: AgeState) =>
    age === "NONE" ? null : (
      <Badge tone={AGE_STATE_TONE[age]}>
        {AGE_STATE_LABEL[age]}
        {p.released_at && (age === "GREEN" || age === "YELLOW" || age === "RED")
          ? ` · ${daysBetween(p.released_at, now)} hr`
          : ""}
      </Badge>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Official Quotation</h1>
          <p className="mt-1 text-sm text-muted">
            Sales To Obtain Official Quotation — draft KYC, review Head of Sales, persetujuan tier bila ada diskon,
            dokumen bertanda tangan, hingga rilis.
          </p>
        </div>
        {canInitiateQuotation(me) && (
          <Link href="/proposals/new">
            <Button><Plus size={15} /> Official Quotation Baru</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Filter kondisi quotation">
        {FILTERS.map((x) => {
          const active = x.key === filter.key;
          return (
            <Link
              key={x.key}
              href={x.key === "all" ? "/proposals" : `/proposals?f=${x.key}`}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
                active ? "border-primary bg-blue-50 text-primary" : "border-card-border bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {x.label}
              <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">{countOf(x.states)}</span>
            </Link>
          );
        })}
      </div>

      {/* Phones and small tablets: one card per quotation */}
      <div className="space-y-3 md:hidden">
        {rows.map(({ p, age }) => (
          <Link key={p.id} href={`/proposals/${p.id}`} className="block rounded-xl border border-card-border bg-white p-4 shadow-sm active:bg-slate-50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-xs text-primary">{p.proposal_number}</div>
                {p.document_number && <div className="font-mono text-[10px] text-muted">{p.document_number}</div>}
              </div>
              <span className="shrink-0 text-xs text-muted">{formatDate(p.created_at)}</span>
            </div>
            <div className="mt-1 text-sm font-medium">{p.title}</div>
            <div className="mt-0.5 text-xs text-muted">{BUSINESS_LINE_LABEL[p.business_line] ?? p.business_line}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={STATUS_TONE[p.current_status]}>{STATUS_LABEL[p.current_status]}</Badge>
              {p.outcome !== "PENDING" && <Badge tone={p.outcome === "WON" ? "success" : "danger"}>{p.outcome}</Badge>}
              {ageBadge(p, age)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">Total incl. VAT</span>
              <span className="font-medium">{priceShown(p) ? formatCompactIDR(Number(p.total_incl_vat)) : "—"}</span>
            </div>
            {seesCost && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted">GM · Tier</span>
                <span>
                  {p.gm != null ? `${(Number(p.gm) * 100).toFixed(2)}%` : "—"}
                  {p.margin_tier && <Badge className="ml-1.5" tone={p.margin_tier === 1 ? "success" : p.margin_tier === 2 ? "warning" : "danger"}>T{p.margin_tier}</Badge>}
                </span>
              </div>
            )}
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="rounded-xl border border-card-border bg-white px-4 py-10 text-center text-sm text-muted">Belum ada quotation.</div>
        )}
      </div>

      {/* md and up: table */}
      <Card className="hidden p-0 md:block">
        <TableScroll>
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Nomor</th>
                <th className="px-5 py-3 font-medium">Customer / judul</th>
                <th className="px-5 py-3 font-medium">Lini bisnis</th>
                <th className="px-5 py-3 font-medium">Total incl. VAT</th>
                {seesCost && <th className="px-5 py-3 font-medium">GM · Tier</th>}
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, age }) => (
                <tr key={p.id} className="border-b border-card-border last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/proposals/${p.id}`} className="font-mono text-xs text-primary hover:underline">{p.proposal_number}</Link>
                    {p.document_number && <div className="font-mono text-[10px] text-muted">{p.document_number}</div>}
                  </td>
                  <td className="px-5 py-3 font-medium">{p.title}</td>
                  <td className="px-5 py-3 text-xs text-muted">{BUSINESS_LINE_LABEL[p.business_line] ?? p.business_line}</td>
                  <td className="px-5 py-3 text-muted">{priceShown(p) ? formatCompactIDR(Number(p.total_incl_vat)) : "—"}</td>
                  {seesCost && (
                    <td className="px-5 py-3 text-xs">
                      {p.gm != null ? `${(Number(p.gm) * 100).toFixed(2)}%` : "—"}
                      {p.margin_tier && <Badge className="ml-1.5" tone={p.margin_tier === 1 ? "success" : p.margin_tier === 2 ? "warning" : "danger"}>T{p.margin_tier}</Badge>}
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge tone={STATUS_TONE[p.current_status]}>{STATUS_LABEL[p.current_status]}</Badge>
                      {p.outcome !== "PENDING" && <Badge tone={p.outcome === "WON" ? "success" : "danger"}>{p.outcome}</Badge>}
                      {ageBadge(p, age)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{formatDate(p.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={seesCost ? 7 : 6} className="px-5 py-10 text-center text-sm text-muted">Belum ada quotation.</td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </div>
  );
}
