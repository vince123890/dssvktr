import { createClient } from "@/lib/supabase/server";
import { requireInternal } from "@/lib/auth";
import { FUNCTIONAL_ROLES, FUNCTIONAL_ROLE_LABEL, canManageSettings } from "@/lib/rbac";
import { loadSettings } from "@/lib/settings";
import { loadBands } from "@/lib/workflow/quotationEngine";
import { Card, CardContent } from "@/components/ui/Card";
import Link from "next/link";
import {
  BandEditor,
  GeneralSettingsEditor,
  PriceEstimateAccessEditor,
  RolesEditor,
  ScopeAuthorityEditor,
  TierEditor,
  UsersEditor,
  WorkflowEditor,
  type StepDraft,
} from "./SettingsEditors";
import type {
  AppRole,
  MarginTierAuthority,
  ScopeAuthority,
  ScopeSegregationRule,
  WorkflowDefinition,
  WorkflowStepDefinition,
} from "@/types/database";

const TABS = [
  { key: "roles", label: "Roles & Users" },
  { key: "authority", label: "Scope Authority (M/C/R)" },
  { key: "workflow", label: "Workflow" },
  { key: "tier", label: "Tier Margin & Quantity Band" },
  { key: "general", label: "Umum & Dokumen" },
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "roles" } = await searchParams;
  const me = await requireInternal();
  if (!canManageSettings(me)) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted">Settings hanya untuk System Admin.</CardContent></Card>;
  }
  const supabase = await createClient();
  const { data: roleRows } = await supabase.from("app_role").select("*").order("sort_order");
  const roles = (roleRows ?? []) as AppRole[];

  let body: React.ReactNode = null;

  if (tab === "roles") {
    const { data: users } = await supabase.from("profile").select("id, full_name, email, app_role_code").order("full_name");
    body = (
      <div className="space-y-6">
        <RolesEditor roles={roles} />
        <UsersEditor users={users ?? []} roles={roles} />
      </div>
    );
  } else if (tab === "authority") {
    const [{ data: rows }, { data: rules }, settings] = await Promise.all([
      supabase.from("scope_authority").select("*"),
      supabase.from("scope_segregation_rule").select("*"),
      loadSettings(supabase),
    ]);
    const order = ["COGS", "ADD_ONS", "MARGIN", "SALES"];
    body = (
      <ScopeAuthorityEditor
        roles={roles}
        rows={(rows ?? []) as ScopeAuthority[]}
        rules={((rules ?? []) as ScopeSegregationRule[]).sort((a, b) => order.indexOf(a.scope) - order.indexOf(b.scope))}
        deviationThreshold={settings.deviationGmThresholdPct}
      />
    );
  } else if (tab === "workflow") {
    const { data: defs } = await supabase.from("workflow_definition").select("*").eq("is_active", true).order("created_at");
    const active = (defs ?? []) as WorkflowDefinition[];
    const oq = active.filter((d) => d.workflow_kind === "OFFICIAL_QUOTATION");
    const pe = active.find((d) => d.workflow_kind === "PRICE_ESTIMATE");
    const stepsByDef = new Map<string, StepDraft[]>();
    for (const d of oq) {
      const { data: steps } = await supabase.from("workflow_step_definition").select("*").eq("workflow_definition_id", d.id).order("step_order");
      stepsByDef.set(
        d.id,
        ((steps ?? []) as WorkflowStepDefinition[]).map((s) => ({
          step_name: s.step_name ?? `Langkah ${s.step_order}`,
          action_kind: s.action_kind ?? "APPROVE",
          performer_function: s.performer_function ?? "SALES_RELEASER",
          skip_if_initiator_function: s.skip_if_initiator_function,
          reject_to_step_order: s.reject_to_step_order,
          sla_hours: s.sla_hours,
        }))
      );
    }
    body = (
      <div className="space-y-6">
        {pe && <PriceEstimateAccessEditor definitionId={pe.id} allowed={pe.allowed_functions} />}
        {oq.map((d) => (
          <WorkflowEditor key={d.id} definitionId={d.id} name={d.name} version={d.version} steps={stepsByDef.get(d.id) ?? []} />
        ))}
      </div>
    );
  } else if (tab === "tier") {
    const [{ data: tiers }, bands] = await Promise.all([
      supabase.from("margin_tier_authority").select("*").eq("is_active", true).is("business_line", null).order("tier"),
      loadBands(supabase),
    ]);
    const slotOptions = [
      ...FUNCTIONAL_ROLES.filter((f) => f !== "EXTERNAL_AGENCY" && f !== "SALESPERSON").map((f) => ({ value: f, label: FUNCTIONAL_ROLE_LABEL[f] })),
      ...roles.filter((r) => !r.is_external).map((r) => ({ value: `role:${r.code}`, label: `Hanya ${r.name}` })),
    ];
    body = (
      <div className="space-y-6">
        <TierEditor tiers={((tiers ?? []) as MarginTierAuthority[]).map((t) => ({ ...t, gpm_lower_bound_pct: t.gpm_lower_bound_pct == null ? null : Number(t.gpm_lower_bound_pct), gpm_upper_bound_pct: t.gpm_upper_bound_pct == null ? null : Number(t.gpm_upper_bound_pct) }))} slotOptions={slotOptions} />
        <BandEditor bands={bands} />
      </div>
    );
  } else {
    body = <GeneralSettingsEditor settings={await loadSettings(supabase)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Role, wewenang Maker/Checker/Releaser, dan workflow dari <em>BTEL - Cost and Roles and Flow.xlsx</em> dikelola
          di sini sebagai data — tanpa ubah kode atau rilis ulang aplikasi. Setiap perubahan tercatat di Audit Trail.
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-card-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/settings?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {body}
    </div>
  );
}
