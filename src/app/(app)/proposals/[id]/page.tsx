import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/workflow/labels";
import { CostLineForm } from "./CostLineForm";
import { CalculationSummary } from "./CalculationSummary";
import { WorkflowPanel } from "./WorkflowPanel";
import { SubmitButton } from "./SubmitButton";
import { OutcomePanel } from "./OutcomePanel";
import { canRecordWinLossOutcome, ROLE_DEPARTMENT_CODE } from "@/lib/rbac";
import type {
  CbsTemplate,
  CostItem,
  Department,
  PricingProposal,
  ProposalCalculationResult,
  ProposalCostLine,
  WorkflowStepInstance,
} from "@/types/database";
import { formatDate } from "@/lib/utils";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: proposalRow } = await supabase
    .from("pricing_proposal")
    .select("*")
    .eq("id", id)
    .single();

  if (!proposalRow) notFound();
  const proposal = proposalRow as PricingProposal;

  // Resolve the active version. `current_version_id` can be null for rows
  // created before that column existed, so fall back to the newest version
  // of this proposal rather than 500-ing on a null lookup.
  let versionId = proposal.current_version_id;
  if (!versionId) {
    const { data: fallbackVersion } = await supabase
      .from("pricing_proposal_version")
      .select("id")
      .eq("proposal_id", proposal.id)
      .order("is_current", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    versionId = fallbackVersion?.id ?? null;
  }

  if (!versionId) notFound();

  const [{ data: version }, { data: template }, { data: departments }] = await Promise.all([
    supabase
      .from("pricing_proposal_version")
      .select("*")
      .eq("id", versionId)
      .maybeSingle(),
    supabase.from("cbs_template").select("*").eq("id", proposal.cbs_template_id).single(),
    supabase.from("department").select("*"),
  ]);

  const { data: templateItems } = await supabase
    .from("cbs_template_item")
    .select("cost_item_id, cost_item(*)")
    .eq("template_id", proposal.cbs_template_id);

  const costItems: CostItem[] = (templateItems ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => row.cost_item)
    .filter(Boolean)
    .sort((a: CostItem, b: CostItem) => a.category.localeCompare(b.category));

  const { data: costLines } = await supabase
    .from("proposal_cost_line")
    .select("*")
    .eq("proposal_version_id", versionId);

  const existingValues = Object.fromEntries(
    ((costLines ?? []) as ProposalCostLine[]).map((l) => [l.cost_item_id, Number(l.value)])
  );

  const { data: latestResult } = await supabase
    .from("proposal_calculation_result")
    .select("*")
    .eq("proposal_version_id", versionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const depts = (departments ?? []) as Department[];
  const ownerDeptCodeById = Object.fromEntries(depts.map((d) => [d.id, d.code]));

  let steps: WorkflowStepInstance[] = [];
  if (proposal.current_status !== "DRAFT") {
    const { data: instance } = await supabase
      .from("workflow_instance")
      .select("*")
      .eq("proposal_version_id", versionId)
      .maybeSingle();

    if (instance) {
      const { data: stepInstances } = await supabase
        .from("workflow_step_instance")
        .select("*")
        .eq("workflow_instance_id", instance.id)
        .order("step_order");
      steps = (stepInstances ?? []) as WorkflowStepInstance[];
    }
  }

  // Cost lines stay editable while the workflow is in flight, but only for
  // the department whose step is currently active — that is what lets
  // Engineering enter indirect costs at step 2 and Finance enter margin
  // factors at step 3. A DRAFT is open to whoever is preparing it, and a
  // closed proposal is locked to everyone.
  const activeStep = steps.find((s) => s.status === "IN_PROGRESS");
  const activeDeptCode = activeStep
    ? ownerDeptCodeById[activeStep.department_id]
    : null;

  const isClosed =
    proposal.current_status === "FINAL_APPROVED" ||
    proposal.current_status === "REJECTED";

  const isReadOnly =
    isClosed ||
    (proposal.current_status !== "DRAFT" &&
      ROLE_DEPARTMENT_CODE[profile.role] !== activeDeptCode);

  const tmpl = template as CbsTemplate;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted">{proposal.proposal_number}</span>
            <Badge tone={STATUS_TONE[proposal.current_status]}>
              {STATUS_LABEL[proposal.current_status]}
            </Badge>
            <span className="text-xs text-muted">{version?.version_label}</span>
          </div>
          <h1 className="text-xl font-semibold mt-1">{proposal.title}</h1>
          <p className="text-sm text-muted mt-0.5">
            {proposal.customer_name ?? "Tanpa nama customer"} &middot;{" "}
            {proposal.business_line.replaceAll("_", " ")} &middot; {proposal.unit_quantity} unit
            &middot; dibuat {formatDate(proposal.created_at)}
          </p>
        </div>

        {proposal.current_status === "DRAFT" && <SubmitButton proposalId={proposal.id} />}
      </div>

      {proposal.current_status === "FINAL_APPROVED" && (
        <Card>
          <CardContent className="py-3">
            <OutcomePanel
              proposalId={proposal.id}
              outcome={proposal.outcome}
              canRecord={canRecordWinLossOutcome(profile.role)}
            />
          </CardContent>
        </Card>
      )}

      {latestResult && (
        <CalculationSummary
          result={latestResult as ProposalCalculationResult}
          role={profile.role}
          minGpmThreshold={tmpl.min_gpm_threshold}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>CBS Cost Line Input</CardTitle>
            </CardHeader>
            <CardContent>
              <CostLineForm
                proposalId={proposal.id}
                versionId={versionId}
                costItems={costItems}
                existingValues={existingValues}
                ownerDeptCodeById={ownerDeptCodeById}
                readOnly={isReadOnly}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {steps.length > 0 ? (
            <WorkflowPanel
              proposalId={proposal.id}
              steps={steps}
              departments={depts}
              role={profile.role}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted">
                Workflow belum dimulai. Lengkapi CBS cost lines lalu klik &quot;Submit
                untuk Approval&quot;.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
