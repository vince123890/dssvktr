import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Actor,
  AppRole,
  BusinessLine,
  CostItem,
  CostStructureVersion,
  DiscountInputMode,
  FunctionalRole,
  MarginTierAuthority,
  PricingProposal,
  ProductMasterData,
  ProposalStatus,
  QuantityBand,
  QuotationLineItem,
  TierApproval,
  WorkflowInstance,
  WorkflowStepInstance,
} from "@/types/database";
import { writeAuditLog } from "@/lib/audit";
import { loadSettings, type AppSettings } from "@/lib/settings";
import {
  evaluateVersion,
  loadCostItems,
  loadReleasedVersion,
  loadVersionLines,
  scenarioFor,
} from "@/lib/costStructure";
import {
  aggregateGm,
  computeLine,
  resolveBand,
  resolveTier,
  strictestMode,
} from "@/lib/pricing/quotation";
import { actorFillsSlot, hasFunction } from "@/lib/rbac";
import { resolveExchangeRate } from "@/lib/pricing/currency";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

/**
 * Official Quotation engine — Technical Logic §4.0–§4.12, §11 (v4.0).
 *
 * Sheet "Basic Workflow" B, as a state machine:
 *   DRAFT (KYC) → [validation, skipped for a Sales Lead] → Sales
 *   Operations generate (quantity band) → Head of Sales review →
 *   margin-tier routing (15% / 10%) → release.
 *
 * The steps before routing come from the configurable Workflow
 * Template; the tier approvals are appended from margin_tier_authority
 * and can never be removed by a template. Every rule here runs on the
 * server — the UI only mirrors it.
 */

// ---------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------

/**
 * Margin-tier ladder for a quotation (Technical Logic §11.1, v4.1): the
 * Workflow Template's own ladder when it has one ("kalau persentase
 * berapa negosiasinya siapa yang approve" differs per template), else a
 * business-line ladder, else the global one.
 */
export async function loadLadder(
  supabase: Db,
  businessLine: BusinessLine,
  templateCode?: string | null
): Promise<MarginTierAuthority[]> {
  const { data } = await supabase
    .from("margin_tier_authority")
    .select("*")
    .eq("is_active", true)
    .order("tier");
  const rows = (data ?? []) as MarginTierAuthority[];
  if (templateCode) {
    const own = rows.filter((r) => r.workflow_template_code === templateCode);
    if (own.length > 0) return own;
  }
  const shared = rows.filter((r) => !r.workflow_template_code);
  const specific = shared.filter((r) => r.business_line === businessLine);
  return specific.length > 0 ? specific : shared.filter((r) => r.business_line === null);
}

export async function loadBands(supabase: Db): Promise<QuantityBand[]> {
  const { data } = await supabase.from("quantity_band_config").select("*").order("band");
  return ((data ?? []) as QuantityBand[]).map((b) => ({
    ...b,
    default_discount_pct: Number(b.default_discount_pct),
  }));
}

export async function loadLines(supabase: Db, proposalId: string): Promise<QuotationLineItem[]> {
  const { data } = await supabase
    .from("quotation_line_item")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("sort_order");
  return (data ?? []) as QuotationLineItem[];
}

export async function loadCurrentInstance(
  supabase: Db,
  proposal: Pick<PricingProposal, "current_version_id">
): Promise<{ instance: WorkflowInstance | null; steps: WorkflowStepInstance[] }> {
  if (!proposal.current_version_id) return { instance: null, steps: [] };
  const { data: instance } = await supabase
    .from("workflow_instance")
    .select("*")
    .eq("proposal_version_id", proposal.current_version_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!instance) return { instance: null, steps: [] };
  const { data: steps } = await supabase
    .from("workflow_step_instance")
    .select("*")
    .eq("workflow_instance_id", instance.id)
    .order("step_order");
  return { instance: instance as WorkflowInstance, steps: (steps ?? []) as WorkflowStepInstance[] };
}

export function activeStep(steps: WorkflowStepInstance[]): WorkflowStepInstance | null {
  return steps.find((s) => s.status === "IN_PROGRESS") ?? null;
}

export async function loadRole(supabase: Db, code: string | null): Promise<AppRole | null> {
  if (!code) return null;
  const { data } = await supabase.from("app_role").select("*").eq("code", code).maybeSingle();
  return (data as AppRole | null) ?? null;
}

