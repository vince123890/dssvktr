import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewProject, requireMenu } from "@/lib/menuAccess";
import { canRecordProjectProgress, canSetPaymentTerms, canUpdatePaymentStatus } from "@/lib/rbac";
import { signedUrl } from "@/lib/files";
import { paymentLabel, paymentSummary } from "@/lib/projects";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCompactIDR, formatDate } from "@/lib/utils";
import type { PricingProposal, Profile, Project, ProjectPaymentTerm, ProjectProgressEntry } from "@/types/database";
import { PaymentTerms, type TermView } from "./PaymentTerms";
import { ProgressTracker, type ProgressView } from "./ProgressTracker";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMenu("projects");
  const supabase = await createClient();

  const { data: projectRow } = await supabase.from("project").select("*").eq("id", id).maybeSingle();
  if (!projectRow) notFound();
  const project = projectRow as Project;

  const { data: proposalRow } = await supabase.from("pricing_proposal").select("*").eq("id", project.proposal_id).single();
  const proposal = proposalRow as PricingProposal | null;
  if (!proposal || !canViewProject(me, proposal)) notFound();

  const [{ data: termRows }, { data: entryRows }, poLink] = await Promise.all([
    supabase.from("project_payment_term").select("*").eq("project_id", id).order("term_no"),
    supabase.from("project_progress_entry").select("*").eq("project_id", id).order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
    signedUrl(supabase, project.po_document_path),
  ]);
  const terms = (termRows ?? []) as ProjectPaymentTerm[];
  const entries = (entryRows ?? []) as ProjectProgressEntry[];

  const authorIds = [...new Set(entries.map((e) => e.created_by).filter(Boolean) as string[])];
  const { data: people } = authorIds.length
    ? await supabase.from("profile").select("id, full_name").in("id", authorIds)
    : { data: [] };
  const nameOf = (pid: string | null) =>
    ((people ?? []) as Pick<Profile, "id" | "full_name">[]).find((p) => p.id === pid)?.full_name ?? "—";

  const termViews: TermView[] = await Promise.all(
    terms.map(async (t) => ({
      id: t.id,
      termNo: t.term_no,
      label: t.label,
      plannedPct: t.planned_pct !== null ? Number(t.planned_pct) : null,
      plannedAmount: t.planned_amount !== null ? Number(t.planned_amount) : null,
      dueDate: t.due_date,
      status: t.status,
      receivedAmount: t.received_amount !== null ? Number(t.received_amount) : null,
      receivedAt: t.received_at,
      proofUrl: await signedUrl(supabase, t.proof_path),
    }))
  );
  const progressViews: ProgressView[] = entries.map((e) => ({
    id: e.id,
    entryDate: e.entry_date,
    statusLabel: e.status_label,
    progressPct: e.progress_pct,
    note: e.note,
    author: nameOf(e.created_by),
  }));

  const contract = Number(project.contract_value_ex_vat);
  const pay = paymentSummary(terms, contract);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="text-xs text-primary hover:underline">← Semua project</Link>
        <h1 className="mt-1 text-xl font-semibold">{project.customer_name ?? proposal.title}</h1>
        <p className="mt-0.5 text-sm text-muted">
          Quotation{" "}
          <Link href={`/proposals/${proposal.id}`} className="font-mono text-primary hover:underline">
            {proposal.document_number ?? proposal.proposal_number}
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nilai kontrak (excl. VAT)" value={formatCompactIDR(contract)} />
        <Stat
          label="Nomor PO"
          value={project.po_number ?? "—"}
          hint={project.po_received_at ? `diterima ${formatDate(project.po_received_at)}` : undefined}
          link={poLink ? { href: poLink, text: "Buka bukti PO" } : undefined}
        />
        <Stat label="Payment" value={paymentLabel(pay)} hint={pay.termCount ? `${formatCompactIDR(pay.receivedAmount)} dari ${formatCompactIDR(pay.plannedAmount)}` : undefined} />
        <Stat label="Status project" value={project.current_status ?? "Belum ada progres"} badge={`${project.current_progress_pct}%`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaymentTerms
          projectId={project.id}
          terms={termViews}
          contractValueExVat={contract}
          canSet={canSetPaymentTerms(me, proposal)}
          canUpdateStatus={canUpdatePaymentStatus(me)}
        />
        <ProgressTracker projectId={project.id} entries={progressViews} canRecord={canRecordProjectProgress(me)} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  badge,
  link,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  link?: { href: string; text: string };
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-3">
        <div className="text-[11px] text-muted">{label}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          <span className="break-words">{value}</span>
          {badge && <Badge tone="info">{badge}</Badge>}
        </div>
        {hint && <div className="text-[11px] text-muted">{hint}</div>}
        {link && (
          <a className="text-[11px] text-primary underline" href={link.href} target="_blank" rel="noreferrer">
            {link.text}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
