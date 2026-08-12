// Hand-written types mirroring supabase/migrations/0001_init_schema.sql
// (POC scope — for a production build these would be generated via
// `supabase gen types typescript`).

// v2.0 — actors follow the VKTR Commercial Quotation SOP. The v1 values
// (PROCUREMENT/ENGINEERING/...) remain in the Postgres enum because
// values cannot be dropped in place, but they are no longer used.
export type DepartmentCode =
  | "SALES"
  | "CHIEF_SALES"
  | "VP_FINANCE"
  | "VP_OPERATIONS"
  | "BOD"
  | "ADMIN";

export type UserRole =
  | "SALES_OFFICER"
  | "CHIEF_SALES"
  | "VP_FINANCE"
  | "VP_OPERATIONS"
  | "BOD"
  | "SYSTEM_ADMIN";

export type CostCategory = "DIRECT" | "INDIRECT" | "MARGIN_FACTOR";

export type UnitType = "FIXED" | "PER_UNIT" | "PERCENTAGE";

export type BusinessLine =
  | "B2G_TENDER_BUS"
  | "B2B_COMMERCIAL_FLEET"
  | "CHARGING_INFRA_BUILDOUT";

export type ProposalStatus =
  | "DRAFT"
  | "PENDING_COGS_VALIDATION"
  | "PENDING_CHIEF_SALES_REVIEW"
  | "PENDING_BOD_APPROVAL"
  | "QUOTATION_RELEASED"
  | "REJECTED"
  | "CONFIG_ERROR";

export type StepStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "APPROVED_WITH_CONDITIONS"
  | "REJECTED"
  | "SKIPPED_NOT_APPLICABLE";

export type ProposalOutcome = "PENDING" | "WON" | "LOST" | "CANCELLED";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "SUBMIT"
  | "APPROVE"
  | "APPROVE_WITH_CONDITIONS"
  | "REJECT"
  | "TARGETED_REJECT"
  | "ESCALATE"
  | "RECALCULATE"
  | "ADD_COST_ITEM"
  | "NEGOTIATION_REQUEST"
  | "NEGOTIATION_DECISION"
  | "RELEASE"
  | "RATE_UPDATE"
  | "MINERAL_INDEX_UPDATE";

export type NegotiationStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "REVISED"
  | "SUPERSEDED";

export type NegotiationDecisionType = "APPROVE" | "REJECT" | "REVISE";

export type CurrencyCode = "IDR" | "USD";

export interface Department {
  id: string;
  code: DepartmentCode;
  name: string;
  escalation_contact_name: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department_id: string | null;
  created_at: string;
}

