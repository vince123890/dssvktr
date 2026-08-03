import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { canManageWorkflowDefinitions } from "@/lib/rbac";
import type {
  Department,
  WorkflowDefinition,
  WorkflowStepDefinition,
} from "@/types/database";
import { WorkflowDefCard } from "./WorkflowDefCard";

export default async function AdminPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: defs }, { data: stepDefs }, { data: departments }] = await Promise.all([
    supabase.from("workflow_definition").select("*").order("business_line").order("min_value"),
    supabase.from("workflow_step_definition").select("*").order("step_order"),
    supabase.from("department").select("*"),
  ]);

  const definitions = (defs ?? []) as WorkflowDefinition[];
  const allSteps = (stepDefs ?? []) as WorkflowStepDefinition[];
  const depts = (departments ?? []) as Department[];
  const canEdit = canManageWorkflowDefinitions(profile.role);

  const grouped = definitions.reduce<Record<string, WorkflowDefinition[]>>((acc, d) => {
    (acc[d.business_line] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Workflow Admin — Configurable Approval Engine</h1>
        <p className="text-sm text-muted mt-1">
          FR-2.1 No-Code Workflow Configurator. Setiap lini bisnis memiliki
          bucket nilai transaksi yang menentukan alur approval (mis. transaksi
          besar otomatis menambahkan step C-Level Sign-off).
        </p>
        {!canEdit && (
          <p className="text-xs text-warning bg-warning-bg inline-block rounded-lg px-3 py-1.5 mt-2">
            Anda login sebagai role non-Admin — halaman ini read-only.
          </p>
        )}
      </div>

      {Object.entries(grouped).map(([businessLine, items]) => (
        <div key={businessLine} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">
            {businessLine.replaceAll("_", " ")}
          </h2>
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
  );
}
