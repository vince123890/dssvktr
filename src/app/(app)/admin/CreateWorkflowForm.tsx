"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { COGS_STEP_DEPARTMENT_CODES, FINAL_STEP_DEPARTMENT_CODES } from "@/lib/rbac";
import type { BusinessLine, Department, WorkflowQualifierType } from "@/types/database";
import { AlertTriangle, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { createWorkflowDefinitionAction } from "./actions";

interface StepDraft {
  department_id: string;
  is_mandatory_gate: boolean;
  sla_hours: number;
}

const BUSINESS_LINE_OPTIONS: { value: BusinessLine; label: string }[] = [
  { value: "B2G_TENDER_BUS", label: "B2G Tender Bus" },
  { value: "B2B_COMMERCIAL_FLEET", label: "B2B Commercial Fleet" },
  { value: "CHARGING_INFRA_BUILDOUT", label: "Charging Infrastructure Buildout" },
];

/**
 * Mirrors the server-side rules in createWorkflowDefinitionAction so
 * Admin sees the same verdict before submitting, not just after a
 * rejected round-trip. The server remains the actual authority — this
 * is a UX improvement, not a security boundary (Technical Logic §10
 * "zero-bypass guarantee" still applies server-side).
 */
function validateStepOrder(
  steps: StepDraft[],
  deptById: Record<string, Department>
): string[] {
  const problems: string[] = [];
  if (steps.length === 0) return problems;

  const codes = steps.map((s) => deptById[s.department_id]?.code ?? null);

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const c of codes) {
    if (!c) continue;
    if (seen.has(c)) duplicates.add(c);
    seen.add(c);
  }
  if (duplicates.size > 0) {
    problems.push(
      `Department tidak boleh muncul dua kali: ${[...duplicates].join(", ")}.`
    );
  }

  const middle = codes.slice(0, -1);
  const invalidMiddle = middle.filter((c) => c && !COGS_STEP_DEPARTMENT_CODES.includes(c));
  if (invalidMiddle.length > 0) {
    problems.push(
      `Step selain terakhir harus COGS Owner (Sales/VP Operations/VP Finance) — bukan ${[...new Set(invalidMiddle)].join(", ")}.`
    );
  }

  const last = codes[codes.length - 1];
  if (last && !FINAL_STEP_DEPARTMENT_CODES.includes(last)) {
    problems.push(`Step terakhir harus Chief Sales atau BOD — bukan ${last}.`);
  }

  const vpOpsIndex = codes.indexOf("VP_OPERATIONS");
  const vpFinanceIndex = codes.indexOf("VP_FINANCE");
  if (vpOpsIndex !== -1 && vpFinanceIndex !== -1 && vpOpsIndex > vpFinanceIndex) {
    problems.push("VP Operations harus mengisi lebih dulu, sebelum VP Finance (urutan SOP).");
  }

  return problems;
}

