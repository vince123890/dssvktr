// Hand-written types mirroring supabase/migrations/*.sql
// (POC scope — for a production build these would be generated via
// `supabase gen types typescript`).

// v3.0 — actors follow the VKTR Commercial Quotation SOP as corrected
// by the demo review (transcribe.md): Sales Officer -> VP Operations ->
// VP Finance -> Chief Sales, plus Product Owner for product master
// data. Earlier enum values (PROCUREMENT/ENGINEERING/...) remain in
// the Postgres enum because values cannot be dropped in place, but are
// no longer used.
export type DepartmentCode =
  | "SALES"
  | "CHIEF_SALES"
  | "VP_FINANCE"
  | "VP_OPERATIONS"
  | "PRODUCT"
  | "BOD"
  | "ADMIN";

export type UserRole =
  | "SALES_OFFICER"
  | "CHIEF_SALES"
  | "VP_FINANCE"
  | "VP_OPERATIONS"
  | "PRODUCT_OWNER"
  | "BOD"
  | "SYSTEM_ADMIN";

/** Independent Finance reporting tag — no longer read by the pricing engine. */
export type CostCategory = "DIRECT" | "INDIRECT" | "MARGIN_FACTOR";

/**
 * The four real VKTR/BTEL cost groups (docs/BTEL-CostStructure.xlsx),
 * replacing CostCategory as the pricing engine's aggregation basis
 * (PRD FR-1.1, v3.0). COGS + ADD_ONS form the base cost; PROFITABILITY
 * is the margin layered on top of it; SALES is an add-on applied above
 * the resulting price (FR-1.1.1), excluded from the GPM calculation.
 */
export type CostGroup = "COGS" | "PROFITABILITY" | "SALES" | "ADD_ONS";

export type UnitType = "FIXED" | "PER_UNIT" | "PERCENTAGE";

export type BusinessLine =
  | "B2G_TENDER_BUS"
  | "B2B_COMMERCIAL_FLEET"
  | "CHARGING_INFRA_BUILDOUT";

export type ProposalStatus =
  | "DRAFT"
  /** v4.0 Official Quotation state machine (Technical Logic §4.1). */
  | "PENDING_SALES_LEAD_VALIDATION"
  | "PENDING_SALES_OPERATIONS"
  | "PENDING_HEAD_OF_SALES_REVIEW"
  | "PENDING_ADDITIONAL_APPROVAL"
  | "PENDING_OWNER_APPROVAL"
  | "PENDING_PRICING_COMMITTEE_APPROVAL"
  | "EXPIRED"
  /** v3.0 statuses — still in the Postgres enum, no longer produced. */
  | "PENDING_COGS_VALIDATION"
  | "PENDING_CHIEF_SALES_REVIEW"
  | "PENDING_BOD_APPROVAL"
  | "QUOTATION_RELEASED"
  /** Superseded by a newer quotation on the same Project Identifier (FR-2.5). */
  | "SUPERSEDED"
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
  | "MINERAL_INDEX_UPDATE"
  | "SUPERSEDE"
  | "BLOCKED_DUPLICATE_ATTEMPT"
  | "MAKE"
  | "CHECK"
  | "RETURN"
  | "VALIDATE"
  | "GENERATE"
  | "REVISE"
  | "STEP_SKIPPED"
  | "TIER_ROUTE"
  | "TIER_CC"
  | "EXPIRE"
  | "PRINT"
  | "SETTINGS_CHANGE"
  | "PRICE_ESTIMATE";

export type NegotiationStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "REVISED"
  | "SUPERSEDED";

export type NegotiationDecisionType = "APPROVE" | "REJECT" | "REVISE";

/** CNY is the real FOB Price denomination (v3.0); USD is kept for a
 * possible future customer-facing display toggle, unused by the
 * calculation basis. */
export type CurrencyCode = "IDR" | "CNY" | "USD";

/** GPM-based discount authority tier (PRD Module 6, v3.0). */
export type MarginTier = 1 | 2 | 3;

export type WorkflowQualifierType = "BUSINESS_LINE" | "MARGIN_TIER" | "GENERIC";

export type DiscountInputMode = "AMOUNT" | "PERCENTAGE";

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
  /** Legacy v1-v3 enum, still read by the older RLS policies. */
  role: UserRole;
  department_id: string | null;
  /** v4.0 — the configurable app role (sheet Actors), see AppRole. */
  app_role_code: string | null;
  created_at: string;
}