// ---------------------------------------------------------------------
// Pricing a quotation (generation, revise, Hitung Ulang)
// ---------------------------------------------------------------------

export interface LineEdit {
  discountMode?: DiscountInputMode;
  discountValue?: number;
  scheme?: "PURCHASE" | "RENTAL";
  rentalTenorMonths?: number | null;
  rentalMonthlyInclVat?: number | null;
}

export interface PriceOptions {
  /** Re-resolve each line to the latest RELEASED cost structure (generation, Hitung Ulang). */
  refreshVersions: boolean;
  /** Apply the quantity band's default discount to lines not yet edited by hand. */
  applyBandDefaults: boolean;
  edits?: Record<string, LineEdit>;
  discountSource?: "SALES_OPS_MANUAL" | "HEAD_OF_SALES_REVISE";
}

export interface PriceSummary {
  gm: number;
  tier: MarginTierAuthority | null;
  totalExVat: number;
  totalInclVat: number;
}

export async function priceQuotation(
  supabase: Db,
  proposal: PricingProposal,
  options: PriceOptions,
  ctx?: { items?: CostItem[]; settings?: AppSettings }
): Promise<PriceSummary> {
  const [items, settings, bands, ladder, lines] = await Promise.all([
    ctx?.items ? Promise.resolve(ctx.items) : loadCostItems(supabase),
    ctx?.settings ? Promise.resolve(ctx.settings) : loadSettings(supabase),
    loadBands(supabase),
    loadLadder(supabase, proposal.business_line, proposal.workflow_template_code),
    loadLines(supabase, proposal.id),
  ]);

  if (lines.length === 0) throw new Error("Quotation belum memiliki varian kendaraan.");

  const priced: { quantity: number; netPriceExVat: number; baseCost: number; salesCost: number }[] = [];
  const modes: QuantityBand["processing_mode"][] = [];
  let maxBand = 0;
  let totalExVat = 0;
  let totalInclVat = 0;
  let lockedRateId: string | null = null;
  const excludedLabels = new Set<string>();

  for (const line of lines) {
    let version: CostStructureVersion | null = null;
    if (options.refreshVersions || !line.cost_structure_version_id) {
      version = await loadReleasedVersion(supabase, line.product_id);
    } else {
      const { data } = await supabase
        .from("cost_structure_version")
        .select("*")
        .eq("id", line.cost_structure_version_id)
        .maybeSingle();
      version = (data as CostStructureVersion | null) ?? null;
    }
    if (!version) {
      const { data: product } = await supabase
        .from("product_master_data")
        .select("name")
        .eq("id", line.product_id)
        .maybeSingle();
      throw new Error(
        `Cost structure untuk varian "${product?.name ?? line.product_id}" belum RELEASED — COGS/Profitability/Sales Owner harus merilisnya dulu.`
      );
    }

    const versionLines = await loadVersionLines(supabase, version.id);
    const cs = evaluateVersion(items, versionLines, Number(version.locked_fx_rate));
    for (const vl of versionLines) {
      if (!vl.is_excluded_at_cost) continue;
      const item = items.find((i) => i.id === vl.cost_item_id);
      if (item) excludedLabels.add(item.exclusion_label ?? item.name);
    }
    lockedRateId = lockedRateId ?? version.locked_fx_rate_id;

    const band = resolveBand(line.quantity, bands);
    if (band) {
      modes.push(band.processing_mode);
      maxBand = Math.max(maxBand, band.band);
    }

    const edit = options.edits?.[line.id];
    let mode: DiscountInputMode = edit?.discountMode ?? line.discount_input_mode;
    let amount = Number(line.discount_amount);
    let pct = Number(line.discount_pct);
    let source = line.discount_source;

    if (edit && edit.discountValue !== undefined) {
      if (mode === "AMOUNT") amount = edit.discountValue;
      else pct = edit.discountValue;
      source = options.discountSource ?? "SALES_OPS_MANUAL";
    } else if (
      options.applyBandDefaults &&
      (source === null || source === "BAND_DEFAULT") &&
      band
    ) {
      mode = "PERCENTAGE";
      pct = band.processing_mode === "MANUAL" ? 0 : band.default_discount_pct;
      source = pct > 0 ? "BAND_DEFAULT" : null;
    }

    const result = computeLine({
      quantity: line.quantity,
      listPriceExVat: cs.listPriceExVat,
      baseCost: cs.baseCost,
      salesCost: cs.salesCost,
      discountMode: mode,
      discountAmount: amount,
      discountPct: pct,
      vatRatePct: settings.vatRatePct,
    });

    const scheme = edit?.scheme ?? line.scheme;
    await supabase
      .from("quotation_line_item")
      .update({
        cost_structure_version_id: version.id,
        locked_fx_rate: version.locked_fx_rate,
        list_price_ex_vat: cs.listPriceExVat,
        base_cost: cs.baseCost,
        margin_amount: cs.marginAmount,
        sales_cost: cs.salesCost,
        discount_input_mode: mode,
        discount_amount: result.discountAmount,
        discount_pct: result.discountPct,
        discount_source: source,
        net_price_ex_vat: result.netPriceExVat,
        net_price_incl_vat: result.netPriceInclVat,
        line_total_ex_vat: result.lineTotalExVat,
        line_total_incl_vat: result.lineTotalInclVat,
        gm: result.gm,
        scheme,
        rental_tenor_months:
          scheme === "RENTAL" ? (edit?.rentalTenorMonths ?? line.rental_tenor_months ?? 60) : null,
        rental_monthly_incl_vat:
          scheme === "RENTAL" ? (edit?.rentalMonthlyInclVat ?? line.rental_monthly_incl_vat) : null,
      })
      .eq("id", line.id);

    priced.push({
      quantity: line.quantity,
      netPriceExVat: result.netPriceExVat,
      baseCost: cs.baseCost,
      salesCost: cs.salesCost,
    });
    totalExVat += result.lineTotalExVat;
    totalInclVat += result.lineTotalInclVat;
  }

  const gm = aggregateGm(priced);
  const tier = resolveTier(gm * 100, ladder);

  // Default document text: product inclusions/exclusions plus any
  // may_follow_later item released as "At cost" (FR-2.2 v4.0).
  const patch: Record<string, unknown> = {
    quantity_band: maxBand || null,
    processing_mode: strictestMode(modes),
    gm,
    margin_tier: tier?.tier ?? null,
    scenario: scenarioFor(gm, settings.deviationGmThresholdPct),
    total_ex_vat: totalExVat,
    total_incl_vat: totalInclVat,
    transaction_value: totalExVat,
    vat_rate_pct: settings.vatRatePct,
    last_calculated_rate_id: lockedRateId,
  };

  if (proposal.inclusions.length === 0 || proposal.exclusions.length === 0) {
    const { data: products } = await supabase
      .from("product_master_data")
      .select("default_inclusions, default_exclusions")
      .in("id", lines.map((l) => l.product_id));
    const inc = new Set<string>();
    const exc = new Set<string>([...excludedLabels]);
    for (const p of (products ?? []) as Pick<ProductMasterData, "default_inclusions" | "default_exclusions">[]) {
      p.default_inclusions?.forEach((x) => inc.add(x));
      p.default_exclusions?.forEach((x) => exc.add(x));
    }
    if (proposal.inclusions.length === 0) patch.inclusions = [...inc];
    if (proposal.exclusions.length === 0) patch.exclusions = [...exc];
  }
  if (proposal.special_notes.length === 0) patch.special_notes = settings.defaultSpecialNotes;

  await supabase.from("pricing_proposal").update(patch).eq("id", proposal.id);

  return { gm, tier, totalExVat, totalInclVat };
}

