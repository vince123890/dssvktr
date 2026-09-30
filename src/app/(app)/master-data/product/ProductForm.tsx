"use client";

import { Button } from "@/components/ui/Button";
import { useRef, useState, useTransition } from "react";
import { createProductAction } from "./actions";

/**
 * FR-1.5.1 — a product VARIANT (make → model → type → variant) with the
 * attributes the Cost Estimate prints: document description, loco,
 * build type, inclusions/exclusions and specification pages.
 */
export function ProductForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createProductAction(formData);
          if (result.ok) formRef.current?.reset();
          else setError(result.error ?? "Gagal menyimpan produk");
        });
      }}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <Field label="Code *"><input name="code" required placeholder="LDT-4X2-SWB-DMP-90-CKD-MGL" className="pc-input" /></Field>
      <Field label="Nama varian *" className="lg:col-span-3"><input name="name" required placeholder="VKTR Light Duty Truck 4x2 SWB Dumper 90 kWh" className="pc-input" /></Field>
      <Field label="Make"><input name="make" defaultValue="VKTR" className="pc-input" /></Field>
      <Field label="Model"><input name="model" placeholder="Light Duty Truck" className="pc-input" /></Field>
      <Field label="Type"><input name="variant_type" placeholder="4x2 Short Wheelbase" className="pc-input" /></Field>
      <Field label="Variant"><input name="variant" placeholder="Dumper, Battery 90 kWh" className="pc-input" /></Field>
      <Field label="Wheelbase"><input name="wheelbase" placeholder="Short Wheelbase" className="pc-input" /></Field>
      <Field label="Baterai (kWh)"><input name="battery_kwh" type="number" step="any" placeholder="90" className="pc-input" /></Field>
      <Field label="Aplikasi bodi"><input name="body_application" placeholder="Dumper" className="pc-input" /></Field>
      <Field label="Build type">
        <select name="build_type" className="pc-input" defaultValue="CKD">
          <option value="CKD">CKD</option>
          <option value="CBU">CBU</option>
        </select>
      </Field>
      <Field label="Loco (titik penyerahan)"><input name="loco" defaultValue="Magelang" className="pc-input" /></Field>
      <Field label="Deskripsi di dokumen" className="lg:col-span-3">
        <input name="document_description" placeholder="VKTR Light Duty Truck 4x2, Short Wheelbase, with Dumper, Battery 90 kWh, CKD, loco Magelang" className="pc-input" />
      </Field>
      <Field label="Inclusions default (per baris)" className="lg:col-span-2">
        <textarea name="default_inclusions" rows={3} className="pc-input" defaultValue={"Onsite training during initial deployment, 2 week\nOnline training refreshment 1x (first year)\nOn-call technical support"} />
      </Field>
      <Field label="Exclusions default — at cost (per baris)" className="lg:col-span-2">
        <textarea name="default_exclusions" rows={3} className="pc-input" defaultValue={"Maintenance\nOther Requests"} />
      </Field>
      <Field label="URL halaman spesifikasi (per baris)" className="lg:col-span-4">
        <textarea name="image_urls" rows={2} className="pc-input" placeholder="/products/ldt-spec-1-features.jpg" />
      </Field>

      {error && <p className="col-span-2 text-xs text-danger lg:col-span-4">{error}</p>}
      <div className="col-span-2 flex justify-end lg:col-span-4">
        <Button type="submit" loading={isPending} size="sm">{isPending ? "Menyimpan..." : "Tambah Varian"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 text-xs text-muted ${className ?? ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
