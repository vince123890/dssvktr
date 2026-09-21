"use client";

import { Button } from "@/components/ui/Button";
import type { BusinessLine, Department, WorkflowQualifierType } from "@/types/database";
import { useRef, useState, useTransition } from "react";
import { createWorkflowDefinitionAction } from "./actions";
import { Plus, Trash2 } from "lucide-react";

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

export function CreateWorkflowForm({ departments }: { departments: Department[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qualifierType, setQualifierType] = useState<WorkflowQualifierType>("GENERIC");
  const [steps, setSteps] = useState<StepDraft[]>([
    { department_id: departments[0]?.id ?? "", is_mandatory_gate: true, sla_hours: 24 },
  ]);

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
          Urutan Step Approval (sekuensial — step terakhir diperlakukan
          sebagai tahap review final)
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

      {error && (
        <p className="rounded-lg border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={isPending}>
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
