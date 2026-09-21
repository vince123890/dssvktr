import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { canManageWorkflowDefinitions } from "@/lib/rbac";
import type {
  Department,
  MarginTierAuthority,
  WorkflowDefinition,
  WorkflowStepDefinition,
} from "@/types/database";
import { WorkflowDefCard } from "./WorkflowDefCard";
import { MarginTierCard } from "./MarginTierCard";
import { CreateWorkflowForm } from "./CreateWorkflowForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function AdminPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: defs }, { data: stepDefs }, { data: departments }, { data: tiers }] =
    await Promise.all([
      supabase.from("workflow_definition").select("*").order("business_line").order("min_value"),
      supabase.from("workflow_step_definition").select("*").order("step_order"),
      supabase.from("department").select("*"),
      supabase.from("margin_tier_authority").select("*").order("tier"),
    ]);

  const definitions = (defs ?? []) as WorkflowDefinition[];
  const allSteps = (stepDefs ?? []) as WorkflowStepDefinition[];
  const depts = (departments ?? []) as Department[];
  const marginTiers = (tiers ?? []) as MarginTierAuthority[];
  const canEdit = canManageWorkflowDefinitions(profile.role);

  const grouped = definitions.reduce<Record<string, WorkflowDefinition[]>>((acc, d) => {
    (acc[d.business_line] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Workflow &amp; Margin Tier Admin</h1>
        <p className="text-sm text-muted mt-1">
          FR-2.0.1 Workflow Template Catalog dan FR-6.1 Margin Tier Authority.
          Alur approval dipilih otomatis dari katalog berdasarkan qualifier
          deal — bukan satu alur baku untuk semua quotation.
        </p>
        {!canEdit && (
          <p className="text-xs text-warning bg-warning-bg inline-block rounded-lg px-3 py-1.5 mt-2">
            Anda login sebagai role non-Admin — halaman ini read-only.
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Margin Tier Authority (FR-6.1)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted">
            Tier ditentukan dari GPM hasil akhir setelah diskon — bukan
            besaran diskon itu sendiri. Angka batas bersifat ilustratif hasil
            demo review, wajib dikonfirmasi Chief Sales &amp; BOD sebelum
            go-live.
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {marginTiers.map((tier) => (
              <MarginTierCard key={tier.id} tier={tier} canEdit={canEdit} />
            ))}
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah Workflow Template Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateWorkflowForm departments={depts} />
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted mb-3">Workflow Template Catalog</h2>
        {Object.entries(grouped).map(([businessLine, items]) => (
          <div key={businessLine} className="space-y-3 mb-4">
            <h3 className="text-xs font-semibold text-muted">
              {businessLine.replaceAll("_", " ")}
            </h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {items.map((def) => (
                <WorkflowDefCard
                  key={def.id}
                  def={def}
                  steps={allSteps.filter((s) => s.workflow_definition_id === def.id)}
                  departments={depts}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