// ---------------------------------------------------------------------
// Step advancement
// ---------------------------------------------------------------------

async function setStep(supabase: Db, step: WorkflowStepInstance, patch: Partial<WorkflowStepInstance>) {
  Object.assign(step, patch);
  await supabase.from("workflow_step_instance").update(patch).eq("id", step.id);
}

function openPatch(step: WorkflowStepInstance): Partial<WorkflowStepInstance> {
  return {
    status: "IN_PROGRESS",
    started_at: new Date().toISOString(),
    completed_at: null,
    decision_note: null,
    actor_id: null,
    sla_due_at: new Date(Date.now() + step.sla_hours * 3600 * 1000).toISOString(),
  };
}

export interface AdvanceContext {
  proposal: PricingProposal;
  instance: WorkflowInstance;
  steps: WorkflowStepInstance[];
  actor: Actor;
  initiatorFunctions: FunctionalRole[];
  /** Revision with unchanged KYC & lines: validation steps are not repeated (FR-2.5). */
  skipValidation?: boolean;
}

/**
 * Opens the next step after `afterOrder` (or the first step), skipping
 * steps whose condition matches (sheet Basic Workflow 4b: a Sales Lead's
 * own request goes straight to Sales Operations). A GENERATE step
 * prices the quotation on entry; in band 1 it completes itself.
 */
