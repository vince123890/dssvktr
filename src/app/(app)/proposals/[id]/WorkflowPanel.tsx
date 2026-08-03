"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { STEP_STATUS_LABEL, STEP_STATUS_TONE } from "@/lib/workflow/labels";
import type { Department, WorkflowStepInstance, UserRole } from "@/types/database";
import { timeAgo } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, AlertOctagon } from "lucide-react";
import { useState, useTransition } from "react";
import { submitDecisionAction } from "./workflow-actions";
import { ROLE_DEPARTMENT_CODE } from "@/lib/rbac";
import { isSlaBreached } from "@/lib/workflow/stateMachine";

export function WorkflowPanel({
  proposalId,
  steps,
  departments,
  role,
}: {
  proposalId: string;
  steps: WorkflowStepInstance[];
  departments: Department[];
  role: UserRole;
}) {
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]));
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [targetStep, setTargetStep] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const activeStep = steps.find((s) => s.status === "IN_PROGRESS");
  const myDeptCode = ROLE_DEPARTMENT_CODE[role];
  const canAct =
    activeStep && deptById[activeStep.department_id]?.code === myDeptCode;

  function act(action: "APPROVE" | "APPROVE_WITH_CONDITIONS" | "REJECT" | "TARGETED_REJECT") {
    if (!activeStep) return;
    setError(null);
    startTransition(async () => {
      try {
        await submitDecisionAction({
          proposalId,
          action,
          targetStepOrder: action === "TARGETED_REJECT" ? Number(targetStep) : undefined,
          decisionNote: note || undefined,
        });
        setNote("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Department Approval Workflow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-0">
          {steps.map((step, idx) => {
            const dept = deptById[step.department_id];
            const breached = isSlaBreached(step);
            return (
              <li key={step.id} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      step.status === "APPROVED" || step.status === "APPROVED_WITH_CONDITIONS"
                        ? "bg-success text-white"
                        : step.status === "IN_PROGRESS"
                          ? "bg-primary text-white"
                          : step.status === "REJECTED"
                            ? "bg-danger text-white"
                            : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {step.status === "APPROVED" || step.status === "APPROVED_WITH_CONDITIONS" ? (
                      <CheckCircle2 size={14} />
                    ) : step.status === "REJECTED" ? (
                      <XCircle size={14} />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 my-1" />
                  )}
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{dept?.name}</span>
                    <Badge tone={STEP_STATUS_TONE[step.status]}>
                      {STEP_STATUS_LABEL[step.status]}
                    </Badge>
                    {breached && (
                      <Badge tone="danger">
                        <AlertOctagon size={11} /> SLA Breached
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1">
                    {step.status === "IN_PROGRESS" && step.sla_due_at && (
                      <>
                        <Clock size={11} />
                        SLA {step.sla_hours}h — jatuh tempo {timeAgo(step.sla_due_at)}
                      </>
                    )}
                    {step.completed_at && `Selesai ${timeAgo(step.completed_at)}`}
                  </div>
                  {step.decision_note && (
                    <p className="text-xs text-muted mt-1 italic bg-slate-50 rounded px-2 py-1">
                      &ldquo;{step.decision_note}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {canAct && (
          <div className="border-t border-card-border pt-4 space-y-3">
            <p className="text-xs font-medium text-muted">
              Anda bertindak sebagai {deptById[activeStep!.department_id]?.name} — aksi
              tersedia untuk step ini:
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan keputusan (wajib untuk Approve with Conditions / Reject)"
              className="w-full rounded-lg border border-card-border px-3 py-2 text-xs"
              rows={2}
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="success" disabled={isPending} onClick={() => act("APPROVE")}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => act("APPROVE_WITH_CONDITIONS")}
              >
                Approve with Conditions
              </Button>
              <Button size="sm" variant="danger" disabled={isPending} onClick={() => act("REJECT")}>
                Reject
              </Button>
              <div className="flex items-center gap-1.5">
                <select
                  value={targetStep}
                  onChange={(e) => setTargetStep(e.target.value ? Number(e.target.value) : "")}
                  className="rounded-lg border border-card-border px-2 py-1.5 text-xs"
                >
                  <option value="">Targeted Reject ke...</option>
                  {steps
                    .filter((s) => s.step_order < activeStep!.step_order)
                    .map((s) => (
                      <option key={s.id} value={s.step_order}>
                        {deptById[s.department_id]?.name}
                      </option>
                    ))}
                </select>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={isPending || !targetStep}
                  onClick={() => act("TARGETED_REJECT")}
                >
                  Kirim
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
