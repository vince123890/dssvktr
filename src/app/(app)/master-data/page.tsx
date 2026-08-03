import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { CbsTemplate, CostItem, Department } from "@/types/database";
import { CostItemForm } from "./CostItemForm";
import { ToggleActiveButton } from "./ToggleActiveButton";
import { canConfigureMasterData } from "@/lib/rbac";

const CATEGORY_LABEL: Record<string, string> = {
  DIRECT: "Direct Costs",
  INDIRECT: "Indirect Costs",
  MARGIN_FACTOR: "Margin & Financial Factors",
};

const CATEGORY_TONE: Record<string, "info" | "warning" | "success"> = {
  DIRECT: "info",
  INDIRECT: "warning",
  MARGIN_FACTOR: "success",
};

const BUSINESS_LINE_LABEL: Record<string, string> = {
  B2G_TENDER_BUS: "B2G Tender Bus",
  B2B_COMMERCIAL_FLEET: "B2B Commercial Fleet",
  CHARGING_INFRA_BUILDOUT: "Charging Infrastructure Buildout",
};

export default async function MasterDataPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: costItems }, { data: departments }, { data: templates }] =
    await Promise.all([
      supabase.from("cost_item").select("*").order("category").order("code"),
      supabase.from("department").select("*").order("name"),
      supabase.from("cbs_template").select("*").order("business_line"),
    ]);

  const items = (costItems ?? []) as CostItem[];
  const depts = (departments ?? []) as Department[];
  const tmpls = (templates ?? []) as CbsTemplate[];
  const deptById = Object.fromEntries(depts.map((d) => [d.id, d]));

  const grouped = {
    DIRECT: items.filter((i) => i.category === "DIRECT"),
    INDIRECT: items.filter((i) => i.category === "INDIRECT"),
    MARGIN_FACTOR: items.filter((i) => i.category === "MARGIN_FACTOR"),
  };

  const canEdit = canConfigureMasterData(profile.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Master Data &amp; CBS Builder</h1>
        <p className="text-sm text-muted mt-1">
          Cost Breakdown Structure (CBS) terpusat — Direct Costs, Indirect
          Costs, dan Margin/Financial Factors (FR-1.1). Single source of
          truth untuk seluruh lini bisnis.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {tmpls.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <div>
                <CardTitle>{BUSINESS_LINE_LABEL[t.business_line]}</CardTitle>
                <CardDescription>{t.name}</CardDescription>
              </div>
              <Badge tone={t.status === "active" ? "success" : "default"}>
                {t.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted">
              <div className="flex justify-between">
                <span>Min. GPM Threshold</span>
                <span className="font-medium text-foreground">
                  {(t.min_gpm_threshold * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Eskalasi C-Level di atas</span>
                <span className="font-medium text-foreground">
                  Rp {(t.escalation_threshold_value / 1_000_000_000).toFixed(0)} Miliar
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
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

      {(["DIRECT", "INDIRECT", "MARGIN_FACTOR"] as const).map((cat) => (
        <Card key={cat}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{CATEGORY_LABEL[cat]}</CardTitle>
              <Badge tone={CATEGORY_TONE[cat]}>{grouped[cat].length} items</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
                  <th className="px-5 py-2.5 font-medium">Code</th>
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium">Subcategory</th>
                  <th className="px-5 py-2.5 font-medium">Owner Dept</th>
                  <th className="px-5 py-2.5 font-medium">Unit Type</th>
                  <th className="px-5 py-2.5 font-medium">Mandatory</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  {canEdit && <th className="px-5 py-2.5 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {grouped[cat].map((item) => (
                  <tr key={item.id} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-2.5 font-mono text-xs text-muted">{item.code}</td>
                    <td className="px-5 py-2.5 font-medium">{item.name}</td>
                    <td className="px-5 py-2.5 text-muted">{item.subcategory}</td>
                    <td className="px-5 py-2.5 text-muted">
                      {deptById[item.owner_department_id]?.name ?? "—"}
                    </td>
                    <td className="px-5 py-2.5 text-muted">{item.unit_type}</td>
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
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