export async function advanceFrom(
  supabase: Db,
  ctx: AdvanceContext,
  afterOrder: number
): Promise<void> {
  const { proposal, steps, actor } = ctx;
  const pending = steps
    .filter((s) => s.step_order > afterOrder && s.status === "PENDING")
    .sort((a, b) => a.step_order - b.step_order);

  for (const step of pending) {
    const skipByRole =
      step.skip_if_initiator_function &&
      ctx.initiatorFunctions.includes(step.skip_if_initiator_function);
    const skipByRevision = ctx.skipValidation && step.action_kind === "VALIDATE";

    if (skipByRole || skipByRevision) {
      await setStep(supabase, step, {
        status: "SKIPPED_NOT_APPLICABLE",
        completed_at: new Date().toISOString(),
        decision_note: skipByRole
          ? "Dilewati — pengaju memiliki wewenang validasi sendiri."
          : "Dilewati — revisi tanpa perubahan KYC/varian.",
      });
      await writeAuditLog(supabase, {
        entityType: "workflow_step_instance",
        entityId: step.id,
        proposalId: proposal.id,
        actorId: actor.id,
        action: "STEP_SKIPPED",
        reason: step.decision_note ?? undefined,
      });
      continue;
    }

    await setStep(supabase, step, openPatch(step));
    await supabase
      .from("pricing_proposal")
      .update({ current_status: step.status_label ?? "PENDING_SALES_OPERATIONS", current_step_order: step.step_order })
      .eq("id", proposal.id);

    if (step.action_kind === "GENERATE_QUOTATION") {
      await priceQuotation(supabase, proposal, { refreshVersions: true, applyBandDefaults: true });
      const { data: fresh } = await supabase
        .from("pricing_proposal")
        .select("processing_mode")
        .eq("id", proposal.id)
        .single();
      await writeAuditLog(supabase, {
        entityType: "pricing_proposal",
        entityId: proposal.id,
        proposalId: proposal.id,
        actorId: actor.id,
        action: "GENERATE",
        reason: `Official Quotation di-generate (mode ${fresh?.processing_mode}).`,
      });
      if (fresh?.processing_mode === "AUTO") {
        // Band 1: "Request for 1 unit will auto generate Official Quotation".
        await setStep(supabase, step, {
          status: "APPROVED",
          completed_at: new Date().toISOString(),
          decision_note: "Auto-generated — band 1 unit, harga dasar.",
        });
        continue;
      }
    }
    return;
  }

  // Template exhausted without a REVIEW step still open — nothing left
  // to do here; routing is triggered by the review decision itself.
}

// ---------------------------------------------------------------------
// Tier routing, decisions, release
// ---------------------------------------------------------------------

/** The approval status follows WHO must decide, since template ladders vary (v4.1). */
function tierStatus(slots: string[]): ProposalStatus {
  const committee = slots.some((s) => s === "PRICING_COMMITTEE" || s === "role:CCO" || s === "role:CFO");
  return committee ? "PENDING_PRICING_COMMITTEE_APPROVAL" : "PENDING_OWNER_APPROVAL";
}

/**
 * After Head of Sales accepts (sheet Basic Workflow step 7): GM ≥ 15%
 * is released right away; lower tiers open one DECISION row per slot
 * (AND-join) plus CC rows for "tembusan".
 */
