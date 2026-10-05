import { createClient } from "@/lib/supabase/server";
import { FUNCTIONAL_ROLES, FUNCTIONAL_ROLE_LABEL, canManageSettings } from "@/lib/rbac";
import { loadSettings } from "@/lib/settings";
import { MENUS, loadMenuAccess, requireMenu } from "@/lib/menuAccess";
import { loadBands } from "@/lib/workflow/quotationEngine";
import { Card, CardContent } from "@/components/ui/Card";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BandEditor,
  GeneralSettingsEditor,
  MenuAccessEditor,
  RolesEditor,
  ScopeAuthorityEditor,
  TierEditor,
  UsersEditor,
} from "./SettingsEditors";
import { CatalogTable, TemplateTester, type TemplateRow } from "./WorkflowCatalog";
import { TierScopeBar } from "./TierScopeBar";
import { BUSINESS_LINE_LABEL } from "@/lib/workflow/labels";
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
  { key: "menus", label: "Akses Menu" },
  { key: "authority", label: "Scope Authority (M/C/R)" },
  { key: "workflow", label: "Workflow" },
  { key: "tier", label: "Tier Margin & Quantity Band" },
  { key: "general", label: "Umum & Dokumen" },
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; edit?: string; from?: string; scope?: string }>;
}) {
  const { tab = "roles", edit, from, scope } = await searchParams;
  // Old editor links (?tab=workflow&edit=…) now live on their own pages.
  if (tab === "workflow" && edit) {
    redirect(edit === "new" ? `/settings/workflow/new${from ? `?from=${encodeURIComponent(from)}` : ""}` : `/settings/workflow/${encodeURIComponent(edit)}/edit`);
  }
  const me = await requireMenu("settings");
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
  } else if (tab === "menus") {
    const access = await loadMenuAccess(supabase);
    body = (
      <MenuAccessEditor
        menus={MENUS.map((m) => ({ key: m.key, label: m.label, href: m.href, locked: Boolean(m.locked) }))}
        access={access}
        roles={roles}
      />
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
    const settings = await loadSettings(supabase);
    const lists = {
      segments: settings.qualifierSegments,
      industries: settings.qualifierIndustries,
      relationships: settings.qualifierRelationships,
      businessLines: Object.keys(BUSINESS_LINE_LABEL),
    };
    const [{ data: defs }, { data: ladders }] = await Promise.all([
      supabase.from("workflow_definition").select("*").eq("workflow_kind", "OFFICIAL_QUOTATION").order("version", { ascending: false }),
      supabase.from("margin_tier_authority").select("workflow_template_code").eq("is_active", true).not("workflow_template_code", "is", null),
    ]);
    // Latest version per template code.
    const latest = new Map<string, WorkflowDefinition>();
    for (const d of (defs ?? []) as WorkflowDefinition[]) {
      const code = d.template_code ?? d.id;
      if (!latest.has(code)) latest.set(code, d);
    }
    const stepCounts = new Map<string, string[]>();
    const latestIds = [...latest.values()].map((d) => d.id);
    const { data: stepRows } = await supabase
      .from("workflow_step_definition")
      .select("workflow_definition_id, step_name, step_order")
      .in("workflow_definition_id", latestIds)
      .order("step_order");
    for (const s of (stepRows ?? []) as Pick<WorkflowStepDefinition, "workflow_definition_id" | "step_name" | "step_order">[]) {
      stepCounts.set(s.workflow_definition_id, [...(stepCounts.get(s.workflow_definition_id) ?? []), s.step_name ?? `Langkah ${s.step_order}`]);
    }
    const ownLadder = new Set((ladders ?? []).map((l: { workflow_template_code: string }) => l.workflow_template_code));

    const rows: TemplateRow[] = [];
    for (const [code, d] of latest) {
      const qualifiers = [
        d.q_segments.length ? `Segmen: ${d.q_segments.join(", ")}` : null,
        d.q_industries.length ? `Industri: ${d.q_industries.join(", ")}` : null,
        d.q_relationships.length ? `Relasi: ${d.q_relationships.join(", ")}` : null,
        d.q_business_lines.length ? `Lini: ${d.q_business_lines.map((b) => BUSINESS_LINE_LABEL[b] ?? b).join(", ")}` : null,
        d.q_min_qty !== null || d.q_max_qty !== null ? `Qty: ${d.q_min_qty ?? 1}–${d.q_max_qty ?? "∞"}` : null,
        Number(d.min_value) > 0 || d.max_value !== null
          ? `Nilai: Rp ${Number(d.min_value).toLocaleString("id-ID")}–${d.max_value === null ? "∞" : Number(d.max_value).toLocaleString("id-ID")}`
          : null,
        d.q_blacklist === null ? null : d.q_blacklist ? "Customer blacklist" : "Bukan blacklist",
      ].filter(Boolean) as string[];
      rows.push({
        code,
        name: d.name,
        description: d.description,
        version: d.version,
        isActive: d.is_active,
        isFallback: d.is_fallback,
        priority: d.priority,
        qualifiers,
        stepNames: stepCounts.get(d.id) ?? [],
        hasOwnLadder: ownLadder.has(code),
      });
    }
    rows.sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.priority - a.priority || a.name.localeCompare(b.name));
    body = (
      <div className="space-y-6">
        <p className="text-xs text-muted">
          Workflow A — Price Estimate tidak memiliki langkah approval; siapa yang boleh memakainya diatur di tab{" "}
          <strong>Akses Menu</strong>. Daftar pilihan qualifier (segmen, industri, relasi) dan blacklist customer diatur
          di tab <strong>Umum &amp; Dokumen</strong>.
        </p>
        <CatalogTable rows={rows} />
        <TemplateTester lists={lists} />
      </div>
    );
  } else if (tab === "tier") {
    const [{ data: tierRows }, bands, { data: defs }] = await Promise.all([
      supabase.from("margin_tier_authority").select("*").eq("is_active", true).is("business_line", null).order("tier"),
      loadBands(supabase),
      supabase.from("workflow_definition").select("template_code, name").eq("workflow_kind", "OFFICIAL_QUOTATION").eq("is_active", true),
    ]);
    const all = (tierRows ?? []) as MarginTierAuthority[];
    const scoped = scope ? all.filter((r) => r.workflow_template_code === scope) : all.filter((r) => !r.workflow_template_code);
    const templates = ((defs ?? []) as { template_code: string | null; name: string }[])
      .filter((d) => d.template_code)
      .map((d) => ({ code: d.template_code as string, name: d.name, own: all.some((r) => r.workflow_template_code === d.template_code) }));
    const slotOptions = [
      ...FUNCTIONAL_ROLES.filter((f) => f !== "EXTERNAL_AGENCY" && f !== "SALESPERSON").map((f) => ({ value: f, label: FUNCTIONAL_ROLE_LABEL[f] })),
      ...roles.filter((r) => !r.is_external).map((r) => ({ value: `role:${r.code}`, label: `Hanya ${r.name}` })),
    ];
    body = (
      <div className="space-y-6">
        <TierScopeBar scope={scope ?? null} templates={templates} hasOwn={Boolean(scope) && scoped.length > 0} />
        {scoped.length > 0 ? (
          <TierEditor
            key={scope ?? "global"}
            tiers={scoped.map((t) => ({ ...t, gpm_lower_bound_pct: t.gpm_lower_bound_pct == null ? null : Number(t.gpm_lower_bound_pct), gpm_upper_bound_pct: t.gpm_upper_bound_pct == null ? null : Number(t.gpm_upper_bound_pct) }))}
            slotOptions={slotOptions}
          />
        ) : (
          <Card><CardContent className="py-6 text-center text-sm text-muted">Template ini memakai tier global.</CardContent></Card>
        )}
        {!scope && <BandEditor bands={bands} />}
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
