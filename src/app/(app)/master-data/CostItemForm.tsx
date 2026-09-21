"use client";

import { Button } from "@/components/ui/Button";
import type { Department } from "@/types/database";
import { useRef, useTransition } from "react";
import { createCostItemAction } from "./actions";

export function CostItemForm({ departments }: { departments: Department[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          await createCostItemAction(formData);
          formRef.current?.reset();
        });
      }}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <Field label="Code">
        <input name="code" required placeholder="ADDON-EXTRA-002" className="input" />
      </Field>
      <Field label="Name" className="lg:col-span-2">
        <input name="name" required placeholder="Additional Service" className="input" />
      </Field>
      <Field label="Cost Group">
        <select name="cost_group" className="input" required>
          <option value="COGS">COGS</option>
          <option value="PROFITABILITY">Profitability</option>
          <option value="SALES">Sales</option>
          <option value="ADD_ONS">Add-Ons</option>
        </select>
      </Field>
      <Field label="Category (pelaporan Finance)">
        <select name="category" className="input" required>
          <option value="DIRECT">Direct</option>
          <option value="INDIRECT">Indirect</option>
          <option value="MARGIN_FACTOR">Margin Factor</option>
        </select>
      </Field>
      <Field label="Subcategory">
        <input name="subcategory" required placeholder="Add-On" className="input" />
      </Field>
      <Field label="Owner Department">
        <select name="owner_department_id" className="input" required>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Unit Type">
        <select name="unit_type" className="input" required>
          <option value="PER_UNIT">Per Unit</option>
          <option value="FIXED">Fixed</option>
          <option value="PERCENTAGE">Percentage</option>
        </select>
      </Field>
      <Field label="Denomination">
        <select name="denomination" className="input" required defaultValue="IDR">
          <option value="IDR">IDR</option>
          <option value="CNY">CNY (RMB)</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-xs text-muted self-end pb-2">
        <input type="checkbox" name="is_mandatory" defaultChecked className="rounded" />
        Mandatory gate item
      </label>
      <label className="flex items-center gap-2 text-xs text-muted self-end pb-2">
        <input type="checkbox" name="may_follow_later" className="rounded" />
        Boleh menyusul (tidak menghambat harga dasar)
      </label>

      <div className="col-span-2 lg:col-span-4 flex justify-end">
        <Button type="submit" loading={isPending} size="sm">
          {isPending ? "Menyimpan..." : "Tambah Cost Item"}
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

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs text-muted space-y-1 ${className ?? ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