export async function routeAfterReview(
  supabase: Db,
  proposal: PricingProposal,
  actor: Actor
): Promise<{ released: boolean }> {
  const ladder = await loadLadder(supabase, proposal.business_line, proposal.workflow_template_code);
  const gm = Number(proposal.gm ?? -1);
  const tier = resolveTier(gm * 100, ladder);
  if (!tier) throw new Error("Margin Tier Authority belum dikonfigurasi (CONFIG_ERROR).");

  const selfReleasing =
    tier.decision_slots.length === 0 ||
    tier.decision_slots.every((slot) => actorFillsSlot(actor, slot));

  if (selfReleasing) {
    await releaseQuotation(supabase, proposal, actor);
    return { released: true };
  }

  const round = proposal.tier_round + 1;
  await supabase
    .from("tier_approval")
    .update({ is_void: true })
    .eq("proposal_id", proposal.id)
    .eq("is_void", false);

  const now = new Date().toISOString();
  const rows = [
    ...tier.decision_slots.map((slot) => ({
      proposal_id: proposal.id,
      round,
      tier: tier.tier,
      slot,
      kind: "DECISION" as const,
    })),
    ...tier.cc_slots.map((slot) => ({
      proposal_id: proposal.id,
      round,
      tier: tier.tier,
      slot,
      kind: "CC" as const,
      decided_at: now,
    })),
  ];
  const { error } = await supabase.from("tier_approval").insert(rows);
  if (error) throw new Error(error.message);

  await supabase
    .from("pricing_proposal")
    .update({ current_status: tierStatus(tier.decision_slots), tier_round: round, margin_tier: tier.tier })
    .eq("id", proposal.id);

  await writeAuditLog(supabase, {
    entityType: "pricing_proposal",
    entityId: proposal.id,
    proposalId: proposal.id,
    actorId: actor.id,
    action: "TIER_ROUTE",
    reason: `GM ${(gm * 100).toFixed(2)}% → Tier ${tier.tier}; menunggu ${tier.decision_slots.join(" + ")}.`,
    fieldChanges: [{ field: "margin_tier", old: null, new: tier.tier }],
  });
  if (tier.cc_slots.length > 0) {
    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposal.id,
      proposalId: proposal.id,
      actorId: actor.id,
      action: "TIER_CC",
      reason: `Tembusan ke ${tier.cc_slots.join(", ")}.`,
    });
  }
  return { released: false };
}

export async function loadTierRound(supabase: Db, proposal: PricingProposal): Promise<TierApproval[]> {
  if (proposal.tier_round === 0) return [];
  const { data } = await supabase
    .from("tier_approval")
    .select("*")
    .eq("proposal_id", proposal.id)
    .eq("round", proposal.tier_round)
    .eq("is_void", false)
    .order("created_at");
  return (data ?? []) as TierApproval[];
}

/** Reopens the GENERATE step (Sales Operations) and resets everything after it. */
export async function returnToSalesOperations(
  supabase: Db,
  proposal: PricingProposal,
  note: string | null
): Promise<void> {
  const { steps } = await loadCurrentInstance(supabase, proposal);
  const generate = steps.find((s) => s.action_kind === "GENERATE_QUOTATION");
  if (!generate) throw new Error("Workflow tidak memiliki langkah Sales Operations.");
  for (const s of steps) {
    if (s.step_order > generate.step_order) {
      await setStep(supabase, s, {
        status: "PENDING",
        started_at: null,
        completed_at: null,
        sla_due_at: null,
        actor_id: null,
        decision_note: null,
      });
    }
  }
  await setStep(supabase, generate, { ...openPatch(generate), decision_note: note });
  await supabase
    .from("pricing_proposal")
    .update({
      current_status: generate.status_label ?? "PENDING_SALES_OPERATIONS",
      current_step_order: generate.step_order,
    })
    .eq("id", proposal.id);
}

