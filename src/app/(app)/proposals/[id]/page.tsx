import { createClient } from "@/lib/supabase/server";
import { canViewQuotation, loadValidatorVisibleRoles, requireMenu } from "@/lib/menuAccess";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  BUSINESS_LINE_LABEL,
  LIKELIHOOD_LABEL,
  PERIOD_LABEL,
  PROJECT_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  STEP_STATUS_LABEL,
  STEP_STATUS_TONE,
} from "@/lib/workflow/labels";
import {
  FUNCTIONAL_ROLE_LABEL,
  actorFillsSlot,
  canSeeCostStructure,
  hasFunction,
  slotLabel,
} from "@/lib/rbac";
import {
  activeStep,
  actorCanActOnStep,
  expireStaleQuotations,
  loadCurrentInstance,
  loadLadder,
  loadLines,
  loadTierRound,
} from "@/lib/workflow/quotationEngine";
import { evaluateVersion, loadCostItems, loadVersionLines } from "@/lib/costStructure";
import { SCOPE_LABEL, SCOPE_OF_GROUP, SCOPE_ORDER } from "@/lib/pricing/quotation";
import { resolveExchangeRate } from "@/lib/pricing/currency";
import { loadSettings } from "@/lib/settings";
import { formatDate, formatIDR, timeAgo } from "@/lib/utils";
import { ActionPanel, type ActionCapabilities } from "./ActionPanel";
import { PricingEditor, type EditableLine } from "./PricingEditor";
import type {
  AppRole,
  PricingProposal,
  ProductMasterData,
  ProjectIdentifier,
  Profile,
  StepStatus,
} from "@/types/database";
import { AlertTriangle, CheckCircle2, FileText, Printer, XCircle } from "lucide-react";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMenu("quotations");
  const supabase = await createClient();

  await expireStaleQuotations(supabase, me.id);

  const { data: row } = await supabase.from("pricing_proposal").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const proposal = row as PricingProposal;
  if (!canViewQuotation(me, proposal, await loadValidatorVisibleRoles(supabase))) notFound();

  const [lines, { instance, steps }, tierRows, ladder, settings, currentRate, items] = await Promise.all([
    loadLines(supabase, id),
    loadCurrentInstance(supabase, proposal),
    loadTierRound(supabase, proposal),
    loadLadder(supabase, proposal.business_line, proposal.workflow_template_code),
    loadSettings(supabase),
    resolveExchangeRate(supabase),
    loadCostItems(supabase),
  ]);

  const [{ data: productRows }, { data: project }, { data: roleRows }, { data: siblings }, { data: rateConfig }, { data: templateRow }] =
    await Promise.all([
      supabase.from("product_master_data").select("*").in("id", lines.map((l) => l.product_id).concat(["00000000-0000-0000-0000-000000000000"])),
      supabase.from("project_identifier").select("*").eq("id", proposal.project_identifier_id).maybeSingle(),
      supabase.from("app_role").select("*"),
      supabase
        .from("pricing_proposal")
        .select("id, proposal_number, current_status, supersedes_proposal_id, document_number, created_at")
        .eq("project_identifier_id", proposal.project_identifier_id)
        .order("created_at"),
      supabase.from("rate_sensitivity_config").select("threshold_pct").eq("is_active", true).limit(1).maybeSingle(),
      proposal.workflow_definition_id
        ? supabase.from("workflow_definition").select("name, version, template_code").eq("id", proposal.workflow_definition_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const products = new Map(((productRows ?? []) as ProductMasterData[]).map((p) => [p.id, p]));
  const roles = (roleRows ?? []) as AppRole[];

  const profileIds = new Set<string>([proposal.created_by]);
  if (proposal.prepared_by) profileIds.add(proposal.prepared_by);
  steps.forEach((s) => s.actor_id && profileIds.add(s.actor_id));
  tierRows.forEach((t) => t.actor_id && profileIds.add(t.actor_id));
  const { data: profileRows } = await supabase.from("profile").select("id, full_name").in("id", [...profileIds]);
  const nameOf = (pid: string | null) =>
    ((profileRows ?? []) as Pick<Profile, "id" | "full_name">[]).find((p) => p.id === pid)?.full_name ?? "—";

  const seesCost = canSeeCostStructure(me);
  const step = activeStep(steps);
  const myStep = step && actorCanActOnStep(me, step) ? step : null;
  const decisionRows = tierRows.filter((t) => t.kind === "DECISION");
  const ccRows = tierRows.filter((t) => t.kind === "CC");
  const alreadyDecided = decisionRows.some((t) => t.actor_id === me.id);
  const mySlot = alreadyDecided ? null : decisionRows.find((t) => t.decision === null && actorFillsSlot(me, t.slot));
  const tierPending = proposal.current_status === "PENDING_OWNER_APPROVAL" || proposal.current_status === "PENDING_PRICING_COMMITTEE_APPROVAL";
  const successor = (siblings ?? []).find((s: { supersedes_proposal_id: string | null }) => s.supersedes_proposal_id === proposal.id);

  const waitingFor = step?.performer_function
    ? FUNCTIONAL_ROLE_LABEL[step.performer_function]
    : tierPending
      ? decisionRows.filter((t) => t.decision === null).map((t) => slotLabel(t.slot, roles)).join(" + ")
      : null;

  const caps: ActionCapabilities = {
    canSubmit: proposal.current_status === "DRAFT" && proposal.created_by === me.id,
    canEditDraft: proposal.current_status === "DRAFT" && proposal.created_by === me.id,
    stepKind: myStep?.action_kind ?? null,
    stepName: myStep?.step_name ?? null,
    tierDecision: tierPending && mySlot ? { tier: mySlot.tier, slotName: slotLabel(mySlot.slot, roles) } : null,
    canRetryRelease:
      tierPending &&
      decisionRows.length > 0 &&
      decisionRows.every((t) => t.decision === "APPROVE") &&
      hasFunction(me, "SALES_RELEASER"),
    canRecordOutcome:
      proposal.current_status === "QUOTATION_RELEASED" &&
      proposal.outcome === "PENDING" &&
      (hasFunction(me, "SALESPERSON") || hasFunction(me, "SALES_RELEASER")),
    canRevise:
      (proposal.current_status === "QUOTATION_RELEASED" || proposal.current_status === "EXPIRED") &&
      !successor &&
      hasFunction(me, "SALESPERSON"),
    waitingFor,
  };

  // Rate sensitivity: a quotation still in flight must not rest on a stale CNY rate.
  const threshold = rateConfig ? Number(rateConfig.threshold_pct) : 2;
  const staleLine =
    currentRate && lines.find((l) => {
      const locked = Number(l.locked_fx_rate ?? 0);
      return locked > 0 && (Math.abs(Number(currentRate.rate) - locked) / locked) * 100 > threshold;
    });
  const inFlight = !["DRAFT", "QUOTATION_RELEASED", "EXPIRED", "SUPERSEDED", "REJECTED"].includes(proposal.current_status);

  // Detail cost structure (sheet step 6b — highly confidential) per line.
  const breakdowns = seesCost
    ? await Promise.all(
        lines.map(async (l) => {
          if (!l.cost_structure_version_id) return null;
          const vLines = await loadVersionLines(supabase, l.cost_structure_version_id);
          const cs = evaluateVersion(items, vLines, Number(l.locked_fx_rate ?? 0));
          const { data: v } = await supabase.from("cost_structure_version").select("version_no").eq("id", l.cost_structure_version_id).maybeSingle();
          return { lineId: l.id, cs, vLines, versionNo: v?.version_no as number | undefined };
        })
      )
    : [];

  const slotNames = Object.fromEntries(
    ladder.flatMap((t) => [...t.decision_slots, ...t.cc_slots]).map((s) => [s, slotLabel(s, roles)])
  );

  const editableLines: EditableLine[] = lines.map((l) => ({
    id: l.id,
    productName: products.get(l.product_id)?.name ?? "—",
    quantity: l.quantity,
    band: proposal.quantity_band,
    listPriceExVat: Number(l.list_price_ex_vat),
    baseCost: Number(l.base_cost),
    salesCost: Number(l.sales_cost),
    discountMode: l.discount_input_mode,
    discountAmount: Number(l.discount_amount),
    discountPct: Number(l.discount_pct),
    discountSource: l.discount_source,
    scheme: l.scheme,
    rentalTenorMonths: l.rental_tenor_months,
    rentalMonthlyInclVat: l.rental_monthly_incl_vat ? Number(l.rental_monthly_incl_vat) : null,
  }));

  const showEditor =
    myStep && (myStep.action_kind === "GENERATE_QUOTATION" || myStep.action_kind === "REVIEW_AND_ROUTE");
  const pricedYet = lines.some((l) => l.cost_structure_version_id);
  const released = ["QUOTATION_RELEASED", "EXPIRED", "SUPERSEDED"].includes(proposal.current_status);
  const k = proposal.kyc;
  const proj = project as ProjectIdentifier | null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{proposal.proposal_number}</span>
            <Badge tone={STATUS_TONE[proposal.current_status]}>{STATUS_LABEL[proposal.current_status]}</Badge>
            {proposal.outcome !== "PENDING" && <Badge tone={proposal.outcome === "WON" ? "success" : "danger"}>{proposal.outcome}</Badge>}
            {seesCost && proposal.margin_tier && <Badge tone={proposal.margin_tier === 1 ? "success" : proposal.margin_tier === 2 ? "warning" : "danger"}>Tier {proposal.margin_tier}</Badge>}
          </div>
          <h1 className="mt-1 text-xl font-semibold">{proposal.title}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {BUSINESS_LINE_LABEL[proposal.business_line] ?? proposal.business_line} · diajukan {nameOf(proposal.created_by)} · {formatDate(proposal.created_at)}
          </p>
          {proj && (
            <p className="mt-1 text-xs text-muted">
              Project Identifier <span className="font-mono">{proj.identifier_code}</span>
              {proposal.document_number && (
                <> · Dokumen <span className="font-mono">{proposal.document_number}</span></>
              )}
              {proposal.valid_until && <> · berlaku s.d. {proposal.valid_until}</>}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {pricedYet && (
            <Link href={`/print/proposals/${proposal.id}`} target="_blank">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-card-border bg-white px-4 text-sm font-medium shadow-sm hover:bg-slate-50">
                <FileText size={15} /> {released ? "Preview / Print Cost Estimate" : "Preview Dokumen (Draft)"}
              </span>
            </Link>
          )}
          {seesCost && pricedYet && (
            <Link href={`/print/proposals/${proposal.id}/cost-structure`} target="_blank">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-card-border bg-white px-4 text-sm font-medium shadow-sm hover:bg-slate-50">
                <Printer size={15} /> Cost Structure Sheet
              </span>
            </Link>
          )}
        </div>
      </div>

      {inFlight && staleLine && currentRate && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          <AlertTriangle size={16} className="shrink-0" />
          Kurs CNY/IDR kini {Number(currentRate.rate).toLocaleString("id-ID")} — bergerak melewati ambang {threshold}% dari kurs terkunci{" "}
          {Number(staleLine.locked_fx_rate).toLocaleString("id-ID")}. COGS Owner perlu merilis versi cost structure baru, lalu Sales
          Operations / Head of Sales menekan &quot;Hitung Ulang&quot;. Release Gate menahan rilis sampai itu.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {showEditor && (
            <PricingEditor
              proposalId={proposal.id}
              lines={editableLines}
              ladder={ladder}
              vatRatePct={settings.vatRatePct}
              inclusions={proposal.inclusions}
              exclusions={proposal.exclusions}
              specialNotes={proposal.special_notes}
              role={myStep!.action_kind === "REVIEW_AND_ROUTE" ? "HEAD_OF_SALES" : "SALES_OPERATIONS"}
              slotNames={slotNames}
            />
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Varian &amp; Harga</CardTitle>
                <CardDescription>
                  {seesCost
                    ? "Harga dihitung dari cost structure RELEASED yang dikunci per varian."
                    : released
                      ? "Harga yang dirilis ke Anda."
                      : "Harga akan tampil setelah quotation dirilis."}
                </CardDescription>
              </div>
              {seesCost && proposal.gm != null && pricedYet && (
                <span className="text-sm">
                  GM <strong>{(Number(proposal.gm) * 100).toFixed(2)}%</strong> · band {proposal.quantity_band ?? "-"} · {proposal.processing_mode ?? "-"}
                </span>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                    <th className="px-5 py-2.5 font-medium">Varian</th>
                    <th className="px-5 py-2.5 font-medium">Qty</th>
                    <th className="px-5 py-2.5 font-medium">Skema</th>
                    {seesCost && <th className="px-5 py-2.5 font-medium text-right">Harga dasar</th>}
                    {seesCost && <th className="px-5 py-2.5 font-medium text-right">Diskon</th>}
                    <th className="px-5 py-2.5 font-medium text-right">Harga / unit incl. VAT</th>
                    <th className="px-5 py-2.5 font-medium text-right">Total incl. VAT</th>
                    {seesCost && <th className="px-5 py-2.5 font-medium text-right">GM</th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const showPrice = seesCost || released;
                    return (
                      <tr key={l.id} className="border-b border-card-border last:border-0">
                        <td className="px-5 py-2.5 font-medium">{products.get(l.product_id)?.name}</td>
                        <td className="px-5 py-2.5">{l.quantity}</td>
                        <td className="px-5 py-2.5 text-xs">
                          {l.scheme === "RENTAL" ? `Rental ${l.rental_tenor_months ?? "-"} bln` : "Purchase"}
                        </td>
                        {seesCost && <td className="px-5 py-2.5 text-right text-xs">{formatIDR(Number(l.list_price_ex_vat))}</td>}
                        {seesCost && (
                          <td className="px-5 py-2.5 text-right text-xs">
                            {formatIDR(Number(l.discount_amount))}
                            <div className="text-[10px] text-muted">{Number(l.discount_pct).toFixed(3)}%</div>
                          </td>
                        )}
                        <td className="px-5 py-2.5 text-right">{showPrice && pricedYet ? formatIDR(Number(l.net_price_incl_vat)) : "—"}</td>
                        <td className="px-5 py-2.5 text-right">{showPrice && pricedYet ? formatIDR(Number(l.line_total_incl_vat)) : "—"}</td>
                        {seesCost && <td className="px-5 py-2.5 text-right font-medium">{l.gm != null ? `${(Number(l.gm) * 100).toFixed(2)}%` : "—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
                {(seesCost || released) && pricedYet && (
                  <tfoot>
                    <tr className="bg-slate-50 text-xs">
                      <td className="px-5 py-2.5 font-medium" colSpan={seesCost ? 6 : 4}>
                        Total excl. VAT {formatIDR(Number(proposal.total_ex_vat))} · PPN {proposal.vat_rate_pct ?? settings.vatRatePct}%
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold">{formatIDR(Number(proposal.total_incl_vat))}</td>
                      {seesCost && <td />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </CardContent>
          </Card>

          {seesCost &&
            breakdowns.map((b) =>
              b ? (
                <details key={b.lineId} className="rounded-xl border border-card-border bg-white shadow-sm">
                  <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">
                    Detail cost structure — {products.get(lines.find((l) => l.id === b.lineId)!.product_id)?.name} (v{b.versionNo}) ·{" "}
                    <span className="text-danger">Highly Confidential</span>
                  </summary>
                  <div className="grid grid-cols-1 gap-4 px-5 pb-4 md:grid-cols-2">
                    {SCOPE_ORDER.map((scope) => (
                      <div key={scope}>
                        <div className="mb-1 flex justify-between text-xs font-semibold">
                          <span>{SCOPE_LABEL[scope]}</span>
                          <span>{formatIDR(b.cs.scopeTotals[scope])}</span>
                        </div>
                        <table className="w-full text-[11px]">
                          <tbody>
                            {items
                              .filter((i) => SCOPE_OF_GROUP[i.cost_group] === scope)
                              .map((i) => {
                                const vl = b.vLines.find((x) => x.cost_item_id === i.id);
                                return (
                                  <tr key={i.id} className="border-b border-card-border last:border-0">
                                    <td className="py-1 pr-2 text-muted">{i.name}</td>
                                    <td className="py-1 text-right">
                                      {vl?.is_excluded_at_cost
                                        ? "Exclusion — At cost"
                                        : i.unit_type === "PERCENTAGE"
                                          ? `${Number(vl?.value ?? 0)}% · ${formatIDR(b.cs.itemAmounts[i.id] ?? 0)}`
                                          : formatIDR(b.cs.itemAmounts[i.id] ?? 0)}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null
            )}

          <Card>
            <CardHeader>
              <CardTitle>KYC Pelanggan</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs md:grid-cols-2">
              <Kv label="a. Perusahaan" value={k.company_name} />
              <Kv label="a. Alamat resmi" value={k.official_address} />
              <Kv label="c. Jenis proyek" value={k.project_type ? PROJECT_TYPE_LABEL[k.project_type] : undefined} />
              <Kv label="Proyek / lokasi" value={k.project_name} />
              <Kv label="d. Aplikasi / utilisasi" value={[k.application_body, k.utilization_content].filter(Boolean).join(" / ")} />
              <Kv label="e. Rute" value={`${k.route_description ?? ""} (${k.origin ?? "?"} → ${k.destination ?? "?"})`} />
              <Kv label="e. Produksi" value={k.production_value ? `${k.production_value} ${k.production_unit ?? ""} ${PERIOD_LABEL[k.production_period ?? "OTHER"]}` : undefined} />
              <Kv label="f. Likelihood" value={k.likelihood ? LIKELIHOOD_LABEL[k.likelihood] : undefined} />
              <Kv label="Kualifikasi deal" value={[k.customer_segment, k.industry, k.relationship].filter(Boolean).join(" · ")} />
              <Kv label="g. Gap identified" value={k.gap_identified} />
              <Kv label="h. Informasi lain" value={[k.requested_scheme === "RENTAL" ? "Minta skema Rental" : null, k.other_information].filter(Boolean).join(" · ")} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ActionPanel proposalId={proposal.id} caps={caps} />

          <Card>
            <CardHeader>
              <CardTitle>Alur Official Quotation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {templateRow && (
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-muted">Workflow Template</div>
                  <div className="font-semibold">
                    {templateRow.name} <span className="font-normal text-muted">v{templateRow.version}</span>
                  </div>
                  {proposal.workflow_selection_reason && <div className="text-muted">{proposal.workflow_selection_reason}</div>}
                  {proposal.is_blacklisted && <div className="font-medium text-danger">Customer tercantum di blacklist</div>}
                </div>
              )}
              <TimelineRow status={proposal.current_status === "DRAFT" ? "IN_PROGRESS" : "APPROVED"} title="KYC & submit (Salesperson)" detail={nameOf(proposal.created_by)} />
              {steps.map((s) => (
                <TimelineRow
                  key={s.id}
                  status={s.status}
                  title={s.step_name ?? `Langkah ${s.step_order}`}
                  detail={[
                    s.performer_function ? FUNCTIONAL_ROLE_LABEL[s.performer_function] : null,
                    s.actor_id ? nameOf(s.actor_id) : null,
                    s.completed_at ? timeAgo(s.completed_at) : s.status === "IN_PROGRESS" && s.sla_due_at ? `SLA s.d. ${formatDate(s.sla_due_at)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  note={s.decision_note}
                />
              ))}
              {decisionRows.length > 0 && (
                <div className="space-y-2 border-t border-card-border pt-3">
                  <div className="font-semibold">Persetujuan Tier {decisionRows[0].tier} (putaran {proposal.tier_round})</div>
                  {decisionRows.map((t) => (
                    <TimelineRow
                      key={t.id}
                      status={t.decision === "APPROVE" ? "APPROVED" : t.decision === "REJECT" ? "REJECTED" : "IN_PROGRESS"}
                      title={slotLabel(t.slot, roles)}
                      detail={t.actor_id ? `${nameOf(t.actor_id)} · ${t.decided_at ? timeAgo(t.decided_at) : ""}` : "menunggu keputusan"}
                      note={t.note}
                    />
                  ))}
                  {ccRows.length > 0 && (
                    <p className="text-muted">Tembusan (cc): {ccRows.map((t) => slotLabel(t.slot, roles)).join(", ")}</p>
                  )}
                </div>
              )}
              {released && proposal.released_at && (
                <TimelineRow status="APPROVED" title="Quotation Released" detail={`${proposal.document_number} · ${formatDate(proposal.released_at)}`} />
              )}
              {!instance && proposal.current_status === "DRAFT" && (
                <p className="text-muted">Workflow dimulai saat draft disubmit.</p>
              )}
            </CardContent>
          </Card>

          {(siblings ?? []).length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Linimasa Project Identifier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {(siblings ?? []).map((s: { id: string; proposal_number: string; current_status: PricingProposal["current_status"]; document_number: string | null }) => (
                  <Link key={s.id} href={`/proposals/${s.id}`} className={`flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50 ${s.id === proposal.id ? "bg-blue-50" : ""}`}>
                    <span className="font-mono">{s.document_number ?? s.proposal_number}</span>
                    <Badge tone={STATUS_TONE[s.current_status]}>{STATUS_LABEL[s.current_status]}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function TimelineRow({ status, title, detail, note }: { status: StepStatus; title: string; detail?: string | null; note?: string | null }) {
  const icon =
    status === "APPROVED" || status === "APPROVED_WITH_CONDITIONS" ? (
      <CheckCircle2 size={14} className="text-success" />
    ) : status === "REJECTED" ? (
      <XCircle size={14} className="text-danger" />
    ) : (
      <span className={`inline-block h-3 w-3 rounded-full ${status === "IN_PROGRESS" ? "bg-primary" : "bg-slate-300"}`} />
    );
  return (
    <div className="flex gap-2">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{title}</span>
          <Badge tone={STEP_STATUS_TONE[status]}>{STEP_STATUS_LABEL[status]}</Badge>
        </div>
        {detail && <div className="text-[11px] text-muted">{detail}</div>}
        {note && <div className="mt-0.5 rounded bg-slate-50 px-2 py-1 italic text-muted">&ldquo;{note}&rdquo;</div>}
      </div>
    </div>
  );
}
