import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCompactIDR, timeAgo } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/workflow/labels";
import { ROLE_LABELS } from "@/lib/rbac";
import type { PricingProposal, WorkflowStepInstance } from "@/types/database";
import Link from "next/link";
import {
  FileStack,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
} from "lucide-react";

export default async function OverviewPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: proposalsData } = await supabase
    .from("pricing_proposal")
    .select("*")
    .order("updated_at", { ascending: false });

  const proposals = (proposalsData ?? []) as PricingProposal[];

  const activeProposals = proposals.filter(
    (p) => p.current_status !== "DRAFT" && p.current_status !== "QUOTATION_RELEASED" && p.current_status !== "REJECTED"
  );
  const finalApproved = proposals.filter((p) => p.current_status === "QUOTATION_RELEASED");
  const configErrors = proposals.filter((p) => p.current_status === "CONFIG_ERROR");

  const { data: breachedSteps } = await supabase
    .from("workflow_step_instance")
    .select("*")
    .eq("status", "IN_PROGRESS")
    .lt("sla_due_at", new Date().toISOString());

  const breached = (breachedSteps ?? []) as WorkflowStepInstance[];

  const { data: belowThreshold } = await supabase
    .from("proposal_calculation_result")
    .select("id, is_below_gpm_threshold, pricing_proposal_version!inner(is_current)")
    .eq("is_below_gpm_threshold", true)
    .eq("pricing_proposal_version.is_current", true);

  const totalPipelineValue = activeProposals.reduce((sum, p) => sum + p.transaction_value, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          Selamat datang, <span className="font-medium text-foreground">{profile.full_name}</span>
          {" "}&middot; {ROLE_LABELS[profile.role]}
        </p>
        <h1 className="text-xl font-semibold mt-1">Executive Overview</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileStack}
          label="Proposal Dalam Proses"
          value={String(activeProposals.length)}
          hint={`Total nilai pipeline ${formatCompactIDR(totalPipelineValue)}`}
        />
        <StatCard
          icon={ShieldCheck}
          label="Final Approved"
          value={String(finalApproved.length)}
          hint="Siap diekspor ke ERP"
          tone="success"
        />
        <StatCard
          icon={Clock}
          label="SLA Breached"
          value={String(breached.length)}
          hint="Step tertahan melebihi SLA"
          tone={breached.length > 0 ? "danger" : "default"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Margin Guardrail Alerts"
          value={String(belowThreshold?.length ?? 0)}
          hint="Proposal di bawah GPM threshold"
          tone={(belowThreshold?.length ?? 0) > 0 ? "danger" : "default"}
        />
      </div>

      {configErrors.length > 0 && (
        <Card className="border-danger/30">
          <CardContent className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle size={16} />
            {configErrors.length} proposal berstatus CONFIG_ERROR — tidak ada
            Workflow Definition yang cocok untuk nilai transaksinya. Perlu
            ditambahkan di Workflow Admin.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Aktivitas Proposal Terbaru</CardTitle>
            <Link href="/lifecycle" className="text-xs text-primary flex items-center gap-1 hover:underline">
              Lihat semua <ArrowRight size={12} />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {proposals.slice(0, 8).map((p) => (
                  <tr key={p.id} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/proposals/${p.id}`} className="font-medium hover:text-primary">
                        {p.title}
                      </Link>
                      <div className="text-[11px] text-muted font-mono">{p.proposal_number}</div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[p.current_status]}>{STATUS_LABEL[p.current_status]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted text-right whitespace-nowrap">
                      {timeAgo(p.updated_at)}
                    </td>
                  </tr>
                ))}
                {proposals.length === 0 && (
                  <tr>
                    <td className="px-5 py-10 text-center text-sm text-muted">
                      Belum ada proposal.{" "}
                      <Link href="/proposals/new" className="text-primary hover:underline">
                        Buat yang pertama
                      </Link>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickLink href="/proposals/new" label="Buat Pricing Proposal Baru" />
            <QuickLink href="/dss" label="Buka What-If Simulator" />
            <QuickLink href="/lifecycle" label="Lihat Kanban Approval" />
            <QuickLink href="/audit-log" label="Telusuri Audit Trail" />
            <QuickLink href="/master-data" label="Kelola Master Data CBS" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "success" | "danger";
}) {
  const toneClasses = {
    default: "text-primary bg-blue-50",
    success: "text-success bg-success-bg",
    danger: "text-danger bg-danger-bg",
  }[tone];

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon size={16} />
        </div>
        <div className="text-[11px] text-muted">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
        <div className="text-[11px] text-muted">{hint}</div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-card-border px-3 py-2.5 text-xs font-medium hover:bg-slate-50"
    >
      {label}
      <ArrowRight size={13} className="text-muted" />
    </Link>
  );
}