export async function decideTier(
  supabase: Db,
  proposal: PricingProposal,
  actor: Actor,
  decision: "APPROVE" | "REJECT",
  note: string | null
): Promise<{ released: boolean; rejected: boolean }> {
  const rows = await loadTierRound(supabase, proposal);
  const decisions = rows.filter((r) => r.kind === "DECISION");
  if (decisions.some((r) => r.actor_id === actor.id)) {
    throw new Error("Anda sudah memberi keputusan pada putaran ini — satu orang mengisi satu slot.");
  }
  const mine = decisions.find((r) => r.decision === null && actorFillsSlot(actor, r.slot));
  if (!mine) throw new Error("Tidak ada slot persetujuan tier yang menunggu keputusan Anda.");

  const now = new Date().toISOString();
  await supabase
    .from("tier_approval")
    .update({ actor_id: actor.id, decision, note, decided_at: now })
    .eq("id", mine.id);

  await writeAuditLog(supabase, {
    entityType: "tier_approval",
    entityId: mine.id,
    proposalId: proposal.id,
    actorId: actor.id,
    action: decision === "APPROVE" ? "APPROVE" : "REJECT",
    reason: note ?? undefined,
    fieldChanges: [{ field: `tier_${mine.tier}_${mine.slot}`, old: null, new: decision }],
  });

  if (decision === "REJECT") {
    // Sheet Basic Workflow 7b-ii / 7c-ii: "if rejected will be returned to Sales Operations".
    await supabase
      .from("tier_approval")
      .update({ is_void: true })
      .eq("proposal_id", proposal.id)
      .eq("round", proposal.tier_round);
    await returnToSalesOperations(supabase, proposal, `Ditolak pada Tier ${mine.tier}: ${note ?? "-"}`);
    return { released: false, rejected: true };
  }

  const stillPending = decisions.filter((r) => r.id !== mine.id && r.decision !== "APPROVE");
  if (stillPending.length > 0) return { released: false, rejected: false };

  await releaseQuotation(supabase, proposal, actor);
  return { released: true, rejected: false };
}

export interface ReleaseGateResult {
  ok: boolean;
  reason?: string;
}

/** Release Gate — Technical Logic §4.2.1. */
export async function checkReleaseGate(
  supabase: Db,
  proposal: PricingProposal
): Promise<ReleaseGateResult> {
  const [items, lines] = await Promise.all([loadCostItems(supabase), loadLines(supabase, proposal.id)]);
  if (lines.length === 0) return { ok: false, reason: "Tidak ada line item." };

  for (const line of lines) {
    if (!line.cost_structure_version_id) {
      return { ok: false, reason: "Ada varian yang belum dihitung dari cost structure RELEASED." };
    }
    const vLines = await loadVersionLines(supabase, line.cost_structure_version_id);
    const byItem = new Map(vLines.map((l) => [l.cost_item_id, l]));
    for (const item of items) {
      if (item.is_derived) continue;
      const vl = byItem.get(item.id);
      const valued = vl && Number(vl.value) !== 0;
      if (item.may_follow_later) {
        if (!valued && !vl?.is_excluded_at_cost) {
          return {
            ok: false,
            reason: `${item.name} harus dinilai atau dinyatakan "Exclusion — At cost".`,
          };
        }
      } else if (item.is_mandatory && !valued) {
        return { ok: false, reason: `Komponen mandatory belum bernilai: ${item.name}.` };
      }
    }
  }

  // Rate sensitivity — the price must not rest on a stale CNY rate.
  const [current, { data: config }] = await Promise.all([
    resolveExchangeRate(supabase),
    supabase.from("rate_sensitivity_config").select("threshold_pct").eq("is_active", true).limit(1).maybeSingle(),
  ]);
  const threshold = config ? Number(config.threshold_pct) : 2;
  if (current) {
    for (const line of lines) {
      const locked = Number(line.locked_fx_rate ?? 0);
      if (locked > 0 && (Math.abs(Number(current.rate) - locked) / locked) * 100 > threshold) {
        return {
          ok: false,
          reason: `Kurs CNY/IDR bergerak melewati ambang ${threshold}% sejak cost structure dikunci — Hitung Ulang dulu.`,
        };
      }
    }
  }

  const ladder = await loadLadder(supabase, proposal.business_line, proposal.workflow_template_code);
  const tier = resolveTier(Number(proposal.gm ?? -1) * 100, ladder);
  if (tier && tier.tier > 1) {
    const rows = (await loadTierRound(supabase, proposal)).filter((r) => r.kind === "DECISION");
    if (rows.length === 0 || rows.some((r) => r.decision !== "APPROVE")) {
      return { ok: false, reason: `Tier ${tier.tier} belum disetujui lengkap (AND-join).` };
    }
  }

  return { ok: true };
}

