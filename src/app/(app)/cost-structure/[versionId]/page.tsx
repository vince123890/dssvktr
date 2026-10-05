import { createClient } from "@/lib/supabase/server";
import { requireMenu } from "@/lib/menuAccess";
import { canSeeCostStructure, hasAnyFunction } from "@/lib/rbac";
import {
  canPerformScopeAction,
  evaluateVersion,
  loadCostItems,
  loadVersionLines,
  versionScenario,
} from "@/lib/costStructure";
import { GROUP_OF_SCOPE, SCOPE_LABEL, SCOPE_ORDER } from "@/lib/pricing/quotation";
import { loadSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatIDR } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScopeCard, type ScopeItemView } from "./ScopeCard";
import { DiscardDraftButton } from "../DiscardDraftButton";
import { NewVersionButton } from "../NewVersionButton";
import type {
  CostStructureScopeState,
  CostStructureVersion,
  ProductMasterData,
  Profile,
} from "@/types/database";

export default async function CostStructureVersionPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const me = await requireMenu("cost_structure");
  if (!canSeeCostStructure(me)) notFound();
  const supabase = await createClient();

  const { data: vRow } = await supabase.from("cost_structure_version").select("*").eq("id", versionId).maybeSingle();
  if (!vRow) notFound();
  const version = vRow as CostStructureVersion;

  const [items, lines, settings, { data: product }, { data: stateRows }, { data: siblingRows }] = await Promise.all([
    loadCostItems(supabase),
    loadVersionLines(supabase, versionId),
    loadSettings(supabase),
    supabase.from("product_master_data").select("*").eq("id", version.product_id).single(),
    supabase.from("cost_structure_scope_state").select("*").eq("version_id", versionId),
    supabase
      .from("cost_structure_version")
      .select("id, version_no, status")
      .eq("product_id", version.product_id)
      .in("status", ["DRAFT", "RELEASED"]),
  ]);
  const siblings = (siblingRows ?? []) as Pick<CostStructureVersion, "id" | "version_no" | "status">[];
  const openDraft = siblings.find((s) => s.status === "DRAFT" && s.id !== version.id) ?? null;
  const current = siblings.find((s) => s.status === "RELEASED") ?? null;
  const isOwner = hasAnyFunction(me, ["COGS_OWNER", "PROFITABILITY_OWNER", "SALES_PRICING_OWNER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"]);
  const states = (stateRows ?? []) as CostStructureScopeState[];
  const cs = evaluateVersion(items, lines, Number(version.locked_fx_rate));
  const scenario = versionScenario(cs, settings.deviationGmThresholdPct);

  const peopleIds = states.flatMap((s) => [s.maker_id, s.checker_id, s.releaser_id]).filter(Boolean) as string[];
  const { data: people } = await supabase.from("profile").select("id, full_name").in("id", peopleIds.length ? peopleIds : ["00000000-0000-0000-0000-000000000000"]);
  const nameOf = (id: string | null) => ((people ?? []) as Pick<Profile, "id" | "full_name">[]).find((p) => p.id === id)?.full_name ?? null;

  const editableVersion = version.status === "DRAFT";

  const cards = await Promise.all(
    SCOPE_ORDER.map(async (scope) => {
      const state = states.find((s) => s.scope === scope) ?? null;
      const perms = editableVersion && state
        ? await Promise.all(
            (["make", "check", "release"] as const).map((a) =>
              canPerformScopeAction(supabase, { actor: me, scope, scenario, action: a, state })
            )
          )
        : [];
      const scopeItems: ScopeItemView[] = items
        .filter((i) => i.cost_group === GROUP_OF_SCOPE[scope])
        .map((i) => {
          const l = lines.find((x) => x.cost_item_id === i.id);
          return {
            id: i.id,
            name: i.name,
            unitType: i.unit_type,
            denomination: i.denomination,
            isDerived: i.is_derived,
            isMandatory: i.is_mandatory,
            mayFollowLater: i.may_follow_later,
            value: Number(l?.value ?? 0),
            excluded: Boolean(l?.is_excluded_at_cost),
            amountIdr: cs.itemAmounts[i.id] ?? 0,
          };
        });
      return {
        scope,
        state,
        scopeItems,
        can: {
          make: perms[0]?.allowed ?? false,
          check: perms[1]?.allowed ?? false,
          release: perms[2]?.allowed ?? false,
        },
        hints: perms.filter((p) => !p.allowed).map((p) => p.reason ?? ""),
        people: state
          ? { maker: nameOf(state.maker_id), checker: nameOf(state.checker_id), releaser: nameOf(state.releaser_id) }
          : { maker: null, checker: null, releaser: null },
      };
    })
  );

  const p = product as ProductMasterData;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <Link href="/cost-structure" className="text-xs text-primary hover:underline">← Cost Structure</Link>
          {/* View the detail first, then change from here: a released version opens a new draft (FR-1.4). */}
          {editableVersion && isOwner && (
            <DiscardDraftButton versionId={version.id} versionNo={version.version_no} redirectTo="/cost-structure" />
          )}
          {version.status === "RELEASED" && isOwner && (
            openDraft ? (
              <Link href={`/cost-structure/${openDraft.id}`} className="text-xs font-medium text-primary hover:underline">
                Lanjutkan draft v{openDraft.version_no} →
              </Link>
            ) : (
              <NewVersionButton productId={version.product_id} label={`Buat perubahan (v${version.version_no + 1})`} />
            )
          )}
          {version.status === "RETIRED" && current && (
            <Link href={`/cost-structure/${current.id}`} className="text-xs font-medium text-primary hover:underline">
              Lihat versi berlaku v{current.version_no} →
            </Link>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{p.name} — v{version.version_no}</h1>
          <Badge tone={version.status === "RELEASED" ? "success" : version.status === "DRAFT" ? "info" : "default"}>{version.status}</Badge>
          <Badge tone={scenario === "REGULAR" ? "default" : "danger"}>Skenario {scenario}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          Kurs CNY/IDR terkunci {Number(version.locked_fx_rate).toLocaleString("id-ID")}
          {version.change_reason ? ` · ${version.change_reason}` : ""}. Skenario Deviation berlaku bila GM standar &lt;{" "}
          {settings.deviationGmThresholdPct}% — CCO & CFO lalu ikut berwenang di semua scope.
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
          <Stat label="Base cost (COGS + Add-Ons)" value={formatIDR(cs.baseCost)} />
          <Stat label="Margin" value={formatIDR(cs.marginAmount)} />
          <Stat label="Sales" value={formatIDR(cs.salesCost)} />
          <Stat label="Harga dasar excl. VAT" value={formatIDR(cs.listPriceExVat)} />
          <Stat label="GM standar" value={`${(cs.standardGm * 100).toFixed(2)}%`} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {cards.map((c) => (
          <ScopeCard
            key={c.scope}
            versionId={versionId}
            scope={c.scope}
            scopeLabel={SCOPE_LABEL[c.scope]}
            state={c.state}
            items={c.scopeItems}
            editableVersion={editableVersion}
            can={c.can}
            hints={c.hints}
            people={c.people}
            scopeTotal={c.scope === "MARGIN" ? cs.marginAmount : cs.scopeTotals[c.scope]}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