/**
 * Fixed "slots" the application logic checks (Technical Logic §2.1).
 * App roles are data and can be added/renamed in Settings; code never
 * compares an app role's name, only the functional roles it carries.
 */
export type FunctionalRole =
  | "SALESPERSON"
  | "SALES_VALIDATOR"
  | "SALES_OPERATIONS"
  | "SALES_RELEASER"
  | "SALES_PRICING_OWNER"
  | "COGS_OWNER"
  | "PROFITABILITY_OWNER"
  | "PRICING_COMMITTEE"
  | "PRODUCT_OWNER"
  | "EXTERNAL_AGENCY"
  | "SYSTEM_ADMIN";

export interface AppRole {
  code: string;
  name: string;
  functional_roles: FunctionalRole[];
  is_external: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Profile joined with its app role — what the app authorizes against. */
export interface Actor extends Profile {
  app_role: AppRole | null;
}

/** Cost structure scope (sheet Actors "Scope"): MARGIN == cost_group PROFITABILITY. */
export type CostScope = "COGS" | "ADD_ONS" | "MARGIN" | "SALES";

export type Scenario = "REGULAR" | "DEVIATION";

export interface ScopeAuthority {
  id: string;
  app_role_code: string;
  scope: CostScope;
  scenario: Scenario;
  can_make: boolean;
  can_check: boolean;
  can_release: boolean;
}

export interface ScopeSegregationRule {
  scope: CostScope;
  maker_ne_checker: boolean;
  checker_ne_releaser: boolean;
  allow_single_actor: boolean;
}

export interface QuantityBand {
  band: number;
  min_qty: number;
  max_qty: number | null;
  processing_mode: "AUTO" | "AUTO_WITH_MANUAL" | "MANUAL";
  default_discount_pct: number;
}

export type CostStructureStatus = "DRAFT" | "RELEASED" | "RETIRED";
export type ScopeStatus = "DRAFT" | "MADE" | "CHECKED" | "RELEASED" | "RETURNED";

export interface CostStructureVersion {
  id: string;
  product_id: string;
  version_no: number;
  status: CostStructureStatus;
  locked_fx_rate_id: string | null;
  locked_fx_rate: number;
  parent_version_id: string | null;
  change_reason: string | null;
  is_seed: boolean;
  released_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CostStructureLine {
  id: string;
  version_id: string;
  cost_item_id: string;
  value: number;
  is_excluded_at_cost: boolean;
}

export interface CostStructureScopeState {
  id: string;
  version_id: string;
  scope: CostScope;
  status: ScopeStatus;
  scenario: Scenario;
  carried_over: boolean;
  maker_id: string | null;
  made_at: string | null;
  checker_id: string | null;
  checked_at: string | null;
  releaser_id: string | null;
  released_at: string | null;
  note: string | null;
  single_actor_flag: boolean;
}

export type ProjectType = "NEW_PROJECT" | "ADDITIONAL_RUNNING_PROJECT" | "REPLACEMENT";

/** KYC form (sheet Basic Workflow B step 2), stored as a snapshot on the quotation. */
export interface QuotationKyc {
  company_name?: string;
  official_address?: string;
  project_name?: string;
  project_type?: ProjectType;
  application_body?: string;
  utilization_content?: string;
  route_description?: string;
  origin?: string;
  destination?: string;
  production_value?: number;
  production_unit?: string;
  production_period?: "TRIP" | "CYCLE" | "DAY" | "MONTH" | "OTHER";
  likelihood?: number;
  gap_identified?: string;
  other_information?: string;
  requested_scheme?: "PURCHASE" | "RENTAL";
  /** Deal qualifiers (v4.1) used to pick the Workflow Template. */
  customer_segment?: string;
  industry?: string;
  relationship?: string;
}

export type CommercialScheme = "PURCHASE" | "RENTAL";

export interface QuotationLineItem {
  id: string;
  proposal_id: string;
  product_id: string;
  quantity: number;
  sort_order: number;
  cost_structure_version_id: string | null;
  locked_fx_rate: number | null;
  scheme: CommercialScheme;
  rental_tenor_months: number | null;
  rental_monthly_incl_vat: number | null;
  list_price_ex_vat: number;
  base_cost: number;
  margin_amount: number;
  sales_cost: number;
  discount_input_mode: DiscountInputMode;
  discount_amount: number;
  discount_pct: number;
  discount_source: string | null;
  net_price_ex_vat: number;
  net_price_incl_vat: number;
  line_total_ex_vat: number;
  line_total_incl_vat: number;
  gm: number | null;
  created_at: string;
  updated_at: string;
}

export interface TierApproval {
  id: string;
  proposal_id: string;
  round: number;
  tier: number;
  slot: string;
  kind: "DECISION" | "CC";
  actor_id: string | null;
  decision: "APPROVE" | "REJECT" | null;
  note: string | null;
  is_void: boolean;
  created_at: string;
  decided_at: string | null;
}

export interface PriceEstimateLog {
  id: string;
  user_id: string;
  product_id: string;
  cost_structure_version_id: string | null;
  price_ex_vat: number;
  price_incl_vat: number;
  created_at: string;
}

export interface CostItem {
  id: string;
  code: string;
  name: string;
  category: CostCategory;
  /** COGS / PROFITABILITY / SALES / ADD_ONS — the pricing engine's basis (v3.0). */
  cost_group: CostGroup;
  subcategory: string;
  owner_department_id: string;
  unit_type: UnitType;
  /** Currency this line's value is entered in (real CBS mixes CNY and IDR per item). */
  denomination: CurrencyCode;
  /** May be valued later or released as "Exclusion — At cost" (FR-2.2 v4.0), e.g. Delivery Service. */
  may_follow_later: boolean;
  /** Computed, never typed — FOB Price in IDR = FOB CNY x locked rate. */
  is_derived: boolean;
  /** Printed under "Exclusions — At cost" when a may_follow_later item is excluded. */
  exclusion_label: string | null;
  is_mandatory: boolean;
  active: boolean;
  /** Moves with government mineral prices — receives the HPM factor (FR-8.3, dormant by default in v3.0). */
  is_mineral_linked: boolean;
  mineral_code: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CbsTemplate {
  id: string;
  name: string;
  /** Historical column — no longer selects which CBS a proposal uses; the CBS is single (FR-1.1). */
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

export type WorkflowKind = "OFFICIAL_QUOTATION" | "PRICE_ESTIMATE";

export type StepActionKind =
  | "VALIDATE"
  | "GENERATE_QUOTATION"
  | "REVIEW_AND_ROUTE"
  | "APPROVE";

export interface WorkflowDefinition {
  id: string;
  business_line: BusinessLine;
  name: string;
  workflow_kind: WorkflowKind;
  /** Functional roles allowed to start this workflow. */
  allowed_functions: FunctionalRole[];
  /** v4.1 catalog: versions of one template share this code. */
  template_code: string | null;
  description: string | null;
  /** Tie-breaker when two templates are equally specific (higher wins). */
  priority: number;
  /** Qualifiers — an empty list / null means "any". min_value/max_value = estimated value (IDR excl. VAT). */
  q_segments: string[];
  q_industries: string[];
  q_relationships: string[];
  q_business_lines: string[];
  q_min_qty: number | null;
  q_max_qty: number | null;
  q_blacklist: boolean | null;
  /** Used when no other template matches. */
  is_fallback: boolean;
  /** How this template is selected by resolveWorkflowTemplate() (FR-2.0.1). */
  qualifier_type: WorkflowQualifierType;
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
  /** v3.0 department-based routing — null for v4.0 steps. */
  department_id: string | null;
  step_name: string | null;
  action_kind: StepActionKind | null;
  performer_function: FunctionalRole | null;
  /** Step is skipped when the initiator carries this functional role. */
  skip_if_initiator_function: FunctionalRole | null;
  /** Where a rejection sends the quotation; null = back to the initiator (DRAFT). */
  reject_to_step_order: number | null;
  cc_functions: FunctionalRole[];
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
  /** Links this quotation to its revision history (FR-2.5). */
  project_identifier_id: string;
  /** The quotation this one replaces, if it is a revision on the same project. */
  supersedes_proposal_id: string | null;
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
  /** The exchange_rate row used the last time this quotation was (re)calculated (FR-1.4.6). */
  last_calculated_rate_id: string | null;
  /** v4.0 Official Quotation fields. */
  kyc: QuotationKyc;
  initiator_role_code: string | null;
  account_person_ids: string[];
  prepared_by: string | null;
  quantity_band: number | null;
  processing_mode: QuantityBand["processing_mode"] | null;
  scenario: Scenario | null;
  margin_tier: number | null;
  gm: number | null;
  total_ex_vat: number;
  total_incl_vat: number;
  vat_rate_pct: number | null;
  document_number: string | null;
  released_at: string | null;
  valid_until: string | null;
  inclusions: string[];
  exclusions: string[];
  special_notes: string[];
  tier_round: number;
  accepted_document_url: string | null;
  is_seed: boolean;
  /** v4.1 — template the resolver picked at submit, and why. */
  workflow_template_code: string | null;
  workflow_selection_reason: string | null;
  estimated_value: number | null;
  is_blacklisted: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PricingProposalVersion {
  id: string;
  proposal_id: string;
  version_label: string;
  parent_version_id: string | null;
  /** Product being quoted, from Product Master Data (FR-1.5.2). */
  product_master_data_id: string | null;
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
  cost_group: CostGroup;
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
  /** When an automatic weekly pull fetched this rate (FR-1.4.2); null for manual entries. */
  pulled_at: string | null;
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
  step_definition_id: string | null;
  step_order: number;
  department_id: string | null;
  step_name: string | null;
  action_kind: StepActionKind | null;
  performer_function: FunctionalRole | null;
  skip_if_initiator_function: FunctionalRole | null;
  reject_to_step_order: number | null;
  status_label: ProposalStatus | null;
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

/** v2.0 percentage-based ladder — kept in the schema but unused by v3.0 code; see MarginTierAuthority. */
export interface DiscountAuthority {
  id: string;
  role: UserRole;
  business_line: BusinessLine | null;
  max_discount_pct: number;
  escalation_order: number;
  is_active: boolean;
  created_at: string;
}

/** GPM-tier discount authority matrix (FR-6.1, v3.0) — replaces DiscountAuthority. */
export interface MarginTierAuthority {
  id: string;
  tier: MarginTier;
  business_line: BusinessLine | null;
  gpm_lower_bound_pct: number | null;
  gpm_upper_bound_pct: number | null;
  /** v3.0 — unused from v4.0 on; see decision_slots. */
  required_roles: UserRole[];
  /**
   * v4.0 — every slot must APPROVE (AND-join). A slot is a functional
   * role ("COGS_OWNER") or a specific app role ("role:CCO").
   */
  decision_slots: string[];
  /** Informed (tembusan) but not asked to decide. */
  cc_slots: string[];
  reject_target: string;
  /** v4.1 — ladder belonging to one Workflow Template; null = global ladder. */
  workflow_template_code: string | null;
  allow_bod_delegation: boolean;
  is_active: boolean;
  created_at: string;
}

export interface NegotiationRequest {
  id: string;
  proposal_id: string;
  requested_discount_pct: number;
  /** Whether the requester typed an amount or a percentage (FR-6.1.1); both are always stored. */
  discount_input_mode: DiscountInputMode;
  requested_discount_amount: number | null;
  customer_note: string | null;
  /** Legacy v2.0 column — superseded by required_tier, kept for backward reads. */
  required_role: UserRole | null;
  /** GPM-tier resolved from the discount's effect on margin (FR-6.2). */
  required_tier: MarginTier;
  /** Snapshot of margin_tier_authority.required_roles at request time, for audit stability. */
  required_roles_snapshot: UserRole[];
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
  /** Role the actor signed with — combined with actor_id, lets Tier 3 require two different BOD members. */
  approver_role: UserRole;
  decision: NegotiationDecisionType;
  counter_discount_pct: number | null;
  counter_discount_amount: number | null;
  note: string | null;
  created_at: string;
}

export interface ProjectIdentifier {
  id: string;
  identifier_code: string;
  customer_name: string;
  project_name: string;
  created_by: string | null;
  created_at: string;
}

export interface ProductMasterData {
  id: string;
  code: string;
  name: string;
  chassis_variant: string | null;
  body_variant: string | null;
  make: string | null;
  model: string | null;
  variant_type: string | null;
  variant: string | null;
  wheelbase: string | null;
  battery_kwh: number | null;
  body_application: string | null;
  build_type: string | null;
  loco: string | null;
  /** Text printed as "Product"/"Description" on the Cost Estimate. */
  document_description: string | null;
  default_inclusions: string[];
  default_exclusions: string[];
  /** Section -> { label -> value }, printed on the Specification page. */
  spec_sheet: Record<string, Record<string, string>>;
  image_urls: string[];
  brochure_url: string | null;
  status: "ACTIVE" | "DISCONTINUED";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationDocumentTemplate {
  id: string;
  name: string;
  applies_to: string | null;
  layout_schema: Record<string, unknown>;
  version: number;
  is_active: boolean;
  created_at: string;
}

export interface RateSensitivityConfig {
  id: string;
  threshold_pct: number;
  is_active: boolean;
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