export async function nextDocumentNumber(
  supabase: Db,
  settings: AppSettings,
  schemeCode: string,
  at: Date
): Promise<string> {
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const yyyy = String(at.getFullYear());
  const { data } = await supabase
    .from("pricing_proposal")
    .select("document_number")
    .like("document_number", `%/${mm}-${yyyy}`);
  const maxSeq = (data ?? [])
    .map((r: { document_number: string | null }) => Number.parseInt(r.document_number?.split("/")[0] ?? "0", 10))
    .filter((n) => !Number.isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return settings.documentNumberPattern
    .replace("{seq}", String(maxSeq + 1).padStart(4, "0"))
    .replace("{scheme}", schemeCode)
    .replace("{unit}", settings.documentUnitCode)
    .replace("{MM}", mm)
    .replace("{YYYY}", yyyy);
}

export async function releaseQuotation(
  supabase: Db,
  proposal: PricingProposal,
  actor: Actor
): Promise<void> {
  const gate = await checkReleaseGate(supabase, proposal);
  if (!gate.ok) throw new Error(`Quotation belum dapat dirilis — ${gate.reason}`);

  const settings = await loadSettings(supabase);
  const lines = await loadLines(supabase, proposal.id);
  const schemeCode = lines.some((l) => l.scheme === "RENTAL") ? "RNT" : "PUR";
  const now = new Date();
  const documentNumber = await nextDocumentNumber(supabase, settings, schemeCode, now);
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + settings.quotationValidityDays);

  const { steps, instance } = await loadCurrentInstance(supabase, proposal);
  const open = activeStep(steps);
  if (open) {
    await setStep(supabase, open, {
      status: "APPROVED",
      completed_at: now.toISOString(),
      actor_id: open.actor_id ?? actor.id,
    });
  }
  if (instance) {
    await supabase.from("workflow_instance").update({ status: "COMPLETED" }).eq("id", instance.id);
  }

  await supabase
    .from("pricing_proposal")
    .update({
      current_status: "QUOTATION_RELEASED",
      document_number: documentNumber,
      released_at: now.toISOString(),
      valid_until: validUntil.toISOString().slice(0, 10),
    })
    .eq("id", proposal.id);

  if (proposal.supersedes_proposal_id) {
    await supabase
      .from("pricing_proposal")
      .update({ current_status: "SUPERSEDED" })
      .eq("id", proposal.supersedes_proposal_id);
    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposal.supersedes_proposal_id,
      proposalId: proposal.supersedes_proposal_id,
      actorId: actor.id,
      action: "SUPERSEDE",
      reason: `Digantikan oleh ${proposal.proposal_number} (${documentNumber})`,
    });
  }

  await writeAuditLog(supabase, {
    entityType: "pricing_proposal",
    entityId: proposal.id,
    proposalId: proposal.id,
    actorId: actor.id,
    action: "RELEASE",
    reason: `Dirilis sebagai ${documentNumber}, berlaku s.d. ${validUntil.toISOString().slice(0, 10)}.`,
    fieldChanges: [{ field: "current_status", old: proposal.current_status, new: "QUOTATION_RELEASED" }],
  });
}

/**
 * Lazy expiry (FR-2.9): a released quotation past valid_until without a
 * WON outcome becomes EXPIRED the next time anyone looks at it — a POC
 * stand-in for the daily job described in Technical Logic §4.11.
 */
export async function expireStaleQuotations(supabase: Db, actorId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("pricing_proposal")
    .select("id, document_number")
    .eq("current_status", "QUOTATION_RELEASED")
    .eq("outcome", "PENDING")
    .lt("valid_until", today);
  for (const p of (data ?? []) as { id: string; document_number: string | null }[]) {
    await supabase.from("pricing_proposal").update({ current_status: "EXPIRED" }).eq("id", p.id);
    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: p.id,
      proposalId: p.id,
      actorId,
      action: "EXPIRE",
      reason: `Masa berlaku ${p.document_number ?? ""} habis — perpanjang lewat revisi.`,
    });
  }
}

export function actorCanActOnStep(actor: Actor, step: WorkflowStepInstance | null): boolean {
  return Boolean(step?.performer_function && hasFunction(actor, step.performer_function));
}
