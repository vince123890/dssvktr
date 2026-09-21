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
import { NegotiationPanel } from "./NegotiationPanel";
import { RecalculateButton } from "./RecalculateButton";
import { CreateRevisionButton } from "./CreateRevisionButton";
import { QuotationPreview } from "./QuotationPreview";
import {
  canRecordWinLossOutcome,
  canRequestDiscount,
  ROLE_DEPARTMENT_CODE,
} from "@/lib/rbac";
import { loadMineralContext } from "@/lib/pricing/mineral";
import { resolveExchangeRate } from "@/lib/pricing/currency";
import { evaluatePriceStaleness } from "@/lib/pricing/staleness";
import { checkRateSensitivity } from "@/lib/pricing/rateSensitivity";
import { PriceStalenessBadge } from "@/components/ui/PriceStalenessBadge";
import type {
  CbsTemplate,
  CostItem,
  Department,
  NegotiationDecision,
  NegotiationRequest,
  PricingProposal,
  ProductMasterData,
  ProjectIdentifier,
  Profile,
  ProposalCalculationResult,
  ProposalCostLine,
  WorkflowStepInstance,
} from "@/types/database";
import { formatDate } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

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

  const [{ data: version }, { data: template }, { data: departments }, { data: projectIdentifier }] =
    await Promise.all([
      supabase
        .from("pricing_proposal_version")
        .select("*")
        .eq("id", versionId)
        .maybeSingle(),
      supabase.from("cbs_template").select("*").eq("id", proposal.cbs_template_id).single(),
      supabase.from("department").select("*"),
      supabase
        .from("project_identifier")
        .select("*")
        .eq("id", proposal.project_identifier_id)
        .maybeSingle(),
    ]);

  const { data: templateItems } = await supabase
    .from("cbs_template_item")
    .select("cost_item_id, cost_item(*)")
    .eq("template_id", proposal.cbs_template_id);

  const costItems: CostItem[] = (templateItems ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => row.cost_item)
    .filter(Boolean)
    .sort((a: CostItem, b: CostItem) => a.cost_group.localeCompare(b.cost_group));

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

  const [{ data: negotiations }, mineralContext, currentExchangeRate, rateSensitivity, { data: projectSiblings }] =
    await Promise.all([
      supabase
        .from("negotiation_request")
        .select("*")
        .eq("proposal_id", proposal.id)
        .order("created_at", { ascending: false }),
      loadMineralContext(supabase),
      resolveExchangeRate(supabase),
      checkRateSensitivity(supabase, proposal),
      supabase
        .from("pricing_proposal")
        .select("id, proposal_number, current_status, created_at")
        .eq("project_identifier_id", proposal.project_identifier_id)
        .order("created_at", { ascending: true }),
    ]);

  const negotiationRequests = (negotiations ?? []) as NegotiationRequest[];

  let decisionsByRequestId: Record<string, NegotiationDecision[]> = {};
  if (negotiationRequests.length > 0) {
    const { data: decisionRows } = await supabase
      .from("negotiation_decision")
      .select("*")
      .in(
        "negotiation_request_id",
        negotiationRequests.map((r) => r.id)
      );

    decisionsByRequestId = (decisionRows ?? []).reduce(
      (acc: Record<string, NegotiationDecision[]>, d: NegotiationDecision) => {
        (acc[d.negotiation_request_id] ??= []).push(d);
        return acc;
      },
      {}
    );
  }

  const staleness = evaluatePriceStaleness(
    latestResult as ProposalCalculationResult | null,
    currentExchangeRate,
    mineralContext
  );

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

  // FR-1.5.2/FR-1.5.3 — quotation document preview: the product this
  // version quotes, and approval step metadata with human-readable
  // department/actor names.
  const productMasterDataId = (version as { product_master_data_id?: string | null } | null)
    ?.product_master_data_id;

  const [{ data: productRow }, { data: actorProfiles }] = await Promise.all([
    productMasterDataId
      ? supabase.from("product_master_data").select("*").eq("id", productMasterDataId).maybeSingle()
      : Promise.resolve({ data: null }),
    steps.length > 0
      ? supabase
          .from("profile")
          .select("id, full_name")
          .in("id", steps.map((s) => s.actor_id).filter((id): id is string => Boolean(id)))
      : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
  ]);

  const product = productRow as ProductMasterData | null;
  const actorNameById = Object.fromEntries(
    (actorProfiles ?? []).map((p: Pick<Profile, "id" | "full_name">) => [p.id, p.full_name])
  );
  const deptNameById = Object.fromEntries(depts.map((d) => [d.id, d.name]));
  const approvalSteps = steps.map((s) => ({
    stepOrder: s.step_order,
    departmentName: deptNameById[s.department_id] ?? "—",
    status: s.status,
    actorName: s.actor_id ? actorNameById[s.actor_id] ?? null : null,
    completedAt: s.completed_at,
  }));

  // Cost lines stay editable while the workflow is in flight, but only for
  // the COGS Owner whose step is currently active — that is what lets VP
  // Operations enter COGS/Add-Ons costs while VP Finance enters
  // Profitability, in the sequential order VP Operations -> VP Finance ->
  // Chief Sales (PRD FR-2.0). A DRAFT is open to whoever is preparing it,
  // and a released/superseded quotation is locked to everyone.
  const myDeptCode = ROLE_DEPARTMENT_CODE[profile.role];
  const hasActiveStepForMe = steps.some(
    (s) =>
      s.status === "IN_PROGRESS" && ownerDeptCodeById[s.department_id] === myDeptCode
  );

  const isClosed =
    proposal.current_status === "QUOTATION_RELEASED" ||
    proposal.current_status === "SUPERSEDED" ||
    proposal.current_status === "REJECTED";

  const isReadOnly =
    isClosed ||
    (proposal.current_status !== "DRAFT" && !hasActiveStepForMe);

  const tmpl = template as CbsTemplate;
  const project = projectIdentifier as ProjectIdentifier | null;
  const siblings = (projectSiblings ?? []).filter((p) => p.id !== proposal.id);

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
            <PriceStalenessBadge info={staleness} />
          </div>
          <h1 className="text-xl font-semibold mt-1">{proposal.title}</h1>
          <p className="text-sm text-muted mt-0.5">
            {proposal.customer_name ?? "Tanpa nama customer"} &middot;{" "}
            {proposal.business_line.replaceAll("_", " ")} &middot; {proposal.unit_quantity} unit
            &middot; dibuat {formatDate(proposal.created_at)}
          </p>
          {project && (
            <p className="text-xs text-muted mt-1">
              Project Identifier:{" "}
              <span className="font-mono">{project.identifier_code}</span>
              {siblings.length > 0 && (
                <span className="ml-1.5">
                  &middot; {siblings.length} quotation lain pada project ini
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <QuotationPreview
            proposal={proposal}
            project={project}
            result={latestResult as ProposalCalculationResult | null}
            product={product}
            approvalSteps={approvalSteps}
            viewerRole={profile.role}
          />
          {proposal.current_status === "DRAFT" && <SubmitButton proposalId={proposal.id} />}
          {proposal.current_status === "QUOTATION_RELEASED" && (
            <CreateRevisionButton proposalId={proposal.id} />
          )}
        </div>
      </div>

      {rateSensitivity.needsAttention && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">{rateSensitivity.message}</span>
          <RecalculateButton proposalId={proposal.id} versionId={versionId} />
        </div>
      )}

      {proposal.current_status === "QUOTATION_RELEASED" && (
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
          mineral={mineralContext}
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
                viewerRole={profile.role}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {proposal.current_status !== "DRAFT" && (
            <NegotiationPanel
              proposalId={proposal.id}
              requests={negotiationRequests}
              decisionsByRequestId={decisionsByRequestId}
              role={profile.role}
              actorId={profile.id}
              // Negotiation is triggered by the customer *after* they
              // receive a quotation, so a released quotation is exactly
              // when a discount request is expected. Only a rejected or
              // superseded one is closed to negotiation.
              canRequest={
                canRequestDiscount(profile.role) &&
                proposal.current_status !== "REJECTED" &&
                proposal.current_status !== "SUPERSEDED"
              }
            />
          )}

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
