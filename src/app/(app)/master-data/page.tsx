import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { CbsTemplate, CostGroup, CostItem, Department } from "@/types/database";
import { CostItemForm } from "./CostItemForm";
import { ToggleActiveButton } from "./ToggleActiveButton";
import { canConfigureMasterData } from "@/lib/rbac";
import { ExchangeRatePanel, MineralIndexPanel, RateSensitivityPanel } from "./RateAndIndexPanel";
import { loadMineralContext } from "@/lib/pricing/mineral";
import type { ExchangeRate, MineralIndexSnapshot, RateSensitivityConfig } from "@/types/database";

const COST_GROUP_LABEL: Record<CostGroup, string> = {
  COGS: "COGS",
  PROFITABILITY: "Profitability",
  SALES: "Sales",
  ADD_ONS: "Add-Ons",
};

const COST_GROUP_TONE: Record<CostGroup, "info" | "success" | "warning" | "default"> = {
  COGS: "info",
  PROFITABILITY: "success",
  SALES: "warning",
  ADD_ONS: "default",
};

const COST_GROUP_ORDER: CostGroup[] = ["COGS", "PROFITABILITY", "SALES", "ADD_ONS"];

export default async function MasterDataPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    { data: costItems },
    { data: departments },
    { data: templates },
    { data: rates },
    { data: snapshots },
    { data: rateSensitivityConfig },
    mineral,
  ] = await Promise.all([
    supabase.from("cost_item").select("*").order("cost_group").order("code"),
    supabase.from("department").select("*").order("name"),
    supabase.from("cbs_template").select("*").eq("status", "active"),
    supabase
      .from("exchange_rate")
      .select("*")
      .order("effective_from", { ascending: false })
      .limit(10),
    supabase
      .from("mineral_index_snapshot")
      .select("*")
      .order("period_end", { ascending: false })
      .limit(20),
    supabase
      .from("rate_sensitivity_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    loadMineralContext(supabase),
  ]);

  const items = (costItems ?? []) as CostItem[];
  const depts = (departments ?? []) as Department[];
  const tmpls = (templates ?? []) as CbsTemplate[];
  const deptById = Object.fromEntries(depts.map((d) => [d.id, d]));

  const grouped = Object.fromEntries(
    COST_GROUP_ORDER.map((g) => [g, items.filter((i) => i.cost_group === g)])
  ) as Record<CostGroup, CostItem[]>;

  const canEdit = canConfigureMasterData(profile.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Master Data &amp; CBS Builder</h1>
        <p className="text-sm text-muted mt-1">
          Cost Breakdown Structure (CBS) <strong>tunggal</strong> untuk seluruh
          lini bisnis (FR-1.1) — struktur riil VKTR/BTEL: COGS, Profitability,
          Sales, dan Add-Ons.
        </p>
      </div>

      {tmpls.map((t) => (
        <Card key={t.id}>
          <CardHeader>
            <div>
              <CardTitle>{t.name}</CardTitle>
              <CardDescription>
                Berlaku untuk semua lini bisnis — satu master data, bukan per
                segmen
              </CardDescription>
            </div>
            <Badge tone={t.status === "active" ? "success" : "default"}>{t.status}</Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-xs text-muted lg:grid-cols-4">
            <div className="flex justify-between lg:block lg:space-y-0.5">
              <span>Min. GPM Threshold (Tier 1)</span>
              <span className="font-medium text-foreground">
                {(t.min_gpm_threshold * 100).toFixed(1)}%
              </span>
            </div>
            {COST_GROUP_ORDER.map((g) => (
              <div key={g} className="flex justify-between lg:block lg:space-y-0.5">
                <span>{COST_GROUP_LABEL[g]}</span>
                <span className="font-medium text-foreground">
                  {grouped[g].length} item
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="space-y-4">
        <ExchangeRatePanel rates={(rates ?? []) as ExchangeRate[]} canEdit={canEdit} />
        <RateSensitivityPanel
          config={(rateSensitivityConfig as RateSensitivityConfig | null) ?? null}
          canEdit={canEdit}
        />
        <MineralIndexPanel
          snapshots={(snapshots ?? []) as MineralIndexSnapshot[]}
          canEdit={canEdit}
          hpm={mineral.hpm}
        />
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah Cost Item Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <CostItemForm departments={depts} />
          </CardContent>
        </Card>
      )}

      {COST_GROUP_ORDER.map((group) => (
        <Card key={group}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{COST_GROUP_LABEL[group]}</CardTitle>
              <Badge tone={COST_GROUP_TONE[group]}>{grouped[group].length} items</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                  <th className="px-5 py-2.5 font-medium">Code</th>
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium">Owner Dept</th>
                  <th className="px-5 py-2.5 font-medium">Unit Type</th>
                  <th className="px-5 py-2.5 font-medium">Denom.</th>
                  <th className="px-5 py-2.5 font-medium">Mandatory</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  {canEdit && <th className="px-5 py-2.5 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {grouped[group].map((item) => (
                  <tr key={item.id} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-2.5 font-mono text-xs text-muted">{item.code}</td>
                    <td className="px-5 py-2.5 font-medium">
                      {item.name}
                      {item.may_follow_later && (
                        <Badge tone="info" className="ml-1.5">
                          boleh menyusul
                        </Badge>
                      )}
                      {item.is_mineral_linked && (
                        <span className="ml-1.5 text-success text-xs">
                          ⛏ {item.mineral_code}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-muted">
                      {deptById[item.owner_department_id]?.name ?? "—"}
                    </td>
                    <td className="px-5 py-2.5 text-muted">{item.unit_type}</td>
                    <td className="px-5 py-2.5 text-muted">{item.denomination}</td>
                    <td className="px-5 py-2.5">
                      {item.is_mandatory ? (
                        <Badge tone="danger">Mandatory</Badge>
                      ) : (
                        <Badge>Optional</Badge>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge tone={item.active ? "success" : "default"}>
                        {item.active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-2.5 text-right">
                        <ToggleActiveButton id={item.id} active={item.active} />
                      </td>
                    )}
                  </tr>
                ))}
                {grouped[group].length === 0 && (
                  <tr>
                    <td
                      colSpan={canEdit ? 8 : 7}
                      className="px-5 py-6 text-center text-muted"
                    >
                      Belum ada item pada kelompok ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
