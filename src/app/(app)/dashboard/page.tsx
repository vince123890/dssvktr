import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canViewQuotation, loadValidatorVisibleRoles, requireMenu } from "@/lib/menuAccess";
import { hasAnyFunction, hasFunction } from "@/lib/rbac";
import { expireStaleQuotations } from "@/lib/workflow/quotationEngine";
import { loadSettings } from "@/lib/settings";
import { ageConfigFrom } from "@/lib/lifecycle";
import { executiveSummary, salesKpi, salesKpiByPerson, type SalesKpi } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TableScroll } from "@/components/ui/TableScroll";
import { formatCompactIDR } from "@/lib/utils";
import type { PricingProposal, Profile, Project, ProjectPaymentTerm } from "@/types/database";

type View = "sales" | "exec";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string; sales?: string }> }) {
  const sp = await searchParams;
  const me = await requireMenu("dashboard");
  const supabase = await createClient();

  const canExec = hasAnyFunction(me, ["EXECUTIVE", "SYSTEM_ADMIN"]);
  const canSales = hasAnyFunction(me, ["SALESPERSON", "SALES_OPERATIONS", "SALES_RELEASER", "SYSTEM_ADMIN"]);
  const sees = hasAnyFunction(me, ["SALES_OPERATIONS", "SALES_RELEASER", "SYSTEM_ADMIN", "EXECUTIVE"]);
  const view: View = sp.view === "exec" && canExec ? "exec" : sp.view === "sales" && canSales ? "sales" : canSales ? "sales" : "exec";

  await expireStaleQuotations(supabase, me.id);
  const [{ data }, validatorRoles, settings] = await Promise.all([
    supabase
      .from("pricing_proposal")
      .select("id, created_by, account_person_ids, initiator_role_code, current_status, outcome, released_at, transaction_value")
      .order("created_at", { ascending: false }),
    loadValidatorVisibleRoles(supabase),
    loadSettings(supabase),
  ]);
  const now = new Date();
  const cfg = ageConfigFrom(settings);
  type Row = Pick<
    PricingProposal,
    "id" | "created_by" | "account_person_ids" | "initiator_role_code" | "current_status" | "outcome" | "released_at" | "transaction_value"
  >;
  const all = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {view === "exec"
              ? "Ringkasan tingkat tinggi: quotation, PO, payment, dan project."
              : "KPI penjualan: quotation terkirim, hasilnya, dan yang perlu di-follow up."}
          </p>
        </div>
        {canExec && canSales && (
          <div className="inline-flex rounded-lg border border-card-border bg-white p-0.5 text-xs font-medium">
            <Link href="/dashboard?view=sales" className={`rounded-md px-3 py-2 ${view === "sales" ? "bg-blue-50 text-primary" : "text-slate-600"}`}>Sales</Link>
            <Link href="/dashboard?view=exec" className={`rounded-md px-3 py-2 ${view === "exec" ? "bg-blue-50 text-primary" : "text-slate-600"}`}>Executive</Link>
          </div>
        )}
      </div>

      {view === "sales" ? (
        <SalesView
          rows={sees ? all : all.filter((p) => canViewQuotation(me, p as PricingProposal, validatorRoles))}
          sees={sees}
          selected={sp.sales}
          now={now}
          cfg={cfg}
          supabase={supabase}
          isSalesperson={hasFunction(me, "SALESPERSON")}
        />
      ) : (
        <ExecView rows={all} now={now} cfg={cfg} supabase={supabase} />
      )}
    </div>
  );
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function SalesView({
  rows,
  sees,
  selected,
  now,
  cfg,
  supabase,
  isSalesperson,
}: {
  rows: Pick<PricingProposal, "id" | "created_by" | "current_status" | "outcome" | "released_at" | "transaction_value">[];
  sees: boolean;
  selected?: string;
  now: Date;
  cfg: ReturnType<typeof ageConfigFrom>;
  supabase: Db;
  isSalesperson: boolean;
}) {
  const perPerson = salesKpiByPerson(rows, now, cfg);
  const ids = [...perPerson.keys()];
  const { data: people } = ids.length
    ? await supabase.from("profile").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameOf = (id: string) => ((people ?? []) as Pick<Profile, "id" | "full_name">[]).find((p) => p.id === id)?.full_name ?? "—";

  const chosen = sees && selected && perPerson.has(selected) ? selected : null;
  const kpi = salesKpi(chosen ? rows.filter((r) => r.created_by === chosen) : rows, now, cfg);
  const people2 = [...perPerson.entries()].sort((a, b) => b[1].sent - a[1].sent);

  return (
    <>
      {sees && people2.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Pilih Salesperson">
          <Link href="/dashboard?view=sales" className={chip(!chosen)}>Semua Salesperson</Link>
          {people2.map(([id]) => (
            <Link key={id} href={`/dashboard?view=sales&sales=${id}`} className={chip(chosen === id)}>
              {nameOf(id)}
            </Link>
          ))}
        </div>
      )}

      <KpiGrid kpi={kpi} />

      <Card>
        <CardHeader>
          <CardTitle>Kondisi quotation terkirim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Bar label="Hijau — aktif" value={kpi.green} total={kpi.sent} color="bg-success" />
          <Bar label="Kuning — follow up" value={kpi.yellow} total={kpi.sent} color="bg-warning" />
          <Bar label="Merah — perlu quotation baru" value={kpi.red} total={kpi.sent} color="bg-danger" />
          <Bar label="Won" value={kpi.won} total={kpi.sent} color="bg-sky-600" />
          <Bar label="Lost" value={kpi.lost} total={kpi.sent} color="bg-slate-500" />
          <Bar label="Expired" value={kpi.expired} total={kpi.sent} color="bg-slate-400" />
          <p className="text-[11px] text-muted">
            Umur dihitung dari tanggal rilis (kuning ≥ {cfg.yellowDays} hari, merah ≥ {cfg.redDays} hari).
          </p>
        </CardContent>
      </Card>

      {sees && !chosen && people2.length > 1 && !isSalesperson && (
        <Card>
          <CardHeader>
            <CardTitle>Per Salesperson</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TableScroll>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                    <th className="px-5 py-3 font-medium">Salesperson</th>
                    <th className="px-3 py-3 text-right font-medium">Terkirim</th>
                    <th className="px-3 py-3 text-right font-medium">Won</th>
                    <th className="px-3 py-3 text-right font-medium">Lost</th>
                    <th className="px-3 py-3 text-right font-medium">Kuning</th>
                    <th className="px-3 py-3 text-right font-medium">Merah</th>
                    <th className="px-5 py-3 text-right font-medium">Nilai Won</th>
                  </tr>
                </thead>
                <tbody>
                  {people2.map(([id, k]) => (
                    <tr key={id} className="border-b border-card-border last:border-0">
                      <td className="px-5 py-3 font-medium">
                        <Link className="hover:text-primary" href={`/dashboard?view=sales&sales=${id}`}>{nameOf(id)}</Link>
                      </td>
                      <td className="px-3 py-3 text-right">{k.sent}</td>
                      <td className="px-3 py-3 text-right">{k.won}</td>
                      <td className="px-3 py-3 text-right">{k.lost}</td>
                      <td className="px-3 py-3 text-right">{k.yellow}</td>
                      <td className="px-3 py-3 text-right">{k.red}</td>
                      <td className="px-5 py-3 text-right">{formatCompactIDR(k.wonValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function KpiGrid({ kpi }: { kpi: SalesKpi }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Proposal terkirim" value={String(kpi.sent)} hint={`${formatCompactIDR(kpi.sentValue)} excl. VAT`} />
      <Stat label="Won" value={String(kpi.won)} hint={`${formatCompactIDR(kpi.wonValue)} excl. VAT`} tone="success" />
      <Stat label="Lost" value={String(kpi.lost)} hint={`Expired: ${kpi.expired}`} tone={kpi.lost ? "danger" : "default"} />
      <Stat
        label="Perlu follow up"
        value={String(kpi.followUp)}
        hint={`${kpi.yellow} kuning · ${kpi.red} merah`}
        tone={kpi.followUp ? "warning" : "default"}
      />
    </div>
  );
}

async function ExecView({
  rows,
  now,
  cfg,
  supabase,
}: {
  rows: Pick<PricingProposal, "created_by" | "current_status" | "outcome" | "released_at" | "transaction_value">[];
  now: Date;
  cfg: ReturnType<typeof ageConfigFrom>;
  supabase: Db;
}) {
  const [{ data: projectRows }, { data: termRows }] = await Promise.all([
    supabase.from("project").select("id, contract_value_ex_vat, current_progress_pct"),
    supabase.from("project_payment_term").select("project_id, status, planned_pct, planned_amount, received_amount"),
  ]);
  const s = executiveSummary(
    rows,
    (projectRows ?? []) as Pick<Project, "id" | "contract_value_ex_vat" | "current_progress_pct">[],
    (termRows ?? []) as Pick<ProjectPaymentTerm, "project_id" | "status" | "planned_pct" | "planned_amount" | "received_amount">[],
    now,
    cfg
  );
  const totalProjects = s.projects.notStarted + s.projects.running + s.projects.done;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Quotation terkirim" value={String(s.sent)} hint={`Expired: ${s.expired}`} />
        <Stat label="Won" value={String(s.won)} hint={`${Math.round(s.winRate * 100)}% dari terkirim · Lost ${s.lost}`} tone="success" />
        <Stat label="PO diterima" value={String(s.poCount)} hint={`${formatCompactIDR(s.poValue)} total nilai project`} tone="success" />
        <Stat
          label="Payment diterima"
          value={`${s.termsReceived}/${s.termCount}`}
          hint={`${formatCompactIDR(s.receivedAmount)} dari ${formatCompactIDR(s.plannedAmount)} (termin)`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dari quotation terkirim</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Bar label="Won" value={s.won} total={s.sent} color="bg-sky-600" />
            <Bar label="Lost" value={s.lost} total={s.sent} color="bg-slate-500" />
            <Bar label="Expired" value={s.expired} total={s.sent} color="bg-slate-400" />
            <Bar label="Masih berjalan" value={Math.max(0, s.sent - s.won - s.lost - s.expired)} total={s.sent} color="bg-success" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status project</CardTitle>
            <span className="text-xs text-muted">rata-rata progres {s.projects.avgProgressPct}%</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <Bar label="Belum ada progres" value={s.projects.notStarted} total={totalProjects} color="bg-slate-400" />
            <Bar label="Berjalan" value={s.projects.running} total={totalProjects} color="bg-sky-600" />
            <Bar label="Selesai (100%)" value={s.projects.done} total={totalProjects} color="bg-success" />
            <Link href="/projects" className="inline-block text-xs text-primary hover:underline">Lihat semua project →</Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function chip(active: boolean) {
  return `inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium ${
    active ? "border-primary bg-blue-50 text-primary" : "border-card-border bg-white text-slate-600 hover:bg-slate-50"
  }`;
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const color = { default: "text-foreground", success: "text-success", warning: "text-warning", danger: "text-danger" }[tone];
  return (
    <Card>
      <CardContent className="space-y-1 py-3">
        <div className="text-[11px] text-muted">{label}</div>
        <div className={`text-2xl font-semibold ${color}`}>{value}</div>
        {hint && <div className="text-[11px] text-muted">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-muted">
          {value} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