export interface CostItem {
  id: string;
  code: string;
  name: string;
  category: CostCategory;
  subcategory: string;
  owner_department_id: string;
  unit_type: UnitType;
  is_mandatory: boolean;
  active: boolean;
  /** Moves with government mineral prices — receives the HPM factor (FR-8.3). */
  is_mineral_linked: boolean;
  mineral_code: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CbsTemplate {
  id: string;
  name: string;
  business_line: BusinessLine;
  status: "draft" | "active" | "archived";
  min_gpm_threshold: number;
  escalation_threshold_value: number;
  version: number;
  created_at: string;
}

export interface CbsTemplateItem {
  id: string;
  template_id: string;
  cost_item_id: string;
  sort_order: number;
}

export interface WorkflowDefinition {
  id: string;
  business_line: BusinessLine;
  name: string;
  min_value: number;
  max_value: number | null;
  is_active: boolean;
  version: number;
  created_at: string;
}

export interface WorkflowStepDefinition {
  id: string;
  workflow_definition_id: string;
  step_order: number;
  department_id: string;
  status_label: ProposalStatus;
  is_mandatory_gate: boolean;
  sla_hours: number;
  /** Steps sharing a group id run concurrently and join with AND. */
  parallel_group_id: string | null;
}

export interface PricingProposal {
  id: string;
  proposal_number: string;
  title: string;
  business_line: BusinessLine;
  customer_name: string | null;
  cbs_template_id: string;
  workflow_definition_id: string | null;
  current_version_id: string | null;
  current_status: ProposalStatus;
  current_step_order: number;
  transaction_value: number;
  outcome: ProposalOutcome;
  unit_quantity: number;
  applied_discount_pct: number;
  has_bod_margin_approval: boolean;
  /** Currency every cost line on this quotation is entered in (FR-1.4.1). */
  input_currency: CurrencyCode;
  /** HPM when the quotation was created; the factor is measured against it. */
  baseline_hpm_value: number | null;
  baseline_hpm_snapshot_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PricingProposalVersion {
  id: string;
  proposal_id: string;
  version_label: string;
  parent_version_id: string | null;
  change_reason: string | null;
  is_current: boolean;
  created_by: string;
  created_at: string;
}

export interface ProposalCostLine {
  id: string;
  proposal_version_id: string;
  cost_item_id: string;
  value: number;
  notes: string | null;
  filled_by: string | null;
  filled_at: string | null;
}

export interface CalculationBreakdownItem {
  cost_item_id: string;
  code: string;
  name: string;
  category: CostCategory;
  unit_type: UnitType;
  raw_value: number;
  computed_amount: number;
}

export interface CalculationBreakdown {
  items: CalculationBreakdownItem[];
  unit_quantity: number;
}

export interface ProposalCalculationResult {
  id: string;
  proposal_version_id: string;
  total_direct_cost: number;
  total_indirect_cost: number;
  total_margin_amount: number;
  final_price: number;
  gpm: number;
  ebitda_contribution: number;
  bep_units: number | null;
  fx_usd_idr_rate: number;
  breakdown: CalculationBreakdown;
  is_below_gpm_threshold: boolean;
  /** Rate and index that produced these numbers (FR-1.4.3, FR-8.4). */
  exchange_rate_used: number;
  exchange_rate_id: string | null;
  hpm_value_used: number | null;
  mineral_adjustment_factor: number;
  input_currency: CurrencyCode;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  base_currency: CurrencyCode;
  quote_currency: CurrencyCode;
  rate: number;
  source: string;
  effective_from: string;
  created_by: string | null;
  created_at: string;
}

export interface MineralIndexSnapshot {
  id: string;
  mineral_code: string;
  /** US$ per dry metric ton. */
  hma_value: number;
  period_start: string;
  period_end: string;
  regulation_ref: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
}

export interface HpmParameter {
  id: string;
  mineral_code: string;
  ni_content_pct: number;
  anchor_content_pct: number;
  anchor_cf_pct: number;
  cf_slope: number;
  co_content_pct: number;
  co_cf_pct: number;
  moisture_content_pct: number;
  companion_mineral_code: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkflowInstance {
  id: string;
  proposal_version_id: string;
  workflow_definition_id: string;
  status: "RUNNING" | "COMPLETED" | "REJECTED";
  created_at: string;
}

export interface WorkflowStepInstance {
  id: string;
  workflow_instance_id: string;
  step_definition_id: string;
  step_order: number;
  department_id: string;
  status: StepStatus;
  sla_hours: number;
  started_at: string | null;
  sla_due_at: string | null;
  completed_at: string | null;
  actor_id: string | null;
  decision_note: string | null;
  escalation_sent_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  proposal_id: string | null;
  actor_id: string | null;
  action: AuditAction;
  field_changes: { field: string; old: unknown; new: unknown }[];
  reason: string | null;
  supporting_doc_url: string | null;
  created_at: string;
}

export interface ExternalRateSnapshot {
  id: string;
  rate_type: string;
  value: number;
  source: string;
  effective_at: string;
}

export interface DiscountAuthority {
  id: string;
  role: UserRole;
  business_line: BusinessLine | null;
  max_discount_pct: number;
  escalation_order: number;
  is_active: boolean;
  created_at: string;
}

export interface NegotiationRequest {
  id: string;
  proposal_id: string;
  requested_discount_pct: number;
  customer_note: string | null;
  required_role: UserRole;
  status: NegotiationStatus;
  price_before: number;
  price_after: number;
  gpm_after: number;
  is_below_gpm_threshold: boolean;
  parent_request_id: string | null;
  requested_by: string;
  created_at: string;
}

export interface NegotiationDecision {
  id: string;
  negotiation_request_id: string;
  actor_id: string;
  decision: NegotiationDecisionType;
  counter_discount_pct: number | null;
  note: string | null;
  created_at: string;
}

export interface CostItemStat {
  cost_item_id: string;
  business_line: BusinessLine;
  sample_count: number;
  mean_value: number;
  stddev_value: number;
  updated_at: string;
}
