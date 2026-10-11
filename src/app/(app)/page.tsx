import { createClient } from "@/lib/supabase/server";
import { canViewQuotation, loadValidatorVisibleRoles, requireMenu } from "@/lib/menuAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCompactIDR, timeAgo } from "@/lib/utils";
import { IN_FLIGHT_STATUSES, STATUS_LABEL, STATUS_TONE } from "@/lib/workflow/labels";
import { actorFillsSlot, canAttachSignedDocument, functionsOf, hasFunction, roleLabel } from "@/lib/rbac";
import { loadSettings } from "@/lib/settings";
import { ageConfigFrom, quotationAgeState } from "@/lib/lifecycle";
import { TableScroll } from "@/components/ui/TableScroll";
import { expireStaleQuotations } from "@/lib/workflow/quotationEngine";
import type { PricingProposal, TierApproval, WorkflowStepInstance } from "@/types/database";
import Link from "next/link";
import { FileStack, ShieldCheck, AlertTriangle, Clock, ArrowRight, Inbox } from "lucide-react";

export default async function OverviewPage() {
  const profile = await requireMenu("overview");
  const supabase = await createClient();
  await expireStaleQuotations(supabase, profile.id);

  const [{ data: proposalsData }, { data: openSteps }, { data: openTier }, { data: breachedRows }] = await Promise.all([
    supabase.from("pricing_proposal").select("*").order("updated_at", { ascending: false }),
    supabase.from("workflow_step_instance").select("*, workflow_instance!inner(status, proposal_version_id)").eq("status", "IN_PROGRESS"),
    supabase.from("tier_approval").select("*").eq("kind", "DECISION").eq("is_void", false).is("decision", null),
    supabase.from("workflow_step_instance").select("id").eq("status", "IN_PROGRESS").lt("sla_due_at", new Date().toISOString()),
  ]);

  const [validatorRoles, settings] = await Promise.all([loadValidatorVisibleRoles(supabase), loadSettings(supabase)]);
  const proposals = ((proposalsData ?? []) as PricingProposal[]).filter((p) => canViewQuotation(profile, p, validatorRoles));
  const byVersion = new Map(proposals.map((p) => [p.current_version_id, p]));
  const inFlight = proposals.filter((p) => IN_FLIGHT_STATUSES.includes(p.current_status));
  const released = proposals.filter((p) => p.current_status === "QUOTATION_RELEASED");
  const steps = (openSteps ?? []) as (WorkflowStepInstance & { workflow_instance: { proposal_version_id: string } })[];
  const breached = breachedRows ?? [];
  const myFns = functionsOf(profile);

  // "Waiting for me": active steps my functional role performs + tier slots I fill.
  const myQueue = new Map<string, { proposal: PricingProposal; what: string }>();
  for (const s of steps) {
    const p = byVersion.get(s.workflow_instance.proposal_version_id);
    if (p && s.performer_function && myFns.includes(s.performer_function)) {
      myQueue.set(p.id, { proposal: p, what: s.step_name ?? "Langkah aktif" });
    }
  }
  const proposalById = new Map(proposals.map((p) => [p.id, p]));
  for (const t of (openTier ?? []) as TierApproval[]) {
    const p = proposalById.get(t.proposal_id);
    if (p && p.tier_round === t.round && actorFillsSlot(profile, t.slot)) {
      myQueue.set(p.id, { proposal: p, what: `Persetujuan Tier ${t.tier}` });
    }
  }
  const now = new Date();
  const ageCfg = ageConfigFrom(settings);
  for (const p of proposals) {
    if (p.current_status === "DRAFT" && p.created_by === profile.id) myQueue.set(p.id, { proposal: p, what: "Draft — lengkapi & submit" });
    // v5.0: the Head of Sales has approved; the Salesperson attaches the signed document (PRD FR-2.11).
    if (p.current_status === "PENDING_SIGNED_DOCUMENT" && canAttachSignedDocument(profile, p) && !hasFunction(profile, "SYSTEM_ADMIN")) {
      myQueue.set(p.id, { proposal: p, what: "Lampirkan dokumen bertanda tangan Head of Sales" });
    }
    // v5.0: follow-up list for the Salesperson who owns it (yellow = follow up, red = make a new quotation).
    if (hasFunction(profile, "SALESPERSON") && (p.created_by === profile.id || (p.account_person_ids ?? []).includes(profile.id))) {
      const age = quotationAgeState(p, now, ageCfg);
      if (age === "YELLOW") myQueue.set(p.id, { proposal: p, what: "Follow up pelanggan (kuning)" });
      if (age === "RED") myQueue.set(p.id, { proposal: p, what: "Lewat batas — buat quotation baru atau nyatakan hasil (merah)" });
    }
  }

  const tierPending = proposals.filter((p) => p.current_status === "PENDING_OWNER_APPROVAL" || p.current_status === "PENDING_PRICING_COMMITTEE_APPROVAL");
  const pipeline = inFlight.reduce((s, p) => s + Number(p.total_ex_vat || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          Selamat datang, <span className="font-medium text-foreground">{profile.full_name}</span> · {roleLabel(profile)}
        </p>
        <h1 className="mt-1 text-xl font-semibold">Executive Overview</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileStack} label="Quotation dalam proses" value={String(inFlight.length)} hint={`Pipeline ${formatCompactIDR(pipeline)} excl. VAT`} />
        <StatCard icon={ShieldCheck} label="Quotation Released (berlaku)" value={String(released.length)} hint="Siap dikirim / menunggu tanda tangan" tone="success" />
        <StatCard icon={AlertTriangle} label="Menunggu approval tier" value={String(tierPending.length)} hint="GM < 15% (Tier 2) atau < 10% (Tier 3)" tone={tierPending.length ? "danger" : "default"} />
        <StatCard icon={Clock} label="SLA terlewati" value={String(breached.length)} hint="Langkah melewati batas SLA" tone={breached.length ? "danger" : "default"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Inbox size={15} /> Menunggu tindakan Anda</CardTitle>
            <Badge tone={myQueue.size ? "warning" : "success"}>{myQueue.size}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <TableScroll>
            <table className="w-full min-w-[560px] text-sm">
              <tbody>
                {[...myQueue.values()].map(({ proposal: p, what }) => (
                  <tr key={p.id} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/proposals/${p.id}`} className="font-medium hover:text-primary">{p.title}</Link>
                      <div className="font-mono text-[11px] text-muted">{p.proposal_number}</div>
                    </td>
                    <td className="px-5 py-3 text-xs">{what}</td>
                    <td className="px-5 py-3"><Badge tone={STATUS_TONE[p.current_status]}>{STATUS_LABEL[p.current_status]}</Badge></td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-muted">{timeAgo(p.updated_at)}</td>
                  </tr>
                ))}
                {myQueue.size === 0 && (
                  <tr><td className="px-5 py-10 text-center text-sm text-muted">Tidak ada yang menunggu Anda.</td></tr>
                )}
              </tbody>
            </table>
            </TableScroll>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick Links</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <QuickLink href="/price-estimate" label="Price Estimate per unit" />
            {myFns.some((f) => ["SALESPERSON", "SALES_OPERATIONS", "SALES_RELEASER", "SYSTEM_ADMIN"].includes(f)) && <QuickLink href="/dashboard" label="Dashboard" />}
            {myFns.some((f) => ["SALESPERSON", "SALES_OPERATIONS", "SALES_RELEASER", "SYSTEM_ADMIN"].includes(f)) && <QuickLink href="/projects" label="Projects" />}
            {myFns.includes("SALESPERSON") && <QuickLink href="/proposals/new" label="Official Quotation baru (KYC)" />}
            <QuickLink href="/lifecycle" label="Kanban approval" />
            {myFns.some((f) => ["COGS_OWNER", "PROFITABILITY_OWNER", "SALES_PRICING_OWNER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"].includes(f)) && (
              <QuickLink href="/cost-structure" label="Cost Structure (Maker/Checker/Releaser)" />
            )}
            {myFns.includes("SYSTEM_ADMIN") && <QuickLink href="/settings" label="Settings: role & workflow" />}
            <QuickLink href="/audit-log" label="Audit Trail" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktivitas terbaru</CardTitle>
          <Link href="/lifecycle" className="flex items-center gap-1 text-xs text-primary hover:underline">Lihat semua <ArrowRight size={12} /></Link>
        </CardHeader>
        <CardContent className="p-0">
          <TableScroll>
          <table className="w-full min-w-[520px] text-sm">
            <tbody>
              {proposals.slice(0, 8).map((p) => (
                <tr key={p.id} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/proposals/${p.id}`} className="font-medium hover:text-primary">{p.title}</Link>
                    <div className="font-mono text-[11px] text-muted">{p.document_number ?? p.proposal_number}</div>
                  </td>
                  <td className="px-5 py-3"><Badge tone={STATUS_TONE[p.current_status]}>{STATUS_LABEL[p.current_status]}</Badge></td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-muted">{timeAgo(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableScroll>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone = "default" }: { icon: React.ElementType; label: string; value: string; hint: string; tone?: "default" | "success" | "danger" }) {
  const toneClasses = { default: "text-primary bg-blue-50", success: "text-success bg-success-bg", danger: "text-danger bg-danger-bg" }[tone];
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses}`}><Icon size={16} /></div>
        <div className="text-[11px] text-muted">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
        <div className="text-[11px] text-muted">{hint}</div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border border-card-border px-3 py-2.5 text-xs font-medium hover:bg-slate-50">
      {label}
      <ArrowRight size={13} className="text-muted" />
    </Link>
  );
}
