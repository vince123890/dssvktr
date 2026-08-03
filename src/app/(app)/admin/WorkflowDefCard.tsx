"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCompactIDR } from "@/lib/utils";
import type { Department, WorkflowDefinition, WorkflowStepDefinition } from "@/types/database";
import { useTransition } from "react";
import { toggleWorkflowDefinitionActiveAction } from "./actions";

export function WorkflowDefCard({
  def,
  steps,
  departments,
  canEdit,
}: {
  def: WorkflowDefinition;
  steps: WorkflowStepDefinition[];
  departments: Department[];
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{def.name}</CardTitle>
          <p className="text-xs text-muted mt-0.5">
            {formatCompactIDR(def.min_value)}
            {def.max_value ? ` – ${formatCompactIDR(def.max_value)}` : "+"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={def.is_active ? "success" : "default"}>
            {def.is_active ? "Active" : "Inactive"}
          </Badge>
          {canEdit && (
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(() =>
                  toggleWorkflowDefinitionActiveAction(def.id, !def.is_active)
                )
              }
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {def.is_active ? "Nonaktifkan" : "Aktifkan"}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className="rounded-full border border-card-border px-2.5 py-1 font-medium">
                {i + 1}. {deptById[s.department_id]?.name}
                {s.is_mandatory_gate && <span className="text-danger">*</span>}
                <span className="text-muted"> ({s.sla_hours}h SLA)</span>
              </span>
              {i < steps.length - 1 && <span className="text-muted">→</span>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