export function CreateWorkflowForm({ departments }: { departments: Department[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qualifierType, setQualifierType] = useState<WorkflowQualifierType>("GENERIC");
  const [steps, setSteps] = useState<StepDraft[]>([
    { department_id: departments[0]?.id ?? "", is_mandatory_gate: true, sla_hours: 24 },
  ]);

  const deptById = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d])),
    [departments]
  );

  const problems = useMemo(() => validateStepOrder(steps, deptById), [steps, deptById]);

  function addStep() {
    setSteps((s) => [
      ...s,
      { department_id: departments[0]?.id ?? "", is_mandatory_gate: true, sla_hours: 24 },
    ]);
  }

  function removeStep(index: number) {
    setSteps((s) => s.filter((_, i) => i !== index));
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((s) => s.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setError(null);
        formData.set("steps", JSON.stringify(steps));
        startTransition(async () => {
          const result = await createWorkflowDefinitionAction(formData);
          if (result.ok) {
            formRef.current?.reset();
            setSteps([{ department_id: departments[0]?.id ?? "", is_mandatory_gate: true, sla_hours: 24 }]);
          } else {
            setError(result.error ?? "Gagal menyimpan workflow");
          }
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Field label="Nama Workflow Template">
          <input
            name="name"
            required
            placeholder="B2G Tender — Approval Ketat"
            className="input"
          />
        </Field>
        <Field label="Qualifier">
          <select
            name="qualifier_type"
            value={qualifierType}
            onChange={(e) => setQualifierType(e.target.value as WorkflowQualifierType)}
            className="input"
          >
            <option value="GENERIC">GENERIC (berlaku umum)</option>
            <option value="BUSINESS_LINE">BUSINESS_LINE (per lini bisnis)</option>
            <option value="MARGIN_TIER">MARGIN_TIER</option>
          </select>
        </Field>
        {qualifierType === "BUSINESS_LINE" && (
          <Field label="Lini Bisnis">
            <select name="business_line" required className="input">
              {BUSINESS_LINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Min. Nilai Transaksi (Rp)">
          <input name="min_value" type="number" min="0" defaultValue={0} className="input" />
        </Field>
        <Field label="Max. Nilai Transaksi (Rp, opsional)">
          <input name="max_value" type="number" min="0" placeholder="tanpa batas" className="input" />
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted">
          Urutan Step Approval (sekuensial — step selain terakhir harus
          COGS Owner, step terakhir harus Chief Sales/BOD)
        </p>
        <p className="text-[11px] text-muted">
          Hanya department aktif sesuai SOP VKTR yang bisa dipilih —
          department dari struktur lama (Procurement, Engineering, dst.)
          tidak lagi ditawarkan karena tidak ada user yang bisa approve-nya.
        </p>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-card-border p-2.5"
            >
              <span className="text-xs font-semibold text-muted w-6 pb-2">{i + 1}.</span>
              <label className="text-xs text-muted space-y-1 flex-1 min-w-[160px]">
                <span>Department</span>
                <select
                  value={step.department_id}
                  onChange={(e) => updateStep(i, { department_id: e.target.value })}
                  className="input"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted space-y-1 w-28">
                <span>SLA (jam)</span>
                <input
                  type="number"
                  min="1"
                  value={step.sla_hours}
                  onChange={(e) => updateStep(i, { sla_hours: Number(e.target.value) || 24 })}
                  className="input"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted pb-2">
                <input
                  type="checkbox"
                  checked={step.is_mandatory_gate}
                  onChange={(e) => updateStep(i, { is_mandatory_gate: e.target.checked })}
                  className="rounded"
                />
                Mandatory gate
              </label>
              <button
                type="button"
                disabled={steps.length <= 1}
                onClick={() => removeStep(i)}
                className="text-danger disabled:opacity-30 disabled:cursor-not-allowed pb-2"
                title="Hapus step"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addStep}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus size={13} /> Tambah Step
        </button>
      </div>

      {/* Live preview of the resulting flow, so Admin sees the alur
          before ever clicking submit. */}
      <div className="rounded-lg border border-card-border bg-slate-50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted mb-2">
          Preview Alur
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {steps.map((step, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <Badge tone={i === steps.length - 1 ? "info" : "default"}>
                {deptById[step.department_id]?.name ?? "?"}
              </Badge>
              {i < steps.length - 1 && <ArrowRight size={12} className="text-muted" />}
            </span>
          ))}
        </div>
        {problems.length > 0 && (
          <div className="mt-2 space-y-1">
            {problems.map((p, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-danger">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>{p}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={isPending} disabled={problems.length > 0}>
          {isPending ? "Menyimpan..." : "Tambah Workflow Template"}
        </Button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid var(--card-border);
          border-radius: 0.5rem;
          padding: 0.5rem 0.65rem;
          font-size: 0.8rem;
          background: white;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted space-y-1">
      <span>{label}</span>
      {children}
    </label>
  );
}
